"""
realestate.com.lb scraper — fast httpx page scraping version.

Strategy (same as OLX):
1. Listing cards API → get all listing URLs + basic data (fast, parallel)
2. httpx fetches each listing HTML page (40 parallel, no rate limit)
3. Extract all data from embedded JSON in HTML

Why faster than detail API:
- Detail API: rate limited to ~8 concurrent, needs 0.1s delay
- HTML pages: no rate limit, 40 concurrent → ~3x faster
- All data in one request: coords + amenities + type + floor

Fields extracted from HTML:
MANDATORY: lat/lng (community), area/subregion/region, price, size, type
OPTIONAL: amenities, floor, condition, furnished, bedrooms, bathrooms
"""
import asyncio
import re
import time
import httpx
from .base import BaseScraper, RawListing

BASE     = "https://www.realestate.com.lb"
LIST_URL = f"{BASE}/laravel/api/member/properties"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}

API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
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

def parse_amenities_from_html(html: str) -> tuple:
    """Extract amenities from the embedded JSON in listing HTML."""
    features  = set()
    lifestyle = set()
    # Match all name_en values in amenities array
    amenity_section = re.search(r'"amenities"\s*:\s*\[(.*?)\]', html, re.DOTALL)
    if amenity_section:
        names = re.findall(r'"name_en"\s*:\s*"([^"]+)"', amenity_section.group(1))
        for name in names:
            n = name.lower()
            mapped = AMENITY_MAP.get(n)
            if mapped: features.add(mapped)
            for kw in LIFESTYLE_KEYWORDS:
                if kw in n: lifestyle.add(kw)
    return list(features), list(lifestyle)

def parse_coords_from_html(html: str) -> tuple:
    """Extract community → district → province coords from HTML."""
    lat = lng = area = subregion = region = None

    # Community object (has name + coords)
    comm_m = re.search(
        r'"community"\s*:\s*\{[^}]*"name_en"\s*:\s*"([^"]+)"[^}]*"latitude"\s*:\s*"([\d.]+)"[^}]*"longitude"\s*:\s*"([\d.]+)"',
        html
    )
    if not comm_m:
        comm_m = re.search(
            r'"community"\s*:\s*\{[^}]*"latitude"\s*:\s*"([\d.]+)"[^}]*"longitude"\s*:\s*"([\d.]+)"[^}]*"name_en"\s*:\s*"([^"]+)"',
            html
        )
        if comm_m:
            clat, clng, cname = comm_m.group(1), comm_m.group(2), comm_m.group(3)
        else:
            clat = clng = cname = None
    else:
        cname, clat, clng = comm_m.group(1), comm_m.group(2), comm_m.group(3)

    if clat and validate_lb(clat, clng or "0"):
        lat, lng = float(clat), float(clng)
        area = cname

    # District name
    dist_m = re.search(r'"district"\s*:\s*\{[^}]*"name_en"\s*:\s*"([^"]+)"', html)
    if dist_m:
        subregion = dist_m.group(1).replace(" district","").replace(" District","") or None

    # Province name
    prov_m = re.search(r'"province"\s*:\s*\{[^}]*"name_en"\s*:\s*"([^"]+)"', html)
    if prov_m:
        region = prov_m.group(1).replace(" Governorate","") or None

    # Fallback: use district coords if no community coords
    if not lat:
        dist_coords = re.search(
            r'"district"\s*:\s*\{[^}]*"latitude"\s*:\s*"([\d.]+)"[^}]*"longitude"\s*:\s*"([\d.]+)"',
            html
        )
        if dist_coords and validate_lb(dist_coords.group(1), dist_coords.group(2)):
            lat, lng = float(dist_coords.group(1)), float(dist_coords.group(2))

    # Fallback: province coords
    if not lat:
        prov_coords = re.search(
            r'"province"\s*:\s*\{[^}]*"latitude"\s*:\s*"([\d.]+)"[^}]*"longitude"\s*:\s*"([\d.]+)"',
            html
        )
        if prov_coords and validate_lb(prov_coords.group(1), prov_coords.group(2)):
            lat, lng = float(prov_coords.group(1)), float(prov_coords.group(2))

    return lat, lng, area, subregion, region

