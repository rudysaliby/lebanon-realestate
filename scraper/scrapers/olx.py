"""
OLX Lebanon scraper — fully httpx based, no Playwright.

Speed: ~10-20x faster than Playwright version.
- Listing pages: httpx with 10 parallel requests
- Detail pages: httpx with 20 parallel requests
- Zero browser overhead

All tags extracted from page JSON — zero AI needed.
"""
import asyncio
import re
import time
import httpx
from .base import BaseScraper, RawListing

LISTING_URL = "https://www.olx.com.lb/properties/apartments-villas-for-sale/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

def parse_params(html: str) -> dict:
    matches = re.findall(r'"attribute"\s*:\s*"([^"]+)"\s*,\s*"formattedValue"\s*:\s*"([^"]+)"', html)
    return {k: v for k, v in matches}

def parse_geo(html: str) -> tuple | None:
    m = re.search(r'"geography"\s*:\s*\{"lat"\s*:([\d.]+)\s*,\s*"lng"\s*:([\d.]+)', html)
    if m:
        lat, lng = float(m.group(1)), float(m.group(2))
        if 33.0 <= lat <= 34.7 and 35.1 <= lng <= 36.6:
            return lat, lng
    return None

def parse_location(html: str) -> tuple:
    m = re.search(r'"location"\s*:\s*\[(.*?)\]', html, re.DOTALL)
    if not m:
        return None, None
    names = re.findall(r'"name"\s*:\s*"([^"]+)"', m.group(1))
    region = names[1] if len(names) >= 2 else None
    area   = names[2] if len(names) >= 3 else None
    return region, area

def parse_condition(raw: str | None) -> str | None:
    if not raw: return None
    r = raw.lower()
    if "under construction" in r or "off plan" in r: return "under-construction"
    if "ready" in r or "move in" in r:               return "well-maintained"
    if "new" in r:                                    return "new"
    if "renovat" in r:                                return "renovated"
    return None

def parse_furnished(raw: str | None) -> str | None:
    if not raw: return None
    r = raw.lower()
    if "fully" in r or r == "furnished": return "furnished"
    if "semi" in r or "partly" in r:     return "semi-furnished"
    if "not" in r or "un" in r:          return "unfurnished"
    return None

def parse_floor(raw: str | None) -> str | None:
    if not raw: return None
    try:
        f = int(raw)
        if f <= 0:  return "ground"
        if f >= 8:  return "high-floor"
    except:
        r = raw.lower()
        if "roof" in r or "penthouse" in r: return "penthouse"
        if "ground" in r:                   return "ground"
    return None

def parse_building_age(raw: str | None) -> str | None:
    if not raw: return None
    r = raw.lower()
    if "less" in r or "new" in r or "1 year" in r: return "new-building"
    if "5 year" in r or "3 year" in r:             return "recent"
    if "10+" in r or "old" in r:                   return "old-building"
    return None

def parse_view(title: str, description: str) -> list:
    text = f"{title} {description}".lower()
    views = []
    if any(w in text for w in ["sea view", "sea-view", "seaview", "sea front"]): views.append("sea")
    if any(w in text for w in ["mountain view", "mountain-view"]):                views.append("mountain")
    if any(w in text for w in ["city view", "city-view"]):                        views.append("city")
    if any(w in text for w in ["open view", "panoramic"]):                        views.append("open")
    if "garden" in text and "view" in text:                                        views.append("garden")
    return views[:3]

def parse_lifestyle(title: str, params: dict) -> list:
    text = title.lower()
    tags = []
    if any(w in text for w in ["luxury", "luxurious", "high-end", "high end"]): tags.append("luxury")
    if any(w in text for w in ["quiet", "calm", "peaceful"]):                   tags.append("quiet")
    if any(w in text for w in ["prime location", "prime"]):                     tags.append("prime-location")
    if any(w in text for w in ["gated", "compound"]):                           tags.append("gated")
    if any(w in text for w in ["investment", "roi"]):                           tags.append("investment")
    return list(set(tags))

