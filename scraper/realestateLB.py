"""
realestate.com.lb scraper.
Uses _next/data API for full property details including community coords.
This endpoint works with ANY reference format (numeric or alphanumeric).
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

def validate_lb(lat, lng) -> bool:
    try:
        return 33.0 <= float(lat) <= 34.7 and 35.1 <= float(lng) <= 36.6
    except:
        return False

async def get_build_hash(client: httpx.AsyncClient) -> str | None:
    """Get Next.js build hash from homepage — needed for _next/data API."""
    try:
        resp = await client.get(BASE, timeout=10)
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

            # Get build hash for _next/data API
            build_hash = await get_build_hash(client)
            if build_hash:
                print(f"[RELB] Build hash: {build_hash}")
            else:
                print(f"[RELB] Warning: could not get build hash, will use detail API fallback")

            # Fetch listing pages
            all_listings = []
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
                    all_listings.extend(docs)
                    await asyncio.sleep(0.3)
                except Exception as e:
                    print(f"[RELB] Page error: {e}")
                    break

            print(f"[RELB] Fetching details for {len(all_listings)} listings...")
            sem = asyncio.Semaphore(8)

            async def fetch_detail(basic):
                async with sem:
                    try:
                        await asyncio.sleep(0.1)
                        url_path = basic.get("url", "")
                        url = f"{BASE}{url_path}" if not url_path.startswith("http") else url_path
                        # Ensure /en/ prefix
                        page_url = url.replace(f"{BASE}/buy-", f"{BASE}/en/buy-").replace(f"{BASE}/rent-", f"{BASE}/en/rent-")
                        if "/en/" not in page_url:
                            page_url = page_url.replace(BASE + "/", BASE + "/en/")

                        prop = None

                        # Method 1: _next/data API (best — full data, all references work)
                        if build_hash:
                            next_url = f"{BASE}/_next/data/{build_hash}/en{url_path}.json"
                            try:
                                resp = await client.get(next_url, timeout=10)
                                if resp.status_code == 200:
                                    ndata = resp.json()
                                    prop = ndata.get("pageProps", {}).get("property")
                            except:
                                pass

                        # Method 2: Numeric ID detail API fallback
                        if not prop and basic.get("id"):
                            try:
                                resp = await client.get(f"{BASE}/laravel/api/member/properties/{basic['id']}", timeout=10)
                                if resp.status_code == 200:
                                    raw = resp.json()
                                    prop = raw.get("data") or raw
                            except:
                                pass

                        if not prop:
                            return None

                        # Extract coords: community → district → province
                        community = prop.get("community") or {}
                        district  = community.get("district") or {}
                        province  = district.get("province") or {}

                        lat = lng = None
                        area = subregion = region = None

                        if community.get("latitude") and validate_lb(community["latitude"], community.get("longitude",0)):
                            lat, lng  = float(community["latitude"]), float(community["longitude"])
                            area      = community.get("name_en")
                            subregion = district.get("name_en","").replace(" district","").replace(" District","") or None
                            region    = province.get("name_en","").replace(" Governorate","") or None

                        elif district.get("latitude") and validate_lb(district["latitude"], district.get("longitude",0)):
                            lat, lng  = float(district["latitude"]), float(district["longitude"])
                            subregion = district.get("name_en","").replace(" district","").replace(" District","") or None
                            region    = province.get("name_en","").replace(" Governorate","") or None

                        elif province.get("latitude") and validate_lb(province["latitude"], province.get("longitude",0)):
                            lat, lng = float(province["latitude"]), float(province["longitude"])
                            region   = province.get("name_en","").replace(" Governorate","") or None

                        # Area name fallback from URL
                        if not area:
                            m = re.search(r'for-(?:sale|rent)-(.+?)-lebanon', url_path)
                            if m:
                                area = m.group(1).replace('-', ' ').title()

                        # Listing-level coords (some agents pin exactly)
                        if not lat and prop.get("latitude") and validate_lb(prop["latitude"], prop.get("longitude",0)):
                            lat, lng = float(prop["latitude"]), float(prop["longitude"])

                        # Build listing
                        images    = prop.get("images") or basic.get("images") or []
                        img_url   = images[0].get("url") if images else None
                        amenities = [a.get("name_en") for a in (prop.get("amenities") or []) if a.get("name_en")]
                        bedroom   = prop.get("bedroom") or {}
                        bathroom  = prop.get("bathroom") or {}
                        price_type_name = (prop.get("price_type") or {}).get("name_en", "USD")
                        period    = "monthly" if "Month" in price_type_name else "sale"
                        type_name = (prop.get("type") or prop.get("category") or {}).get("name_en")
                        furnished = prop.get("furnished")

                        listing = RawListing(
                            source=self.SOURCE,
                            url=url,
                            title=prop.get("title_en") or basic.get("title_en"),
                            description=(prop.get("description_en") or "")[:500],
                            price=prop.get("price") or basic.get("price"),
                            currency="USD",
                            price_period=period,
                            property_type=self.guess_property_type(prop.get("title_en"), type_name),
                            size_sqm=float(prop["area"]) if prop.get("area") else None,
                            location_raw=area or prop.get("title_en"),
                            area=area,
                            subregion=subregion,
                            region=region,
                            lat=lat,
                            lng=lng,
                            image_url=img_url,
                            _furnished=furnished,
                            _bedrooms=int(bedroom["name_en"]) if str(bedroom.get("name_en","")).isdigit() else None,
                            _bathrooms=int(bathroom["name_en"]) if str(bathroom.get("name_en","")).isdigit() else None,
                            _amenities=amenities if amenities else None,
                            _floor=prop.get("floor"),
                        )
                        return listing

                    except Exception as e:
                        return None

            tasks = [fetch_detail(doc) for doc in all_listings]
            listings = await asyncio.gather(*tasks)
            results = [l for l in listings if l]

        with_coords = sum(1 for r in results if r.lat)
        print(f"[RELB] Total: {len(results)} | With coords: {with_coords}/{len(results)}")
        return results