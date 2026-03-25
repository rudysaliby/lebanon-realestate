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
]

def extract_area(text):
    if not text: return None
    for area in AREA_KEYWORDS:
        if area.lower() in text.lower():
            return area
    return text.split(",")[0].strip()[:50] if text else None

URLS = [
    ("https://www.olx.com.lb/properties/apartments-villas-for-sale/", "sale")
]

class OLXScraper(BaseScraper):
    SOURCE = "olx"

    async def scrape(self, max_pages=3):
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
                        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                        await page.wait_for_timeout(1500)

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
            await browser.close()
        print(f"[OLX] Total: {len(results)}")
        return results

    async def _parse_card(self, card, period):
        # Link
        link = await card.query_selector("a[href]")
        url  = await link.get_attribute("href") if link else None
        if not url: return None
        if not url.startswith("http"): url = f"https://www.olx.com.lb{url}"

        # Full text for parsing
        full_text = (await card.inner_text()).strip()
        lines = [l.strip() for l in full_text.split("\n") if l.strip()]

        # Title: longest line that isn't a price
        title = next((l for l in lines if len(l) > 15 and "USD" not in l and "$" not in l), None)

        # Price: line containing USD or $
        price_raw = next((l for l in lines if "USD" in l or "$" in l), None)
        price = self.parse_price(price_raw)

        # Size: line containing sqm or m²
        size_raw = next((l for l in lines if re.search(r'\d+\s*(sqm|m²|sq)', l, re.I)), None)
        size = self.parse_size(size_raw) if size_raw else None

        # Location: extract from title text
        location_raw = title
        area = extract_area(title) if title else None

        # Image
        img_el = await card.query_selector("img[src]")
        img_url = None
        if img_el:
            src = await img_el.get_attribute("src")
            if src and src.startswith("http") and "placeholder" not in src.lower() and not src.endswith(".svg"):
                img_url = src

        return RawListing(
            source=self.SOURCE, url=url, title=title,
            price=price, price_period=period,
            location_raw=location_raw, area=area,
            property_type=self.guess_property_type(title),
            size_sqm=size, image_url=img_url,
        )
