"""
realestate.com.lb scraper — API-based, rate-limit safe.

Strategy:
- Listing cards API: price, size, bedrooms, bathrooms, furnished, title, images
- Detail API (per listing): coords + amenities + type + floor
- Rate limit: max 10 concurrent requests with 0.1s stagger between starts
- Retry on 429 with exponential backoff
"""
import asyncio
import re
import time
import httpx
from .base import BaseScraper, RawListing

BASE     = "https://www.realestate.com.lb"
LIST_URL = f"{BASE}/laravel/api/member/properties"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/html",
    "Referer": "https://www.realestate.com.lb/",
}

AMENITY_MAP = {
    "swimming pool": "pool", "pool": "pool", "shared pool": "pool",
    "gym": "gym", "fitness": "gym", "shared gym": "gym",
    "parking": "parking", "covered parking": "parking",
    "elevator": "elevator", "lift": "elevator",
    "generator": "generator", "backup generator": "generator",
    "security": "security", "24/7 security": "security",
    "storage": "storage", "storage room": "storage",
    "balcony": "balcony", "terrace": "terrace", "garden": "garden",
    "solar": "solar", "solar panels": "solar",
    "sea access": "sea-access", "private beach": "sea-access",
    "built in wardrobes": "storage", "maids room": "storage",
    "concierge": "security", "near sea": "sea-access",
}
LIFESTYLE_KEYWORDS = {"luxury","prime","gated","corner","investment","quiet","penthouse","duplex","triplex","rooftop"}
VIEW_KEYWORDS = {
    "sea": "sea", "ocean": "sea", "marina": "sea",
    "mountain": "mountain", "valley": "mountain",
    "city": "city", "beirut": "city",
    "garden": "garden", "open": "open",
}

def validate_lb(lat, lng) -> bool:
    try: return 33.0 <= float(lat) <= 34.7 and 35.1 <= float(lng) <= 36.6
    except: return False

def extract_area_from_url(url: str) -> str | None:
    m = re.search(r'for-(?:sale|rent)-(.+?)-lebanon', url)
    return m.group(1).replace('-', ' ').title() if m else None

def parse_amenities(amenities_list: list) -> tuple:
    features = set()
    lifestyle = set()
    for a in amenities_list:
        name = a.lower()
        mapped = AMENITY_MAP.get(name)
        if mapped: features.add(mapped)
        for kw in LIFESTYLE_KEYWORDS:
            if kw in name: lifestyle.add(kw)
    return list(features), list(lifestyle)

def parse_view(title: str, description: str = "") -> list:
    text = f"{title} {description}".lower()
    views = []
    for kw, tag in VIEW_KEYWORDS.items():
        if kw in text and tag not in views:
            views.append(tag)
    return views[:3]

def parse_condition(title: str) -> str | None:
    t = (title or "").lower()
    if "under construction" in t or "off plan" in t: return "under-construction"
    if "new" in t and "building" in t: return "new"
    if "renovated" in t: return "renovated"
    return None

def parse_furnished(raw: str | None) -> str | None:
    if not raw: return None
    r = raw.lower()
    if r in ("furnished", "fully furnished", "yes", "1"): return "furnished"
    if r in ("partly", "semi", "semi-furnished", "2"):    return "semi-furnished"
    if r in ("unfurnished", "no", "not furnished", "0"):  return "unfurnished"
    return None

