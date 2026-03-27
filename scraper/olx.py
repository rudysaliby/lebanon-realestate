from playwright.async_api import async_playwright
from .base import BaseScraper, RawListing
import asyncio, re

AREA_KEYWORDS = [
    "Beirut","Hamra","Verdun","Achrafieh","Gemmayzeh","Mar Mikhael","Badaro","Sodeco",
    "Jounieh","Jdeideh","Dbayeh","Kaslik","Baabda","Hazmieh","Broummana","Beit Mery",
    "Dekwaneh","Sin El Fil","Metn","Antelias","Zalka","Dora","Naccache","Rabieh",
    "Rabweh","Tripoli","Saida","Sidon","Tyre","Sour","Zahle","Jbeil","Byblos","Batroun",
    "Koura","Zgharta","Chouf","Aley","Bhamdoun","Sawfar","Faraya","Faqra","Ajaltoun",
    "Ballouneh","Mtayleb","Kfarhbab","Dik El Mehdi","Mansourieh","Keserwan","Kesrouan",
    "Cornet Chehwan","Cornet El Hamra","Sheileh","Adma","Dbaye","Sarba",
]

def extract_area(text):
    if not text: return None
    for area in AREA_KEYWORDS:
        if area.lower() in text.lower():
            return area
    return None

URLS = [
    ("https://www.olx.com.lb/properties/apartments-villas-for-sale/", "sale"),
    ("https://www.olx.com.lb/properties/apartments-villas-for-rent/", "monthly"),
]

class OLXScraper(BaseScraper):
    SOURCE = "olx"

    async def scrape(self, max_pages=2):
        results = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width":1280,"height":800}
            )
            for base_url, period in URLS:
                for page_num in range(1, max_pages+1):
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
                                listing = await self._parse_card(card, period)
                                if listing: results.append(listing)
                            except: continue
                        await page.close()
                        await asyncio.sleep(1)
                    except Exception as e:
                        print(f"[OLX] Error: {e}")

            # Scrape detail pages for coordinates
            print(f"[OLX] Scraping detail pages for coordinates...")
            for listing in results:
                if not listing.lat and listing.url:
                    try:
                        await self._scrape_detail(listing, context)
                        await asyncio.sleep(0.5)
                    except: pass

            await browser.close()
        print(f"[OLX] Total: {len(results)}")
        return results

    async def _parse_card(self, card, period):
        link = await card.query_selector("a[href]")
        url  = await link.get_attribute("href") if link else None
        if not url: return None
        if not url.startswith("http"): url = f"https://www.olx.com.lb{url}"

        full_text = (await card.inner_text()).strip()
        lines = [l.strip() for l in full_text.split("\n") if l.strip()]

        title     = next((l for l in lines if len(l) > 15 and "USD" not in l and "$" not in l), None)
        price_raw = next((l for l in lines if "USD" in l or "$" in l), None)
        size_raw  = next((l for l in lines if re.search(r'\d+\s*(sqm|m²|sq)', l, re.I)), None)

        img_el  = await card.query_selector("img[src]")
        img_url = None
        if img_el:
            src = await img_el.get_attribute("src")
            if src and src.startswith("http") and "placeholder" not in src.lower() and not src.endswith(".svg"):
                img_url = src

        return RawListing(
            source=self.SOURCE, url=url, title=title,
            price=self.parse_price(price_raw), price_period=period,
            location_raw=title, area=extract_area(title),
            property_type=self.guess_property_type(title),
            size_sqm=self.parse_size(size_raw),
            image_url=img_url,
        )

    async def _scrape_detail(self, listing, context):
        """Visit listing detail page to get embedded map coordinates."""
        try:
            page = await context.new_page()
            await page.goto(listing.url, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(1500)

            # Try to get coordinates from map embed or meta tags
            # OLX embeds coordinates in the page as JSON-LD or data attributes
            coords = await page.evaluate("""() => {
                // Try JSON-LD structured data
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                for (const s of scripts) {
                    try {
                        const data = JSON.parse(s.textContent);
                        if (data.geo) return {lat: data.geo.latitude, lng: data.geo.longitude};
                        if (data['@graph']) {
                            for (const item of data['@graph']) {
                                if (item.geo) return {lat: item.geo.latitude, lng: item.geo.longitude};
                            }
                        }
                    } catch(e) {}
                }
                // Try window.__NEXT_DATA__ or similar
                try {
                    const nd = window.__NEXT_DATA__;
                    const str = JSON.stringify(nd);
                    const m = str.match(/"latitude":([\d.]+),"longitude":([\d.]+)/);
                    if (m) return {lat: parseFloat(m[1]), lng: parseFloat(m[2])};
                } catch(e) {}
                // Try meta tags
                const lat = document.querySelector('meta[property="place:location:latitude"]');
                const lng = document.querySelector('meta[property="place:location:longitude"]');
                if (lat && lng) return {lat: parseFloat(lat.content), lng: parseFloat(lng.content)};
                return null;
            }""")

            if coords and coords.get('lat') and coords.get('lng'):
                lat, lng = float(coords['lat']), float(coords['lng'])
                if 33.0 <= lat <= 34.7 and 35.1 <= lng <= 36.6:
                    listing.lat = lat
                    listing.lng = lng
                    print(f"  [OLX Detail] Got coords for '{listing.title[:40]}': {lat:.4f},{lng:.4f}")

            # Also get description for AI tagging
            desc_el = await page.query_selector("[data-aut-id='itemDescription']")
            if desc_el:
                listing.description = (await desc_el.inner_text()).strip()[:500]

            await page.close()
        except Exception as e:
            pass
