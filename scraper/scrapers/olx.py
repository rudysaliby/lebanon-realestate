"""
OLX Lebanon scraper — clean systematic version.

Extracts from HTML page JSON:
MANDATORY:
- price (params.price, comma-stripped)
- size_sqm (params.ft, comma-stripped)  
- property_type (params.property_type)
- lat/lng (geography.lat/lng — precise GPS)
- region, area (location hierarchy)
- price_period (always "sale" for buy section)

OPTIONAL:
- bedrooms (params.rooms)
- bathrooms (params.bathrooms)
- furnished (params.furnished)
- condition, floor, payment, building_age

Speed: Playwright for listing pages (OLX blocks httpx), httpx for details (40 parallel)
"""
import asyncio
import re
import time
import httpx
from playwright.async_api import async_playwright
from .base import BaseScraper, RawListing

LISTING_URL = "https://www.olx.com.lb/properties/apartments-villas-for-sale/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}

# ── Parsers ───────────────────────────────────────────────────────────────────

def parse_params(html: str) -> dict:
    """Extract all OLX listing params from HTML JSON."""
    return {k: v for k, v in re.findall(
        r'"attribute"\s*:\s*"([^"]+)"\s*,\s*"formattedValue"\s*:\s*"([^"]+)"', html
    )}

def parse_geo(html: str) -> tuple | None:
    """Extract precise GPS coordinates from geography JSON."""
    m = re.search(r'"geography"\s*:\s*\{"lat"\s*:([\d.]+)\s*,\s*"lng"\s*:([\d.]+)', html)
    if m:
        lat, lng = float(m.group(1)), float(m.group(2))
        if 33.0 <= lat <= 34.7 and 35.1 <= lng <= 36.6:
            return lat, lng
    return None

def parse_location(html: str) -> tuple:
    """Extract [Lebanon, Region, Area] location hierarchy."""
    m = re.search(r'"location"\s*:\s*\[(.*?)\]', html, re.DOTALL)
    if not m: return None, None
    names = re.findall(r'"name"\s*:\s*"([^"]+)"', m.group(1))
    region = names[1] if len(names) >= 2 else None
    area   = names[2] if len(names) >= 3 else None
    return region, area

def parse_price(raw: str | None) -> float | None:
    if not raw: return None
    try: return float(raw.replace(",", ""))
    except: return None

def parse_size(raw: str | None) -> float | None:
    if not raw: return None
    try: return float(raw.replace(",", ""))
    except: return None

def parse_condition(raw: str | None) -> str | None:
    if not raw: return None
    r = raw.lower()
    if "under construction" in r or "off plan" in r: return "under-construction"
    if "ready" in r or "move in" in r: return "well-maintained"
    if "new" in r: return "new"
    if "renovat" in r: return "renovated"
    return None

def parse_furnished(raw: str | None) -> str | None:
    if not raw: return None
    r = raw.lower()
    if "fully" in r or r == "furnished": return "furnished"
    if "semi" in r or "partly" in r: return "semi-furnished"
    if "not" in r or "un" in r: return "unfurnished"
    return None

def parse_floor(raw: str | None) -> str | None:
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

def parse_building_age(raw: str | None) -> str | None:
    if not raw: return None
    r = raw.lower()
    if "less" in r or "new" in r or "1 year" in r: return "new-building"
    if "5 year" in r or "3 year" in r: return "recent"
    if "10+" in r or "old" in r: return "old-building"
    return None

def parse_view(title: str, description: str = "") -> list:
    text = f"{title} {description}".lower()
    views = []
    if any(w in text for w in ["sea view", "sea-view", "seaview", "sea front"]): views.append("sea")
    if any(w in text for w in ["mountain view", "mountain-view"]): views.append("mountain")
    if any(w in text for w in ["city view", "city-view"]): views.append("city")
    if any(w in text for w in ["open view", "panoramic"]): views.append("open")
    return views[:3]

def parse_lifestyle(title: str) -> list:
    text = title.lower()
    tags = []
    if any(w in text for w in ["luxury", "luxurious", "high-end"]): tags.append("luxury")
    if any(w in text for w in ["quiet", "calm"]): tags.append("quiet")
    if "prime" in text: tags.append("prime-location")
    if any(w in text for w in ["gated", "compound"]): tags.append("gated")
    if "investment" in text: tags.append("investment")
    return list(set(tags))

# ── Page scraping ─────────────────────────────────────────────────────────────

async def scrape_page(context, page_num: int, sem) -> list[str]:
    """Scrape one OLX listing page, return list of ad URLs."""
    async with sem:
        page = None
        try:
            page = await context.new_page()

            async def block_resources(route):
                if route.request.resource_type in ("image", "font", "media", "stylesheet"):
                    await route.abort()
                else:
                    await route.continue_()

            await page.route("**/*", block_resources)
            await page.goto(
                f"{LISTING_URL}?page={page_num}",
                wait_until="domcontentloaded",
                timeout=30000
            )

            # Articles are in static HTML — no wait needed
            html = await page.content()
            await page.close()

            # Extract URLs via regex — much faster than DOM querying
            urls = list(dict.fromkeys([
                f"https://www.olx.com.lb{m}"
                for m in re.findall(r'href="(/ad/[^"?]+)"', html)
            ]))
            return urls

        except Exception as e:
            if page:
                try: await page.close()
                except: pass
            return []

