"""
realestate.com.lb scraper — final version.

Fixes vs old version:
1. _next/data API works with ALL reference formats (AP-22984, C21-113624, RWR-cj813)
2. 3-level coord fallback: community → district → province
3. Dynamic build hash (no hardcoding)
4. Area name from URL slug fallback
5. Full tag extraction from API — no AI needed:
   - furnished, floor, completion_status, bedrooms, bathrooms
   - amenities (pool, gym, parking, security, etc.)
   - property type, view, condition
   - payment type from price_type
"""
import asyncio
import re
import httpx
from .base import BaseScraper, RawListing

BASE     = "https://www.realestate.com.lb"
LIST_URL = f"{BASE}/laravel/api/member/properties"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/html",
    "Referer": "https://www.realestate.com.lb/",
}

# Map amenity names to our features/lifestyle tags
AMENITY_MAP = {
    "swimming pool": "pool", "pool": "pool",
    "gym": "gym", "fitness": "gym",
    "parking": "parking", "covered parking": "parking",
    "elevator": "elevator", "lift": "elevator",
    "generator": "generator", "backup generator": "generator",
    "security": "security", "24/7 security": "security",
    "storage": "storage", "storage room": "storage",
    "balcony": "balcony",
    "terrace": "terrace",
    "garden": "garden",
    "solar": "solar", "solar panels": "solar",
    "sea access": "sea-access", "private beach": "sea-access",
    "built in wardrobes": "storage",
    "maids room": "storage",
    "central a/c": None,  # common, not worth tagging
    "kitchen appliances": None,
    "concierge": "security",
    "near sea": "sea-access",
}

LIFESTYLE_KEYWORDS = {
    "luxury", "prime", "gated", "corner", "investment",
    "quiet", "penthouse", "duplex", "triplex", "rooftop"
}

VIEW_KEYWORDS = {
    "sea": "sea", "ocean": "sea", "marina": "sea",
    "mountain": "mountain", "valley": "mountain",
    "city": "city", "beirut": "city",
    "garden": "garden", "open": "open",
}

def extract_area_from_url(url: str) -> str | None:
    m = re.search(r'for-(?:sale|rent)-(.+?)-lebanon', url)
    if m:
        return m.group(1).replace('-', ' ').title()
    return None

def validate_lb(lat, lng) -> bool:
    try:
        return 33.0 <= float(lat) <= 34.7 and 35.1 <= float(lng) <= 36.6
    except:
        return False

def parse_amenities(amenities_list: list) -> tuple[list, list]:
    """Returns (features[], lifestyle[]) from amenity names."""
    features  = set()
    lifestyle = set()
    for a in amenities_list:
        name = a.lower()
        mapped = AMENITY_MAP.get(name)
        if mapped:
            features.add(mapped)
        for kw in LIFESTYLE_KEYWORDS:
            if kw in name:
                lifestyle.add(kw)
    return list(features), list(lifestyle)

def parse_view(title: str, description: str) -> list:
    """Extract view types from title and description."""
    text = f"{title} {description}".lower()
    views = []
    for kw, tag in VIEW_KEYWORDS.items():
        if kw in text and tag not in views:
            views.append(tag)
    return views[:3]  # max 3 view tags

def parse_condition(completion_status: str | None, title: str) -> str | None:
    if completion_status:
        s = completion_status.lower()
        if "under" in s or "construction" in s or "off" in s:
            return "under-construction"
        if "ready" in s or "complete" in s:
            return "well-maintained"
    title_lower = (title or "").lower()
    if "under construction" in title_lower or "off plan" in title_lower:
        return "under-construction"
    if "new" in title_lower and "building" in title_lower:
        return "new"
    if "renovated" in title_lower or "renovated" in title_lower:
        return "renovated"
    return None

async def get_build_hash(client: httpx.AsyncClient) -> str | None:
    try:
        resp = await client.get(BASE, timeout=10, headers={**HEADERS, "Accept": "text/html"})
        m = re.search(r'/_next/static/([^/]+)/_buildManifest', resp.text)
        if m:
            return m.group(1)
    except:
        pass
    return None

