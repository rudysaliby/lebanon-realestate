"""
OLX Lebanon scraper — optimized.
- Playwright ONCE to get session cookies
- httpx for ALL listing pages in parallel (10x faster than Playwright per page)
- httpx for ALL detail pages in parallel (20 concurrent)
- Zero AI needed — all tags from page JSON
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
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}

def parse_params(html):
    return {k: v for k, v in re.findall(r'"attribute"\s*:\s*"([^"]+)"\s*,\s*"formattedValue"\s*:\s*"([^"]+)"', html)}

def parse_geo(html):
    m = re.search(r'"geography"\s*:\s*\{"lat"\s*:([\d.]+)\s*,\s*"lng"\s*:([\d.]+)', html)
    if m:
        lat, lng = float(m.group(1)), float(m.group(2))
        if 33.0 <= lat <= 34.7 and 35.1 <= lng <= 36.6:
            return lat, lng
    return None

def parse_location(html):
    m = re.search(r'"location"\s*:\s*\[(.*?)\]', html, re.DOTALL)
    if not m: return None, None
    names = re.findall(r'"name"\s*:\s*"([^"]+)"', m.group(1))
    return (names[1] if len(names) >= 2 else None), (names[2] if len(names) >= 3 else None)

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
    if "fully" in r or r == "furnished": return "furnished"
    if "semi" in r or "partly" in r: return "semi-furnished"
    if "not" in r or "un" in r: return "unfurnished"
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
    if any(w in text for w in ["sea view", "sea-view", "seaview", "sea front"]): views.append("sea")
    if any(w in text for w in ["mountain view", "mountain-view"]): views.append("mountain")
    if any(w in text for w in ["city view", "city-view"]): views.append("city")
    if any(w in text for w in ["open view", "panoramic"]): views.append("open")
    return views[:3]

def parse_lifestyle(title, params):
    text = title.lower()
    tags = []
    if any(w in text for w in ["luxury", "luxurious", "high-end"]): tags.append("luxury")
    if any(w in text for w in ["quiet", "calm"]): tags.append("quiet")
    if "prime" in text: tags.append("prime-location")
    if any(w in text for w in ["gated", "compound"]): tags.append("gated")
    if "investment" in text: tags.append("investment")
    return list(set(tags))

class OLXScraper(BaseScraper):
    SOURCE = "olx"

    async def scrape(self, max_pages=10, progress=None):

        # ── Step 1: ONE Playwright load to get session cookies ────────────────
        cookies_dict = {}
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await browser.new_context(user_agent=HEADERS["User-Agent"], viewport={"width": 1280, "height": 800})
            page = await ctx.new_page()
            await page.goto(LISTING_URL, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(2000)
            raw_cookies = await ctx.cookies()
            cookies_dict = {c["name"]: c["value"] for c in raw_cookies}
            await page.close()
            await browser.close()

        if not progress:
            print(f"[OLX] Got {len(cookies_dict)} session cookies, fetching {max_pages} pages...")

        # ── Step 2: httpx for ALL listing pages in parallel ───────────────────
        listing_urls = []
        page_sem = asyncio.Semaphore(10)

        async with httpx.AsyncClient(
            headers=HEADERS,
            cookies=cookies_dict,
            timeout=20,
            follow_redirects=True,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=15)
        ) as client:

            async def fetch_listing_page(page_num):
                async with page_sem:
                    try:
                        resp = await client.get(LISTING_URL, params={"page": page_num})
                        if resp.status_code != 200:
                            if progress: progress.update(1, f"OLX page {page_num} blocked")
                            return []
                        html = resp.text
                        urls = []
                        seen = set()
                        for href in re.findall(r'href="(https://www\.olx\.com\.lb/ad/[^"]+)"', html):
                            base = href.split("?")[0]
                            if base not in seen:
                                seen.add(base)
                                urls.append({"url": base, "title": None, "price_raw": None, "image_url": None})
                        if progress:
                            progress.update(1, f"OLX listing pages {page_num}/{max_pages}")
                        else:
                            print(f"[OLX] Page {page_num}/{max_pages}: {len(urls)} listings")
                        return urls
                    except Exception as e:
                        if progress: progress.update(1, f"OLX page {page_num} error")
                        else: print(f"[OLX] Page {page_num} error: {e}")
                        return []

            page_results = await asyncio.gather(*[fetch_listing_page(p) for p in range(1, max_pages + 1)])

        # Deduplicate
        seen = set()
        for urls in page_results:
            for info in urls:
                if info["url"] not in seen:
                    seen.add(info["url"])
                    listing_urls.append(info)

        total = len(listing_urls)
        if not progress:
            print(f"[OLX] {total} unique listings, fetching details...")

        # ── Step 3: httpx for ALL detail pages in parallel ────────────────────
        results = []
        detail_sem = asyncio.Semaphore(20)
        completed = 0
        lock = asyncio.Lock()

        async with httpx.AsyncClient(
            headers=HEADERS,
            cookies=cookies_dict,
            timeout=15,
            follow_redirects=True,
            limits=httpx.Limits(max_connections=30, max_keepalive_connections=20)
        ) as client:

            async def fetch_detail(info):
                nonlocal completed
                async with detail_sem:
                    try:
                        resp = await client.get(info["url"])
                        if resp.status_code != 200:
                            return None
                        html = resp.text

                        params      = parse_params(html)
                        geo         = parse_geo(html)
                        region, area = parse_location(html)

                        # Price
                        price = None
                        if params.get("price"):
                            try: price = float(params["price"].replace(",", ""))
                            except: pass
                        if not price:
                            return None

                        # Size
                        size_sqm = None
                        if params.get("ft"):
                            try: size_sqm = float(params["ft"].replace(",", ""))
                            except: pass

                        # Title from page h1
                        title_m = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
                        title = title_m.group(1).strip() if title_m else (info.get("title") or "")

                        # Description
                        desc_m = re.search(r'"description"\s*:\s*"((?:[^"\\]|\\.)*)"', html)
                        description = None
                        if desc_m:
                            try: description = desc_m.group(1).encode().decode('unicode_escape')[:500]
                            except: description = desc_m.group(1)[:500]

                        # Image
                        img_m = re.search(r'"url"\s*:\s*"(https://[^"]+\.(?:jpg|jpeg|webp)[^"]*)"', html)
                        img_url = img_m.group(1) if img_m else info.get("image_url")

                        views     = parse_view(title, description or "")
                        lifestyle = parse_lifestyle(title, params)

                        listing = RawListing(
                            source=self.SOURCE,
                            url=info["url"],
                            title=title,
                            description=description,
                            price=price,
                            price_period="sale",
                            property_type=self.guess_property_type(title, params.get("property_type")),
                            size_sqm=size_sqm,
                            location_raw=title,
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
                        )
                        if views:     listing._view_type = views
                        if lifestyle: listing._lifestyle  = lifestyle
                        return listing

                    except:
                        return None
                    finally:
                        async with lock:
                            completed += 1
                            if progress:
                                progress.update(1, f"OLX details {completed}/{total}")
                            elif completed % 500 == 0 or completed == total:
                                print(f"  [OLX] {completed}/{total} details fetched")

            listings = await asyncio.gather(*[fetch_detail(info) for info in listing_urls])
            results = [l for l in listings if l]

        with_coords = sum(1 for r in results if r.lat)
        if not progress:
            print(f"[OLX] Done: {len(results)} listings | {with_coords} with coords")
        return results