# ── Main scraper ──────────────────────────────────────────────────────────────

class OLXScraper(BaseScraper):
    SOURCE = "olx"

    async def scrape(self, max_pages: int = 10, progress=None) -> list:
        listing_urls = []

        def log(msg):
            if not progress: print(msg)

        # ── Step 1: Playwright for listing pages ──────────────────────────────
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await browser.new_context(
                user_agent=HEADERS["User-Agent"],
                viewport={"width": 1280, "height": 800}
            )

            sem = asyncio.Semaphore(5)

            async def fetch_page_tracked(page_num):
                urls = await scrape_page(ctx, page_num, sem)
                if progress:
                    progress.update(1, f"OLX listing pages {page_num}/{max_pages} found:{len(urls)}")
                else:
                    log(f"[OLX] Page {page_num}/{max_pages}: {len(urls)} listings")
                return urls

            page_results = await asyncio.gather(
                *[fetch_page_tracked(p) for p in range(1, max_pages + 1)]
            )
            await browser.close()

        # Deduplicate
        seen = set()
        for urls in page_results:
            for url in urls:
                if url not in seen:
                    seen.add(url)
                    listing_urls.append(url)

        total = len(listing_urls)
        log(f"[OLX] {total} unique listings, fetching details...")

        # ── Step 2: httpx for detail pages ────────────────────────────────────
        results   = []
        sem_det   = asyncio.Semaphore(40)
        completed = 0
        lock      = asyncio.Lock()
        det_start = time.time()

        async with httpx.AsyncClient(
            headers=HEADERS, timeout=15, follow_redirects=True,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=40)
        ) as client:

            async def fetch_detail(url: str) -> RawListing | None:
                nonlocal completed
                async with sem_det:
                    result = None
                    try:
                        resp = await client.get(url)
                        if resp.status_code != 200:
                            return None
                        html = resp.text

                        # Extract all data
                        params      = parse_params(html)
                        geo         = parse_geo(html)
                        region, area = parse_location(html)

                        # ── MANDATORY fields ──────────────────────────────────
                        price = parse_price(params.get("price"))
                        if not price:
                            return None  # No price → drop

                        size_sqm = parse_size(params.get("ft"))
                        prop_type = self.guess_property_type(None, params.get("property_type"))

                        # lat/lng from GPS (OLX has precise coords)
                        lat = geo[0] if geo else None
                        lng = geo[1] if geo else None

                        # ── Title & description ───────────────────────────────
                        title_m = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
                        title = title_m.group(1).strip() if title_m else url.split("/")[-1]

                        desc_m = re.search(r'"description"\s*:\s*"((?:[^"\\]|\\.)*)"', html)
                        description = None
                        if desc_m:
                            try: description = desc_m.group(1).encode().decode('unicode_escape')[:500]
                            except: description = desc_m.group(1)[:500]

                        # ── Image ─────────────────────────────────────────────
                        img_m = re.search(r'"url"\s*:\s*"(https://[^"]+\.(?:jpg|jpeg|webp)[^"]*)"', html)
                        img_url = img_m.group(1) if img_m else None

                        # ── Tags ──────────────────────────────────────────────
                        views     = parse_view(title, description or "")
                        lifestyle = parse_lifestyle(title)

                        # Price suspect check
                        price_suspect = price < 15000 and size_sqm and size_sqm > 0

                        listing = RawListing(
                            source=self.SOURCE,
                            url=url,
                            title=title,
                            description=description,
                            price=price,
                            currency="USD",
                            price_period="sale",
                            property_type=prop_type,
                            size_sqm=size_sqm,
                            location_raw=f"{area}, {region}" if area else title,
                            area=area,
                            region=region,
                            lat=lat,
                            lng=lng,
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

                    except:
                        pass
                    finally:
                        async with lock:
                            completed += 1
                            if progress:
                                progress.update(1, f"OLX details {completed}/{total}")
                            elif completed % 500 == 0 or completed == total:
                                elapsed = time.time() - det_start
                                rate = completed / elapsed if elapsed > 0 else 0
                                eta = (total - completed) / rate if rate > 0 else 0
                                log(f"  [OLX] {completed}/{total} | {int(rate)}/s | ETA {int(eta)}s")
                    return result

            listings = await asyncio.gather(*[fetch_detail(url) for url in listing_urls])
            results = [l for l in listings if l]

        with_coords = sum(1 for r in results if r.lat)
        price_suspect = sum(1 for r in results if r._price_suspect)
        log(f"[OLX] Done: {len(results)} listings | {with_coords} with coords | {price_suspect} suspect prices")
        return results
