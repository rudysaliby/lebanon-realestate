"""
realestate.com.lb scraper — final version.

Fixes vs previous:
1. _next/data API works with ALL reference formats (AP-22984, C21-113624, RWR-cj813)
2. 3-level coord fallback: community → district → province
3. Dynamic build hash fetched from homepage
4. Area name from URL slug as fallback
5. Full tag extraction — no AI needed
6. Page fetching in parallel (faster)
7. t_detail bug fixed (was causing 0 listings)
8. All prints suppressed when progress callback active (\r compatible)
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
    "swimming pool": "pool", "pool": "pool",
    "gym": "gym", "fitness": "gym",
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

def extract_area_from_url(url):
    m = re.search(r'for-(?:sale|rent)-(.+?)-lebanon', url)
    return m.group(1).replace('-', ' ').title() if m else None

def validate_lb(lat, lng):
    try: return 33.0 <= float(lat) <= 34.7 and 35.1 <= float(lng) <= 36.6
    except: return False

def parse_amenities(amenities_list):
    features  = set()
    lifestyle = set()
    for a in amenities_list:
        name = a.lower()
        mapped = AMENITY_MAP.get(name)
        if mapped: features.add(mapped)
        for kw in LIFESTYLE_KEYWORDS:
            if kw in name: lifestyle.add(kw)
    return list(features), list(lifestyle)

def parse_view(title, description):
    text = f"{title} {description}".lower()
    views = []
    for kw, tag in VIEW_KEYWORDS.items():
        if kw in text and tag not in views:
            views.append(tag)
    return views[:3]

def parse_condition(completion_status, title):
    if completion_status:
        s = completion_status.lower()
        if "under" in s or "construction" in s or "off" in s: return "under-construction"
        if "ready" in s or "complete" in s: return "well-maintained"
    t = (title or "").lower()
    if "under construction" in t or "off plan" in t: return "under-construction"
    if "new" in t and "building" in t: return "new"
    if "renovated" in t: return "renovated"
    return None

async def get_build_hash(client):
    try:
        resp = await client.get(BASE, timeout=10, headers={**HEADERS, "Accept": "text/html"})
        m = re.search(r'/_next/static/([^/]+)/_buildManifest', resp.text)
        if m: return m.group(1)
    except: pass
    return None

class RealEstateLBScraper(BaseScraper):
    SOURCE = "realestate.com.lb"

    async def scrape(self, max_pages=2, progress=None):

        def log(msg):
            if not progress: print(msg)

        async with httpx.AsyncClient(headers=HEADERS, timeout=20, follow_redirects=True) as client:

            # ── Get build hash ────────────────────────────────────────────────
            build_hash = await get_build_hash(client)
            log(f"[RELB] Build hash: {build_hash}" if build_hash else "[RELB] Warning: no build hash")

            # ── Page 1 to detect total ────────────────────────────────────────
            try:
                resp = await client.get(LIST_URL, params={"pg": 1, "sort": "listing_level", "ct": 1, "direction": "asc"})
                page_data = resp.json().get("data", {})
                first_docs = page_data.get("docs", [])
                num_found  = page_data.get("numFound", 0)
                per_page   = len(first_docs) if first_docs else 20
                total_pages = min(-(-num_found // per_page), max_pages)
                log(f"[RELB] {num_found} listings found, {total_pages} pages to fetch")
                if progress: progress.update(1, f"RELB page 1/{total_pages}")
            except Exception as e:
                log(f"[RELB] Failed to fetch page 1: {e}")
                return []

            # ── Fetch remaining pages in parallel ─────────────────────────────
            all_docs = list(first_docs)
            page_sem = asyncio.Semaphore(10)

            async def fetch_page(page_num):
                async with page_sem:
                    try:
                        resp = await client.get(LIST_URL, params={"pg": page_num, "sort": "listing_level", "ct": 1, "direction": "asc"})
                        docs = resp.json().get("data", {}).get("docs", [])
                        if progress: progress.update(1, f"RELB page {page_num}/{total_pages}")
                        else: log(f"[RELB] Page {page_num}/{total_pages}: {len(docs)} listings")
                        return docs
                    except:
                        if progress: progress.update(1, f"RELB page {page_num} error")
                        return []

            if total_pages > 1:
                page_results = await asyncio.gather(*[fetch_page(p) for p in range(2, total_pages + 1)])
                for docs in page_results:
                    all_docs.extend(docs)

            log(f"[RELB] Fetching details for {len(all_docs)} listings...")

            # ── Fetch details in parallel ──────────────────────────────────────
            detail_sem  = asyncio.Semaphore(8)
            completed   = 0
            total_det   = len(all_docs)
            lock        = asyncio.Lock()
            det_start   = time.time()

            async def fetch_detail(basic):
                async with detail_sem:
                    try:
                        await asyncio.sleep(0.1)
                        url_path = basic.get("url", "")
                        url      = f"{BASE}{url_path}" if not url_path.startswith("http") else url_path
                        page_path = url_path if url_path.startswith("/en/") else "/en" + url_path

                        prop = None

                        # Method 1: _next/data API
                        if build_hash:
                            try:
                                resp = await client.get(f"{BASE}/_next/data/{build_hash}{page_path}.json", timeout=10)
                                if resp.status_code == 200:
                                    prop = resp.json().get("pageProps", {}).get("property")
                            except: pass

                        # Method 2: Numeric ID fallback
                        if not prop and basic.get("id"):
                            try:
                                resp = await client.get(f"{BASE}/laravel/api/member/properties/{basic['id']}", timeout=10)
                                if resp.status_code == 200:
                                    raw = resp.json()
                                    prop = raw.get("data") or raw
                            except: pass

                        if not prop:
                            return None

                        # ── Coordinates ───────────────────────────────────────
                        community = prop.get("community") or {}
                        district  = community.get("district") or {}
                        province  = district.get("province") or {}
                        lat = lng = area = subregion = region = None

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
                        if not lat and prop.get("latitude") and validate_lb(prop["latitude"], prop.get("longitude", 0)):
                            lat, lng = float(prop["latitude"]), float(prop["longitude"])
                        if not area:
                            area = extract_area_from_url(url_path)

                        # ── Tags ──────────────────────────────────────────────
                        title       = prop.get("title_en") or basic.get("title_en") or ""
                        description = prop.get("description_en") or ""
                        amenity_names = [a.get("name_en","") for a in (prop.get("amenities") or [])]
                        features, lifestyle = parse_amenities(amenity_names)
                        views     = parse_view(title, description)
                        condition = parse_condition(prop.get("completion_status"), title)

                        furnished_raw = prop.get("furnished")
                        furnished = None
                        if furnished_raw:
                            f = furnished_raw.lower()
                            if f in ("furnished","fully furnished","yes"):   furnished = "furnished"
                            elif f in ("partly","semi","semi-furnished"):    furnished = "semi-furnished"
                            elif f in ("unfurnished","no","not furnished"):  furnished = "unfurnished"

                        bedroom  = prop.get("bedroom") or {}
                        bathroom = prop.get("bathroom") or {}
                        bedrooms  = int(bedroom["name_en"])  if str(bedroom.get("name_en","")).isdigit()  else None
                        bathrooms = int(bathroom["name_en"]) if str(bathroom.get("name_en","")).isdigit() else None

                        floor_val  = prop.get("floor")
                        floor_type = None
                        if floor_val is not None:
                            try:
                                f = int(floor_val)
                                if f <= 0: floor_type = "ground"
                                elif f >= 8: floor_type = "high-floor"
                            except: pass

                        price_type_name = (prop.get("price_type") or {}).get("name_en", "USD")
                        period   = "monthly" if "Month" in price_type_name else "sale"
                        type_name = (prop.get("type") or prop.get("category") or {}).get("name_en")
                        images   = prop.get("images") or basic.get("images") or []
                        img_url  = images[0].get("url") if images else None

                        listing = RawListing(
                            source=self.SOURCE,
                            url=url,
                            title=title,
                            description=description[:500],
                            price=prop.get("price") or basic.get("price"),
                            currency="USD",
                            price_period=period,
                            property_type=self.guess_property_type(title, type_name),
                            size_sqm=float(prop["area"]) if prop.get("area") else None,
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
                        )
                        if views:     listing._view_type = views
                        if lifestyle: listing._lifestyle  = lifestyle
                        return listing

                    except Exception:
                        return None

            async def fetch_tracked(doc):
                nonlocal completed
                result = await fetch_detail(doc)
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

            listings = await asyncio.gather(*[fetch_tracked(doc) for doc in all_docs])
            results  = [l for l in listings if l]

        with_coords = sum(1 for r in results if r.lat)
        log(f"[RELB] Total: {len(results)} | With coords: {with_coords}/{len(results)}")
        return results