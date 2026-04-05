"""
OLX Lebanon scraper — all property categories, fully httpx.

NO Playwright needed — OLX listing pages work with plain httpx.
Speed: 20 concurrent listing pages + 40 concurrent detail pages.

Categories:
- Apartments & Villas For Sale/Rent
- Land For Sale
- Commercial For Sale/Rent  
- Chalets For Sale
- Buildings For Sale

Filtering:
- location[0] == "Lebanon" → keeps only Lebanon listings
- lat/lng validated to Lebanon bounds
"""
import asyncio
import re
import time
import httpx
from .base import BaseScraper, RawListing

CATEGORIES = [
    # For sale — matches OLX exactly
    {"url": "https://www.olx.com.lb/properties/apartments-villas-for-sale/",       "period": "sale",    "type": "residential", "max_pages": 659},
    {"url": "https://www.olx.com.lb/properties/commercial-for-sale/",              "period": "sale",    "type": "commercial",  "max_pages": 78},
    {"url": "https://www.olx.com.lb/properties/land-for-sale/",                    "period": "sale",    "type": "land",        "max_pages": 172},
    {"url": "https://www.olx.com.lb/properties/chalet-for-sale/",                  "period": "sale",    "type": "chalet",      "max_pages": 29},
    {"url": "https://www.olx.com.lb/properties/buildings-multiple-units-for-sale/","period": "sale",    "type": "building",    "max_pages": 17},
    # For rent — matches OLX exactly
    {"url": "https://www.olx.com.lb/properties/apartments-villas-for-rent/",       "period": "monthly", "type": "residential", "max_pages": 165},
    {"url": "https://www.olx.com.lb/properties/commercial-for-rent/",              "period": "monthly", "type": "commercial",  "max_pages": 151},
    {"url": "https://www.olx.com.lb/properties/land-for-rent/",                    "period": "monthly", "type": "land",        "max_pages": 9},
    {"url": "https://www.olx.com.lb/properties/chalet-for-rent/",                  "period": "monthly", "type": "chalet",      "max_pages": 13},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}

def parse_params(html):
    # Use FIRST occurrence of each key — page contains related listings at bottom
    # which would overwrite the actual listing's values if we used a dict comprehension
    result = {}
    for k, v in re.findall(
        r'"attribute"\s*:\s*"([^"]+)"\s*,\s*"formattedValue"\s*:\s*"([^"]+)"', html
    ):
        if k not in result:  # first match wins
            result[k] = v
    return result

def parse_geo(html):
    m = re.search(r'"geography"\s*:\s*\{"lat"\s*:([\d.]+)\s*,\s*"lng"\s*:([\d.]+)', html)
    if m:
        lat, lng = float(m.group(1)), float(m.group(2))
        if 33.0 <= lat <= 34.7 and 35.1 <= lng <= 36.6:
            return lat, lng
    return None

def parse_location(html):
    """Returns (is_lebanon, region, area)."""
    m = re.search(r'"location"\s*:\s*\[(.*?)\]', html, re.DOTALL)
    if not m: return False, None, None
    names = re.findall(r'"name"\s*:\s*"([^"]+)"', m.group(1))
    if not names or names[0] != "Lebanon":
        return False, None, None
    return True, (names[1] if len(names) >= 2 else None), (names[2] if len(names) >= 3 else None)

def parse_price(raw):
    if not raw: return None
    try: return float(raw.replace(",", ""))
    except: return None

def parse_size(raw):
    if not raw: return None
    try: return float(raw.replace(",", ""))
    except: return None

def parse_condition(raw):
    if not raw: return None
    r = raw.lower()
    if "under construction" in r or "off plan" in r: return "under-construction"
    if "ready" in r or "move in" in r: return "well-maintained"
    if "new" in r: return "new"
    if "renovat" in r: return "renovated"
    return None

def parse_furnished(raw):
    if not raw: return None
    r = raw.lower()
    if "fully" in r or r in ("furnished", "yes"): return "furnished"
    if "semi" in r or "partly" in r: return "semi-furnished"
    if "not" in r or "un" in r or r == "no": return "unfurnished"
    return None

def parse_floor(raw):
    if not raw: return None
    try:
        f = int(raw)
        if f <= 0: return "ground"
        if f >= 8: return "high-floor"
    except:
        r = raw.lower()
        if "roof" in r or "penthouse" in r: return "penthouse"
        if "ground" in r: return "ground"
    return None