def extract_listing_urls(html: str) -> list[str]:
    """Extract all listing URLs from a listing page."""
    urls = re.findall(r'href="(https://www\.olx\.com\.lb/ad/[^"]+)"', html)
    # Deduplicate while preserving order
    seen = set()
    result = []
    for url in urls:
        # Clean tracking params
        base = url.split('?')[0]
        if base not in seen and '/ad/' in base:
            seen.add(base)
            result.append(base)
    return result

class OLXScraper(BaseScraper):
    SOURCE = "olx"

    async def scrape(self, max_pages=10, progress=None):
        async with httpx.AsyncClient(
            headers=HEADERS,
            timeout=20,
            follow_redirects=True,
            limits=httpx.Limits(max_connections=30, max_keepalive_connections=20)
        ) as client:

            # Step 1: Fetch all listing pages in parallel (10 at a time)
            print(f"[OLX] Fetching {max_pages} listing pages in parallel...")
            page_sem = asyncio.Semaphore(10)

            async def fetch_page(page_num: int) -> list[str]:
                async with page_sem:
                    try:
                        resp = await client.get(
                            LISTING_URL,
                            params={"page": page_num},
                            timeout=15
                        )
                        if resp.status_code != 200:
                            return []
                        urls = extract_listing_urls(resp.text)
                        if progress:
                            progress.update(1, f"OLX page {page_num}/{max_pages}")
                        return urls
                    except Exception as e:
                        print(f"[OLX] Page {page_num} error: {e}")
                        return []

            page_results = await asyncio.gather(*[fetch_page(p) for p in range(1, max_pages + 1)])

            # Flatten and deduplicate
            all_urls = []
            seen = set()
            for urls in page_results:
                for url in urls:
                    if url not in seen:
                        seen.add(url)
                        all_urls.append(url)

            print(f"[OLX] Total unique listings: {len(all_urls)}")

            # Step 2: Fetch all detail pages in parallel (20 at a time)
            print(f"[OLX] Fetching detail pages...")
            detail_sem = asyncio.Semaphore(20)
            results = []

            async def fetch_detail(url: str) -> RawListing | None:
                async with detail_sem:
                    try:
                        await asyncio.sleep(0.05)  # tiny delay to avoid hammering
                        resp = await client.get(url, timeout=15)
                        if resp.status_code != 200:
                            return None
                        html = resp.text

                        params   = parse_params(html)
                        geo      = parse_geo(html)
                        region, area = parse_location(html)

                        # Title from page
                        title_m = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
                        title   = title_m.group(1).strip() if title_m else url.split('/')[-1]

                        # Description
                        desc_m = re.search(r'"description"\s*:\s*"((?:[^"\\]|\\.)*)"', html)
                        description = None
                        if desc_m:
                            try:
                                description = desc_m.group(1).encode().decode('unicode_escape')[:500]
                            except:
                                description = desc_m.group(1)[:500]

                        # Price — prefer params over card (has commas stripped)
                        price = None
                        if params.get("price"):
                            try: price = float(params["price"].replace(",", ""))
                            except: pass

                        # Size — strip commas e.g. "2,560" → 2560
                        size_sqm = None
                        if params.get("ft"):
                            try: size_sqm = float(params["ft"].replace(",", ""))
                            except: pass

                        # Image
                        img_m = re.search(r'"url"\s*:\s*"(https://[^"]+\.(?:jpg|jpeg|webp)[^"]*)"', html)
                        img_url = img_m.group(1) if img_m else None

                        # Views and lifestyle
                        views     = parse_view(title, description or "")
                        lifestyle = parse_lifestyle(title, params)

                        if not price:
                            return None  # Skip listings without price

                        listing = RawListing(
                            source=self.SOURCE,
                            url=url,
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

                    except Exception:
                        return None

            total_details = len(all_urls)
            completed = 0
            lock = asyncio.Lock()

            listings = await asyncio.gather(*[fetch_detail_tracked(url) for url in all_urls])
            results = [l for l in listings if l]

        with_coords = sum(1 for r in results if r.lat)
        print(f"[OLX] Total: {len(results)} | With coords: {with_coords}/{len(results)}")
        return results