def parse_view(title: str, description: str = "") -> list:
    text = f"{title} {description}".lower()
    views = []
    for kw, tag in VIEW_KEYWORDS.items():
        if kw in text and tag not in views:
            views.append(tag)
    return views[:3]

def parse_condition(html: str, title: str) -> str | None:
    m = re.search(r'"completion_status"\s*:\s*"([^"]+)"', html)
    if m:
        s = m.group(1).lower()
        if "under" in s or "construction" in s or "off" in s: return "under-construction"
        if "ready" in s or "complete" in s: return "well-maintained"
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


class RealEstateLBScraper(BaseScraper):
    SOURCE = "realestate.com.lb"

    async def scrape(self, max_pages: int = 2, progress=None) -> list:

        def log(msg):
            if not progress: print(msg)

        # ── Step 1: Fetch listing pages via API (fast JSON) ───────────────────
        async with httpx.AsyncClient(
            headers=API_HEADERS, timeout=20, follow_redirects=True,
            limits=httpx.Limits(max_connections=15)
        ) as api_client:

            try:
                resp = await api_client.get(LIST_URL, params={
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
                            r = await api_client.get(LIST_URL, params={
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

        log(f"[RELB] {len(all_docs)} listings — fetching HTML pages for full data...")

        # ── Step 2: Fetch HTML pages with httpx (40 parallel, no rate limit) ──
        det_sem   = asyncio.Semaphore(40)
        completed = 0
        total_det = len(all_docs)
        lock      = asyncio.Lock()
        det_start = time.time()
        listings  = []

        async with httpx.AsyncClient(
            headers=HEADERS, timeout=15, follow_redirects=True,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=40)
        ) as client:

            async def fetch_listing_page(basic: dict) -> RawListing | None:
                nonlocal completed
                async with det_sem:
                    result = None
                    try:
                        url_path = basic.get("url", "")
                        if not url_path:
                            return None

                        # Build full listing URL
                        page_url = f"{BASE}/en{url_path}" if not url_path.startswith("http") else url_path

                        resp = await client.get(page_url)
                        if resp.status_code != 200:
                            return None
                        html = resp.text

                        # ── Coords from embedded JSON ─────────────────────────
                        lat, lng, area, subregion, region = parse_coords_from_html(html)
                        if not area:
                            area = extract_area_from_url(url_path)

                        # ── Amenities ─────────────────────────────────────────
                        features, lifestyle = parse_amenities_from_html(html)

                        # ── Tags ──────────────────────────────────────────────
                        title       = basic.get("title_en") or ""
                        description = basic.get("description_en") or ""
                        views     = parse_view(title, description)
                        condition = parse_condition(html, title)
                        furnished = parse_furnished(basic.get("furnished"))

                        bedrooms  = basic.get("bedroom_value")
                        bathrooms = basic.get("bathroom_value")
                        try: bedrooms  = int(bedrooms)  if bedrooms  else None
                        except: bedrooms = None
                        try: bathrooms = int(bathrooms) if bathrooms else None
                        except: bathrooms = None

                        # Floor from HTML
                        floor_type = None
                        floor_m = re.search(r'"floor"\s*:\s*(-?\d+)', html)
                        if floor_m:
                            try:
                                f = int(floor_m.group(1))
                                if f <= 0:   floor_type = "ground"
                                elif f >= 8: floor_type = "high-floor"
                            except: pass

                        # Property type from HTML
                        type_m = re.search(r'"type"\s*:\s*\{[^}]*"name_en"\s*:\s*"([^"]+)"', html)
                        type_name = type_m.group(1) if type_m else None

                        # Price period
                        price_type_id = basic.get("price_type_id", 1)
                        period = "monthly" if price_type_id == 2 else "sale"

                        # Image
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

            all_results = await asyncio.gather(*[fetch_listing_page(doc) for doc in all_docs])
            listings = [l for l in all_results if l]

        with_coords   = sum(1 for r in listings if r.lat)
        price_suspect = sum(1 for r in listings if r._price_suspect)
        log(f"[RELB] Done: {len(listings)} listings | {with_coords} with coords | {price_suspect} suspect prices")
        return listings