def parse_building_age(raw):
    if not raw: return None
    r = raw.lower()
    if "less" in r or "new" in r or "1 year" in r: return "new-building"
    if "5 year" in r or "3 year" in r: return "recent"
    if "10+" in r or "old" in r: return "old-building"
    return None

def parse_view(title, description=""):
    text = f"{title} {description}".lower()
    views = []
    if any(w in text for w in ["sea view","sea-view","seaview","sea front"]): views.append("sea")
    if any(w in text for w in ["mountain view","mountain-view"]): views.append("mountain")
    if any(w in text for w in ["city view","city-view"]): views.append("city")
    if any(w in text for w in ["open view","panoramic"]): views.append("open")
    return views[:3]

def parse_lifestyle(title):
    text = title.lower()
    tags = []
    if any(w in text for w in ["luxury","luxurious","high-end"]): tags.append("luxury")
    if any(w in text for w in ["quiet","calm"]): tags.append("quiet")
    if "prime" in text: tags.append("prime-location")
    if any(w in text for w in ["gated","compound"]): tags.append("gated")
    if "investment" in text: tags.append("investment")
    return list(set(tags))

def extract_urls(html):
    return list(dict.fromkeys([
        f"https://www.olx.com.lb{m}"
        for m in re.findall(r'href="(/ad/[^"?]+)"', html)
    ]))


