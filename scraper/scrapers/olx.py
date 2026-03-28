"""
OLX Lebanon scraper.
- Playwright for listing pages (OLX blocks httpx even with cookies)
- httpx for detail pages (20 parallel — fast)
- All tags from page JSON, zero AI needed
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
        listing_infos = []

        def log(msg):
            if not progress: print(msg)

        # ── Step 1: Playwright for listing pages ──────────────────────────────
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await browser.new_context(
                user_agent=HEADERS["User-Agent"],
                viewport={"width": 1280, "height": 800}
            )

            # Block images and fonts to speed up page loads
            async def block_resources(route):
                if route.request.resource_type in ("image", "font", "media", "stylesheet"):
                    await route.abort()
                else:
                    await route.continue_()

            # Run up to 3 pages in parallel
            page_sem_pw = asyncio.Semaphore(3)

            for page_num in range(1, max_pages + 1):
                try:
                    page = await ctx.new_page()
                    await page.route("**/*", block_resources)
                    await page.goto(f"{LISTING_URL}?page={page_num}", wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(800)
                    cards = await page.query_selector_all("article")

                    for card in cards:
                        try:
                            link = await card.query_selector("a[href]")
                            href = await link.get_attribute("href") if link else None
                            if not href: continue
                            if not href.startswith("http"):
                                href = f"https://www.olx.com.lb{href}"
                            href = href.split("?")[0]
                            if "/ad/" not in href: continue

                            full_text = (await card.inner_text()).strip()
                            lines = [l.strip() for l in full_text.split("\n") if l.strip()]
                            title = next((l for l in lines if len(l) > 15 and "USD" not in l and "$" not in l), None)
                            price_raw = next((l for l in lines if "USD" in l or "$" in l), None)

                            img_el = await card.query_selector("img[src]")
                            img_url = None
                            if img_el:
                                src = await img_el.get_attribute("src")
                                if src and src.startswith("http") and "placeholder" not in src.lower():
                                    img_url = src

                            if href not in [i["url"] for i in listing_infos]:
                                listing_infos.append({"url": href, "title": title, "price_raw": price_raw, "image_url": img_url})
                        except:
                            continue

                    await page.close()
                    await asyncio.sleep(0.5)

                    if progress:
                        progress.update(1, f"OLX listing pages {page_num}/{max_pages}")
                    else:
                        log(f"[OLX] Page {page_num}/{max_pages}: {len(cards)} cards")

                except Exception as e:
                    log(f"[OLX] Page {page_num} error: {e}")
                    if progress: progress.update(1, f"OLX page {page_num} error")
                    try: await page.close()
                    except: pass

            await browser.close()

        total = len(listing_infos)
        log(f"[OLX] {total} listings found, fetching details with httpx...")

        # ── Step 2: httpx for detail pages — 20 parallel ─────────────────────
        results  = []
        sem      = asyncio.Semaphore(20)
        completed = 0
        lock     = asyncio.Lock()
        det_start = time.time()

        async with httpx.AsyncClient(headers=HEADERS, timeout=15, follow_redirects=True,
                                     limits=httpx.Limits(max_connections=30)) as client:

            async def fetch_detail(info):
                nonlocal completed
                async with sem:
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
                        if not price and info.get("price_raw"):
                            try: price = float(re.sub(r"[^\d.]", "", info["price_raw"].replace(",", "")))
                            except: pass
                        if not price:
                            return None

                        # Size
                        size_sqm = None
                        if params.get("ft"):
                            try: size_sqm = float(params["ft"].replace(",", ""))
                            except: pass

                        # Title
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
                                elapsed = time.time() - det_start
                                rate = completed / elapsed if elapsed > 0 else 0
                                eta = (total - completed) / rate if rate > 0 else 0
                                log(f"  [OLX] {completed}/{total} | {int(rate)}/s | ETA {int(eta)}s")

            listings = await asyncio.gather(*[fetch_detail(info) for info in listing_infos])
            results = [l for l in listings if l]

        with_coords = sum(1 for r in results if r.lat)
        log(f"[OLX] Done: {len(results)} listings | {with_coords} with coords")
        return results