def parse_coords_from_prop(prop: dict) -> tuple:
    """Extract community → district → province coords from detail API response."""
    lat = lng = area = subregion = region = None
    if not prop: return lat, lng, area, subregion, region

    community = prop.get("community") or {}
    district  = community.get("district") or {}
    province  = district.get("province") or {}

    if community.get("latitude") and validate_lb(community["latitude"], community.get("longitude", 0)):
        lat, lng  = float(community["latitude"]), float(community["longitude"])
        area      = community.get("name_en")
        subregion = (district.get("name_en") or "").replace(" district","").replace(" District","") or None
        region    = (province.get("name_en") or "").replace(" Governorate","") or None
    elif district.get("latitude") and validate_lb(district["latitude"], district.get("longitude", 0)):
        lat, lng  = float(district["latitude"]), float(district["longitude"])
        subregion = (district.get("name_en") or "").replace(" district","").replace(" District","") or None
        region    = (province.get("name_en") or "").replace(" Governorate","") or None
    elif province.get("latitude") and validate_lb(province["latitude"], province.get("longitude", 0)):
        lat, lng = float(province["latitude"]), float(province["longitude"])
        region   = (province.get("name_en") or "").replace(" Governorate","") or None

    return lat, lng, area, subregion, region


class RealEstateLBScraper(BaseScraper):
    SOURCE = "realestate.com.lb"

    async def scrape(self, max_pages: int = 2, progress=None) -> list:

        def log(msg):
            if not progress: print(msg)

        async with httpx.AsyncClient(
            headers=HEADERS, timeout=20, follow_redirects=True,
            limits=httpx.Limits(max_connections=15, max_keepalive_connections=10)
        ) as client:

            # ── Step 1: Fetch listing pages ───────────────────────────────────
            try:
                resp = await client.get(LIST_URL, params={
                    "pg": 1, "sort": "listing_level", "ct": 1, "direction": "asc"
                })
                resp.raise_for_status()
                page_data  = resp.json().get("data", {})
                first_docs = page_data.get("docs", [])
                if not first_docs:
                    log("[RELB] No listings on page 1")
                    return []
                num_found   = page_data.get("numFound", 0)
                per_page    = len(first_docs)
                total_pages = min(-(-num_found // per_page), max_pages)
                log(f"[RELB] {num_found} listings, {total_pages} pages")
                if progress: progress.update(1, f"RELB page 1/{total_pages} found:{per_page}")
            except Exception as e:
                log(f"[RELB] Page 1 failed: {e}")
                return []

            all_docs = list(first_docs)
            if total_pages > 1:
                page_sem = asyncio.Semaphore(8)

                async def fetch_page(page_num: int):
                    async with page_sem:
                        try:
                            r = await client.get(LIST_URL, params={
                                "pg": page_num, "sort": "listing_level", "ct": 1, "direction": "asc"
                            })
                            docs = r.json().get("data", {}).get("docs", [])
                            if progress: progress.update(1, f"RELB page {page_num}/{total_pages} found:{len(docs)}")
                            else: log(f"[RELB] Page {page_num}/{total_pages}: {len(docs)}")
                            return docs
                        except:
                            if progress: progress.update(1, f"RELB page {page_num} error")
                            return []

                page_results = await asyncio.gather(
                    *[fetch_page(p) for p in range(2, total_pages + 1)]
                )
                for docs in page_results:
                    all_docs.extend(docs)

            log(f"[RELB] {len(all_docs)} listings — fetching details...")

            # ── Step 2: Detail API with controlled concurrency ─────────────────
            # Max 10 concurrent, staggered starts to avoid burst 429s
            det_sem   = asyncio.Semaphore(10)
            completed = 0
            total_det = len(all_docs)
            lock      = asyncio.Lock()
            det_start = time.time()
            listings  = []

            async def fetch_detail(basic: dict, index: int) -> RawListing | None:
                nonlocal completed
                # Stagger starts: index * 0.05s to avoid burst
                await asyncio.sleep(index * 0.05)
                async with det_sem:
                    result = None
                    try:
                        listing_id = basic.get("id")
                        if not listing_id:
                            return None

                        # Fetch with retry on 429
                        prop = None
                        for attempt in range(4):
                            r = await client.get(
                                f"{BASE}/laravel/api/member/properties/{listing_id}",
                                timeout=15
                            )
                            if r.status_code == 200:
                                prop = r.json()
                                break
                            elif r.status_code == 429:
                                wait = 2 ** attempt  # 1s, 2s, 4s, 8s
                                await asyncio.sleep(wait)
                            else:
                                break

                        # ── Coords ────────────────────────────────────────────
                        lat, lng, area, subregion, region = parse_coords_from_prop(prop)
                        url_path = basic.get("url", "")
                        if not area:
                            area = extract_area_from_url(url_path)

                        # ── Tags from card + detail ───────────────────────────
                        title       = basic.get("title_en") or ""
                        description = basic.get("description_en") or ""

                        amenity_names = []
                        if prop:
                            amenity_names = [a.get("name_en","") for a in (prop.get("amenities") or [])]
                        features, lifestyle = parse_amenities(amenity_names)
                        views     = parse_view(title, description)
                        condition = parse_condition(title)
                        furnished = parse_furnished(basic.get("furnished"))

                        bedrooms  = basic.get("bedroom_value")
                        bathrooms = basic.get("bathroom_value")
                        try: bedrooms  = int(bedrooms)  if bedrooms  else None
                        except: bedrooms = None
                        try: bathrooms = int(bathrooms) if bathrooms else None
                        except: bathrooms = None

                        floor_type = None
                        if prop and prop.get("floor") is not None:
                            try:
                                f = int(prop["floor"])
                                if f <= 0:   floor_type = "ground"
                                elif f >= 8: floor_type = "high-floor"
                            except: pass

                        type_name = None
                        if prop:
                            type_name = (prop.get("type") or prop.get("category") or {}).get("name_en")

                        price_type_id = basic.get("price_type_id", 1)
                        period = "monthly" if price_type_id == 2 else "sale"

                        images  = basic.get("images") or []
                        img_url = images[0].get("url") if images else None

                        price    = basic.get("price")
                        size_sqm = float(basic["area"]) if basic.get("area") else None

                        if not price:
                            return None

                        price_suspect = (price < 15000 and period == "sale")
                        url = f"{BASE}{url_path}" if not url_path.startswith("http") else url_path

                        listing = RawListing(
                            source=self.SOURCE,
                            url=url,
                            title=title,
                            description=description[:500],
                            price=price,
                            currency="USD",
                            price_period=period,
                            property_type=self.guess_property_type(title, type_name),
                            size_sqm=size_sqm,
                            location_raw=area or title,
                            area=area,
                            subregion=subregion,
                            region=region,
                            lat=lat,
                            lng=lng,
                            image_url=img_url,
                            _furnished=furnished,
                            _bedrooms=bedrooms,
                            _bathrooms=bathrooms,
                            _amenities=features if features else None,
                            _floor=floor_type,
                            _condition=condition,
                            _price_suspect=price_suspect,
                        )
                        if views:     listing._view_type = views
                        if lifestyle: listing._lifestyle  = lifestyle
                        result = listing

                    except Exception as e:
                        log(f"  [RELB] error {basic.get('id')}: {type(e).__name__}: {e}")

                    finally:
                        async with lock:
                            completed += 1
                            if progress:
                                progress.update(1, f"RELB details {completed}/{total_det}")
                            elif completed % 200 == 0 or completed == total_det:
                                elapsed = time.time() - det_start
                                rate    = completed / elapsed if elapsed > 0 else 0
                                eta     = (total_det - completed) / rate if rate > 0 else 0
                                log(f"  [RELB] {completed}/{total_det} | {int(rate)}/s | ETA {int(eta)}s")

                    return result

            # Staggered launch — not all at once
            tasks = [fetch_detail(doc, i) for i, doc in enumerate(all_docs)]
            all_results = await asyncio.gather(*tasks)
            listings = [l for l in all_results if l]

        with_coords   = sum(1 for r in listings if r.lat)
        price_suspect = sum(1 for r in listings if r._price_suspect)
        log(f"[RELB] Done: {len(listings)} listings | {with_coords} with coords | {price_suspect} suspect prices")
        return listings