class OLXScraper(BaseScraper):
    SOURCE = "olx"

    async def scrape(self, max_pages=500, progress=None):
        all_url_pairs = []  # [(url, period), ...]

        def log(msg):
            if not progress: print(msg)

        # ── Step 1: httpx for ALL listing pages (20 concurrent per category) ──
        async with httpx.AsyncClient(
            headers=HEADERS, timeout=20, follow_redirects=True,
            limits=httpx.Limits(max_connections=30, max_keepalive_connections=20)
        ) as client:

            for cat in CATEGORIES:
                cat_url   = cat["url"]
                period    = cat["period"]
                cat_pages = min(max_pages, cat["max_pages"])
                cat_name  = cat_url.split("/properties/")[1].rstrip("/")
                page_sem  = asyncio.Semaphore(20)

                async def fetch_listing_page(page_num, cat_url=cat_url, period=period, cat_name=cat_name):
                    async with page_sem:
                        try:
                            resp = await client.get(f"{cat_url}?page={page_num}", timeout=15)
                            if resp.status_code != 200:
                                if progress: progress.update(1, f"OLX {cat_name} pg {page_num} error")
                                return []
                            urls = extract_urls(resp.text)
                            if progress:
                                progress.update(1, f"OLX {cat_name} pg {page_num} found:{len(urls)}")
                            else:
                                log(f"[OLX] {cat_name} page {page_num}/{cat_pages}: {len(urls)}")
                            return [(u, period) for u in urls]
                        except Exception as e:
                            if progress: progress.update(1, f"OLX {cat_name} pg {page_num} error")
                            else: log(f"[OLX] {cat_name} page {page_num} error: {e}")
                            return []

                page_results = await asyncio.gather(
                    *[fetch_listing_page(p) for p in range(1, cat_pages + 1)]
                )

                seen = set()
                cat_count = 0
                for page_urls in page_results:
                    for url, per in page_urls:
                        if url not in seen:
                            seen.add(url)
                            all_url_pairs.append((url, per))
                            cat_count += 1

                log(f"[OLX] {cat_name}: {cat_pages} pages → {cat_count} listings")

        # Deduplicate across categories
        seen = set()
        unique_pairs = []
        for url, period in all_url_pairs:
            if url not in seen:
                seen.add(url)
                unique_pairs.append((url, period))

        total = len(unique_pairs)
        log(f"[OLX] {total} unique listings across all categories, fetching details...")

        # ── Step 2: httpx for detail pages (40 concurrent) ───────────────────
        results   = []
        sem_det   = asyncio.Semaphore(40)
        completed = 0
        lock      = asyncio.Lock()
        det_start = time.time()

        async with httpx.AsyncClient(
            headers=HEADERS, timeout=15, follow_redirects=True,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=40)
        ) as client:

            async def fetch_detail(url, period):
                nonlocal completed
                async with sem_det:
                    result = None
                    try:
                        resp = await client.get(url)
                        if resp.status_code != 200:
                            return None
                        html = resp.text

                        is_lebanon, region, area = parse_location(html)
                        if not is_lebanon:
                            return None

                        params    = parse_params(html)
                        geo       = parse_geo(html)
                        price     = parse_price(params.get("price"))
                        if not price: return None

                        size_sqm  = parse_size(params.get("ft"))
                        raw_type  = params.get("property_type") or params.get("type")
                        # Use category URL as fallback for property type
                        if not raw_type:
                            if "land" in url: raw_type = "land"
                            elif "chalet" in url: raw_type = "chalet"
                            elif "commercial" in url: raw_type = "commercial"
                            elif "building" in url: raw_type = "building"
                        prop_type = self.guess_property_type(None, raw_type)

                        title_m = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
                        title   = title_m.group(1).strip() if title_m else ""

                        desc_m = re.search(r'"description"\s*:\s*"((?:[^"\\]|\\.)*)"', html)
                        description = None
                        if desc_m:
                            try: description = desc_m.group(1).encode().decode('unicode_escape')[:500]
                            except: description = desc_m.group(1)[:500]

                        # Primary: JSON-LD structured data has reliable image URL
                        # <script type="application/ld+json">{"image": "https://images.olx.com.lb/..."}
                        ld_m = re.search(r'"image"\s*:\s*"(https://images\.olx\.com\.lb/thumbnails/[^"]+)"', html)
                        if ld_m:
                            # Use 800x600 version for better quality
                            img_url = re.sub(r'-\d+x\d+\.', '-800x600.', ld_m.group(1))
                        else:
                            # Fallback: photos JSON blob
                            photo_m = re.search(r'"photos"\s*:\s*\[\s*\{[^}]*"id"\s*:\s*(\d+)', html)
                            if photo_m:
                                img_url = f"https://images.olx.com.lb/thumbnails/{photo_m.group(1)}-800x600.webp"
                            else:
                                thumb_m = re.search(r'https://images\.olx\.com\.lb/thumbnails/\d+-\d+x\d+\.\w+', html)
                                img_url = thumb_m.group(0) if thumb_m else None

                        views     = parse_view(title, description or "")
                        lifestyle = parse_lifestyle(title)
                        price_suspect = (price < 15000 and period == "sale" and size_sqm)

                        listing = RawListing(
                            source=self.SOURCE,
                            url=url,
                            title=title,
                            description=description,
                            price=price,
                            currency="USD",
                            price_period=period,
                            property_type=prop_type,
                            size_sqm=size_sqm,
                            location_raw=f"{area}, {region}" if area else (region or "Lebanon"),
                            area=area,
                            region=region,
                            lat=geo[0] if geo else None,
                            lng=geo[1] if geo else None,
                            image_url=img_url,
                            _furnished=parse_furnished(params.get("furnished")),
                            _bedrooms=int(params["rooms"]) if params.get("rooms","").isdigit() else None,
                            _bathrooms=int(params["bathrooms"]) if params.get("bathrooms","").isdigit() else None,
                            _condition=parse_condition(params.get("condition")),
                            _payment=params.get("payment_option","").lower() or None,
                            _floor=parse_floor(params.get("floor_level")),
                            _building_age=parse_building_age(params.get("property_age")),
                            _price_suspect=price_suspect,
                        )
                        if views:     listing._view_type = views
                        if lifestyle: listing._lifestyle  = lifestyle
                        result = listing

                    except: pass
                    finally:
                        async with lock:
                            completed += 1
                            if progress:
                                progress.update(1, f"OLX details {completed}/{total}")
                            elif completed % 1000 == 0 or completed == total:
                                elapsed = time.time() - det_start
                                rate = completed / elapsed if elapsed > 0 else 0
                                eta  = (total - completed) / rate if rate > 0 else 0
                                log(f"  [OLX] {completed}/{total} | {int(rate)}/s | ETA {int(eta)}s")
                    return result

            listings = await asyncio.gather(*[fetch_detail(u, p) for u, p in unique_pairs])
            results = [l for l in listings if l]

        with_coords   = sum(1 for r in results if r.lat)
        price_suspect = sum(1 for r in results if r._price_suspect)
        log(f"[OLX] Done: {len(results)} | {with_coords} with coords | {price_suspect} suspect prices")
        return results
