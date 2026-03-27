"""
realestate.com.lb scraper using their Laravel API directly.
List API:   GET /laravel/api/member/properties?pg=N&sort=listing_level&ct=1&direction=asc
Detail API: GET /laravel/api/member/properties/{id}
"""
import asyncio
import httpx
from .base import BaseScraper, RawListing

BASE = "https://www.realestate.com.lb"
LIST_URL = f"{BASE}/laravel/api/member/properties"
DETAIL_URL = f"{BASE}/laravel/api/member/properties"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": "https://www.realestate.com.lb/",
}

PRICE_TYPE_MAP = {"USD": "sale", "USD/Month": "monthly", "USD/Year": "yearly"}

class RealEstateLBScraper(BaseScraper):
    SOURCE = "realestate.com.lb"

    async def scrape(self, max_pages=3):
        results = []
        async with httpx.AsyncClient(headers=HEADERS, timeout=20, follow_redirects=True) as client:

            # Fetch listing pages
            all_ids = []
            for page_num in range(1, max_pages + 1):
                print(f"[RELB] Fetching page {page_num}...")
                try:
                    resp = await client.get(LIST_URL, params={
                        "pg": page_num,
                        "sort": "listing_level",
                        "ct": 1,
                        "direction": "asc",
                    })
                    data = resp.json()
                    docs = data.get("data", {}).get("docs", [])
                    if not docs:
                        break
                    print(f"[RELB] Page {page_num}: {len(docs)} listings")
                    all_ids.extend([(d["id"], d) for d in docs])
                    await asyncio.sleep(0.5)
                except Exception as e:
                    print(f"[RELB] Page error: {e}")
                    break

            print(f"[RELB] Fetching details for {len(all_ids)} listings...")
            sem = asyncio.Semaphore(5)

            async def fetch_detail(prop_id, basic):
                async with sem:
                    try:
                        resp = await client.get(f"{DETAIL_URL}/{prop_id}")
                        d = resp.json().get("data") or resp.json()
                        await asyncio.sleep(0.2)

                        community = d.get("community") or {}
                        district = community.get("district") or {}
                        province = district.get("province") or {}

                        # Coordinates — prefer listing-level, fall back to community
                        lat = d.get("latitude") or community.get("latitude")
                        lng = d.get("longitude") or community.get("longitude")
                        if lat: lat = float(lat)
                        if lng: lng = float(lng)
                        # Validate Lebanon bounds
                        if lat and not (33.0 <= lat <= 34.7 and 35.1 <= lng <= 36.6):
                            lat = lng = None

                        area     = community.get("name_en")
                        subregion = district.get("name_en", "").replace(" district", "").replace(" District", "") or None
                        region   = province.get("name_en", "").replace(" Governorate", "").replace(" governorate", "") or None

                        # Build URL
                        url_path = basic.get("url") or d.get("url") or f"/buy-properties-lebanon/{d.get('reference','')}"
                        url = f"{BASE}{url_path}" if not url_path.startswith("http") else url_path

                        # Image
                        images = d.get("images") or basic.get("images") or []
                        img_url = images[0].get("url") if images else None

                        # Tags
                        amenities = [a.get("name_en") for a in (d.get("amenities") or []) if a.get("name_en")]
                        bedroom = d.get("bedroom") or {}
                        bathroom = d.get("bathroom") or {}

                        price_type = (d.get("price_type") or {}).get("name_en", "USD")
                        period = "monthly" if "Month" in price_type else "sale"

                        listing = RawListing(
                            source=self.SOURCE,
                            url=url,
                            title=d.get("title_en") or basic.get("title_en"),
                            description=(d.get("description_en") or "")[:500],
                            price=d.get("price") or basic.get("price"),
                            currency="USD",
                            price_period=period,
                            property_type=self.guess_property_type(d.get("title_en"), d.get("type", {}).get("name_en")),
                            size_sqm=float(d.get("area")) if d.get("area") else None,
                            location_raw=area or d.get("title_en"),
                            area=area,
                            subregion=subregion,
                            region=region,
                            lat=lat,
                            lng=lng,
                            image_url=img_url,
                        )

                        # Store extra tags for ai_tagger to pick up
                        listing._furnished = d.get("furnished")
                        listing._bedrooms  = int(bedroom.get("name_en", 0)) if bedroom.get("name_en", "").isdigit() else None
                        listing._bathrooms = int(bathroom.get("name_en", 0)) if bathroom.get("name_en", "").isdigit() else None
                        listing._amenities = amenities
                        listing._floor     = d.get("floor")

                        return listing
                    except Exception as e:
                        print(f"[RELB] Detail error for {prop_id}: {e}")
                        return None

            tasks = [fetch_detail(pid, basic) for pid, basic in all_ids]
            listings = await asyncio.gather(*tasks)
            results = [l for l in listings if l]

        print(f"[RELB] Total: {len(results)} listings")
        with_coords = sum(1 for r in results if r.lat)
        print(f"[RELB] With coords: {with_coords}/{len(results)}")
        return results

    def guess_property_type(self, title=None, type_name=None):
        if type_name:
            t = type_name.lower()
            if "apartment" in t or "flat" in t or "loft" in t: return "apartment"
            if "villa" in t or "house" in t or "townhouse" in t: return "villa"
            if "land" in t or "plot" in t: return "land"
            if "commercial" in t or "office" in t: return "commercial"
            if "chalet" in t: return "villa"
        return super().guess_property_type(title)
