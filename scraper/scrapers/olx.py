"""
OLX Lebanon scraper — optimized final version.

Speed improvements vs old version:
1. Playwright used ONLY for listing cards (to handle JS rendering)
2. Detail pages fetched with httpx (20x faster than Playwright)
3. 20 parallel detail page fetches (vs 5 before)
4. All tags extracted from page JSON — zero AI needed:
   - geography.lat/lng → precise coords
   - location[] → region/subregion/area hierarchy
   - params: rooms, bathrooms, condition, furnished, payment_option,
             floor_level, property_age, ft (size), property_type
"""
import asyncio
import re
import httpx
from playwright.async_api import async_playwright
from .base import BaseScraper, RawListing

URLS = [
    ("https://www.olx.com.lb/properties/apartments-villas-for-sale/", "sale"),
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

def parse_params(html: str) -> dict:
    """Extract all OLX listing params from HTML."""
    matches = re.findall(r'"attribute"\s*:\s*"([^"]+)"\s*,\s*"formattedValue"\s*:\s*"([^"]+)"', html)
    return {k: v for k, v in matches}

def parse_geo(html: str) -> tuple | None:
    """Extract precise coordinates from geography JSON."""
    m = re.search(r'"geography"\s*:\s*\{"lat"\s*:([\d.]+)\s*,\s*"lng"\s*:([\d.]+)', html)
    if m:
        lat, lng = float(m.group(1)), float(m.group(2))
        if 33.0 <= lat <= 34.7 and 35.1 <= lng <= 36.6:
            return lat, lng
    return None

def parse_location(html: str) -> tuple:
    """Extract location hierarchy [Lebanon, SubRegion, Area]."""
    m = re.search(r'"location"\s*:\s*\[(.*?)\]', html, re.DOTALL)
    if not m:
        return None, None, None
    names = re.findall(r'"name"\s*:\s*"([^"]+)"', m.group(1))
    region    = names[1] if len(names) >= 2 else None
    area      = names[2] if len(names) >= 3 else None
    return region, None, area  # OLX doesn't have subregion level

def parse_condition(raw: str | None) -> str | None:
    if not raw:
        return None
    r = raw.lower()
    if "under construction" in r or "off plan" in r: return "under-construction"
    if "ready" in r or "move in" in r:               return "well-maintained"
    if "new" in r:                                    return "new"
    if "renovat" in r:                                return "renovated"
    if "good" in r:                                   return "well-maintained"
    return None

def parse_furnished(raw: str | None) -> str | None:
    if not raw:
        return None
    r = raw.lower()
    if "fully" in r or r == "furnished":  return "furnished"
    if "semi" in r or "partly" in r:      return "semi-furnished"
    if "not" in r or "un" in r:           return "unfurnished"
    return None

def parse_floor(raw: str | None) -> str | None:
    if not raw:
        return None
    try:
        f = int(raw)
        if f == 0:    return "ground"
        if f == -1:   return "ground"
        if f >= 8:    return "high-floor"
    except:
        r = raw.lower()
        if "roof" in r or "penthouse" in r: return "penthouse"
        if "ground" in r:                   return "ground"
    return None

def parse_building_age(raw: str | None) -> str | None:
    if not raw:
        return None
    r = raw.lower()
    if "less" in r or "new" in r or "1 year" in r: return "new-building"
    if "5 year" in r or "3 year" in r:             return "recent"
    if "10+" in r or "old" in r:                   return "old-building"
    return None

def parse_view(title: str, description: str) -> list:
    text = f"{title} {description}".lower()
    views = []
    if any(w in text for w in ["sea view", "sea-view", "sea front", "seaview"]): views.append("sea")
    if any(w in text for w in ["mountain view", "mountain-view"]):                views.append("mountain")
    if any(w in text for w in ["city view", "city-view"]):                        views.append("city")
    if any(w in text for w in ["open view", "open-view", "panoramic"]):           views.append("open")
    if "garden" in text and "view" in text:                                        views.append("garden")
    return views[:3]

def parse_lifestyle(title: str, params: dict) -> list:
    text = title.lower()
    tags = []
    if any(w in text for w in ["luxury", "luxurious", "high-end", "high end"]): tags.append("luxury")
    if any(w in text for w in ["quiet", "calm", "peaceful"]):                   tags.append("quiet")
    if any(w in text for w in ["prime", "prime location"]):                     tags.append("prime-location")
    if any(w in text for w in ["gated", "compound"]):                           tags.append("gated")
    if any(w in text for w in ["corner", "corner unit"]):                       tags.append("corner-unit")
    if any(w in text for w in ["investment", "roi", "rental yield"]):           tags.append("investment")
    if "penthouse" in text or "rooftop" in text:                                tags.append("luxury")
    if params.get("seller_type","").lower() == "by owner":                      tags.append("direct-owner")
    return list(set(tags))

class OLXScraper(BaseScraper):
    SOURCE = "olx"

    async def scrape(self, max_pages=1):
        listing_urls = []

        # Step 1: Use Playwright to get listing card URLs only
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=HEADERS["User-Agent"],
                viewport={"width": 1280, "height": 800}
            )

            for base_url, period in URLS:
                for page_num in range(1, max_pages + 1):
                    url = f"{base_url}?page={page_num}"
                    print(f"[OLX] {period} page {page_num}")
                    try:
                        page = await context.new_page()
                        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        await page.wait_for_timeout(2000)
                        cards = await page.query_selector_all("article")
                        print(f"[OLX] Found {len(cards)} cards")

                        for card in cards:
                            try:
                                link = await card.query_selector("a[href]")
                                href = await link.get_attribute("href") if link else None
                                if not href:
                                    continue
                                if not href.startswith("http"):
                                    href = f"https://www.olx.com.lb{href}"

                                # Get basic info from card
                                full_text = (await card.inner_text()).strip()
                                lines = [l.strip() for l in full_text.split("\n") if l.strip()]
                                title = next((l for l in lines if len(l) > 15 and "USD" not in l and "$" not in l), None)
                                price_raw = next((l for l in lines if "USD" in l or "$" in l), None)
                                size_raw = next((l for l in lines if re.search(r'\d+\s*(sqm|m²|sq)', l, re.I)), None)

                                img_el = await card.query_selector("img[src]")
                                img_url = None
                                if img_el:
                                    src = await img_el.get_attribute("src")
                                    if src and src.startswith("http") and "placeholder" not in src.lower():
                                        img_url = src

                                listing_urls.append({
                                    "url": href,
                                    "period": period,
                                    "title": title,
                                    "price": self.parse_price(price_raw),
                                    "size_sqm": self.parse_size(size_raw),
                                    "image_url": img_url,
                                })
                            except:
                                continue
                        await page.close()
                        await asyncio.sleep(1)
                    except Exception as e:
                        print(f"[OLX] Error: {e}")

            await browser.close()

        print(f"[OLX] Got {len(listing_urls)} listing URLs, fetching details with httpx...")

        # Step 2: Fetch detail pages with httpx — 20x faster than Playwright
        results = []
        sem = asyncio.Semaphore(20)

        async with httpx.AsyncClient(headers=HEADERS, timeout=15, follow_redirects=True) as client:

            async def fetch_detail(info: dict) -> RawListing | None:
                async with sem:
                    try:
                        resp = await client.get(info["url"])
                        if resp.status_code != 200:
                            return None
                        html = resp.text

                        params      = parse_params(html)
                        geo         = parse_geo(html)
                        subregion, _, area = parse_location(html)
                        region      = subregion  # OLX location[1] is subregion, location[2] is area

                        # Re-parse location properly
                        m = re.search(r'"location"\s*:\s*\[(.*?)\]', html, re.DOTALL)
                        names = re.findall(r'"name"\s*:\s*"([^"]+)"', m.group(1)) if m else []
                        region    = names[1] if len(names) >= 2 else None
                        area      = names[2] if len(names) >= 3 else None

                        # Description
                        desc_m = re.search(r'"description"\s*:\s*"((?:[^"\\]|\\.)*)\"', html)
                        description = desc_m.group(1).encode().decode('unicode_escape')[:500] if desc_m else None

                        # Size from params (overrides card) — strip commas first e.g. "2,560" → 2560
                        size_sqm = info["size_sqm"]
                        if params.get("ft"):
                            try: size_sqm = float(params["ft"].replace(",", ""))
                            except: pass

                        # Views and lifestyle from title + description
                        title = info["title"] or ""
                        views     = parse_view(title, description or "")
                        lifestyle = parse_lifestyle(title, params)

                        # Use params price if available (more accurate than card price)
                        if params.get("price"):
                            try:
                                parsed_price = float(params["price"].replace(",", ""))
                                if parsed_price > 0:
                                    info["price"] = parsed_price
                            except: pass

                        listing = RawListing(
                            source=self.SOURCE,
                            url=info["url"],
                            title=title,
                            description=description,
                            price=info["price"],
                            price_period=info["period"],
                            property_type=self.guess_property_type(title, params.get("property_type")),
                            size_sqm=size_sqm,
                            location_raw=title,
                            area=area,
                            subregion=None,
                            region=region,
                            lat=geo[0] if geo else None,
                            lng=geo[1] if geo else None,
                            image_url=info["image_url"],
                            _furnished=parse_furnished(params.get("furnished")),
                            _bedrooms=int(params["rooms"]) if params.get("rooms","").isdigit() else None,
                            _bathrooms=int(params["bathrooms"]) if params.get("bathrooms","").isdigit() else None,
                            _condition=parse_condition(params.get("condition")),
                            _payment=params.get("payment_option", "").lower() or None,
                            _floor=parse_floor(params.get("floor_level")),
                            _building_age=parse_building_age(params.get("property_age")),
                        )

                        if views:     listing._view_type = views
                        if lifestyle: listing._lifestyle  = lifestyle

                        return listing

                    except Exception as e:
                        return None

            tasks = [fetch_detail(info) for info in listing_urls]
            listings = await asyncio.gather(*tasks)
            results = [l for l in listings if l]

        with_coords = sum(1 for r in results if r.lat)
        print(f"[OLX] Total: {len(results)} | With coords: {with_coords}/{len(results)}")
        return results