class RealEstateLBScraper(BaseScraper):
    SOURCE = "realestate.com.lb"

    async def scrape(self, max_pages=2):
        results = []
        async with httpx.AsyncClient(headers=HEADERS, timeout=20, follow_redirects=True) as client:

            build_hash = await get_build_hash(client)
            if build_hash:
                print(f"[RELB] Build hash: {build_hash}")
            else:
                print(f"[RELB] Warning: no build hash, using detail API fallback")

            # Fetch listing pages
            all_docs = []
            for page_num in range(1, max_pages + 1):
                print(f"[RELB] Fetching page {page_num}...")
                try:
                    resp = await client.get(LIST_URL, params={
                        "pg": page_num, "sort": "listing_level",
                        "ct": 1, "direction": "asc",
                    })
                    data = resp.json()
                    docs = data.get("data", {}).get("docs", [])
                    if not docs:
                        break
                    print(f"[RELB] Page {page_num}: {len(docs)} listings")
                    all_docs.extend(docs)
                    await asyncio.sleep(0.3)
                except Exception as e:
                    print(f"[RELB] Page error: {e}")
                    break

            print(f"[RELB] Fetching details for {len(all_docs)} listings...")
            sem = asyncio.Semaphore(8)

            async def fetch_detail(basic):
                async with sem:
                    try:
                        await asyncio.sleep(0.1)
                        url_path = basic.get("url", "")
                        url = f"{BASE}{url_path}" if not url_path.startswith("http") else url_path

                        page_path = url_path if url_path.startswith("/en/") else "/en" + url_path

                        prop = None

                        # Method 1: _next/data API (preferred — all reference formats work)
                        if build_hash:
                            next_url = f"{BASE}/_next/data/{build_hash}{page_path}.json"
                            try:
                                resp = await client.get(next_url, timeout=10)
                                if resp.status_code == 200:
                                    prop = resp.json().get("pageProps", {}).get("property")
                            except:
                                pass

                        # Method 2: Numeric ID detail API fallback
                        if not prop and basic.get("id"):
                            try:
                                resp = await client.get(
                                    f"{BASE}/laravel/api/member/properties/{basic['id']}",
                                    timeout=10
                                )
                                if resp.status_code == 200:
                                    raw = resp.json()
                                    prop = raw.get("data") or raw
                            except:
                                pass

                        if not prop:
                            return None

                        # ── Coordinates: community → district → province ───────
                        community = prop.get("community") or {}
                        district  = community.get("district") or {}
                        province  = district.get("province") or {}

                        lat = lng = None
                        area = subregion = region = None

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

                        # ── Tags from API — no AI needed ─────────────────────
                        title       = prop.get("title_en") or basic.get("title_en") or ""
                        description = prop.get("description_en") or ""
                        amenity_names = [a.get("name_en","") for a in (prop.get("amenities") or [])]
                        features, lifestyle = parse_amenities(amenity_names)
                        views    = parse_view(title, description)
                        condition = parse_condition(prop.get("completion_status"), title)

                        # Furnished: API returns "furnished", "partly", "unfurnished", null
                        furnished_raw = prop.get("furnished")
                        furnished = None
                        if furnished_raw:
                            f = furnished_raw.lower()
                            if f in ("furnished", "fully furnished", "yes"):     furnished = "furnished"
                            elif f in ("partly", "semi", "semi-furnished"):      furnished = "semi-furnished"
                            elif f in ("unfurnished", "no", "not furnished"):    furnished = "unfurnished"

                        # Bedrooms / bathrooms
                        bedroom  = prop.get("bedroom") or {}
                        bathroom = prop.get("bathroom") or {}
                        bedrooms  = int(bedroom["name_en"])  if str(bedroom.get("name_en","")).isdigit()  else None
                        bathrooms = int(bathroom["name_en"]) if str(bathroom.get("name_en","")).isdigit() else None

                        # Floor
                        floor_val = prop.get("floor")
                        floor_type = None
                        if floor_val is not None:
                            try:
                                f = int(floor_val)
                                if f == 0:   floor_type = "ground"
                                elif f >= 8: floor_type = "high-floor"
                            except:
                                pass

                        # Price period
                        price_type_name = (prop.get("price_type") or {}).get("name_en", "USD")
                        period = "monthly" if "Month" in price_type_name else "sale"

                        # Property type
                        type_name = (prop.get("type") or prop.get("category") or {}).get("name_en")

                        # Images
                        images  = prop.get("images") or basic.get("images") or []
                        img_url = images[0].get("url") if images else None

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

                        # Store extra tags that db.py will save
                        if views:     listing._view_type = views
                        if lifestyle: listing._lifestyle  = lifestyle

                        return listing

                    except Exception:
                        return None

            tasks = [fetch_detail(doc) for doc in all_docs]
            listings = await asyncio.gather(*tasks)
            results = [l for l in listings if l]

        with_coords = sum(1 for r in results if r.lat)
        print(f"[RELB] Total: {len(results)} | With coords: {with_coords}/{len(results)}")
        return results