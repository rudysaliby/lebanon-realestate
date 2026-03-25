from playwright.async_api import async_playwright
from .base import BaseScraper, RawListing
from .olx import extract_area
import asyncio, re

URLS = [
    ("https://www.realestate.com.lb/en/buy-properties-lebanon", "sale"),
    ("https://www.realestate.com.lb/en/rent-properties-lebanon", "monthly"),
]

class RealEstateLBScraper(BaseScraper):
    SOURCE = "realestate.com.lb"

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
                    url = f"{base_url}?pg={page_num}"
                    print(f"[RealEstateLB] {period} page {page_num}")
                    try:
                        page = await context.new_page()
                        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                        await page.wait_for_timeout(1500)

                        # Cards are MuiPaper-outlined containers
                        cards = await page.query_selector_all(".MuiPaper-outlined")
                        # Filter to only cards containing a property link
                        valid = []
                        for card in cards:
                            link = await card.query_selector(f"a[href*='{base_url.split('/en/')[1]}/']")
                            if link:
                                valid.append((card, link))

                        print(f"[RealEstateLB] Found {len(valid)} cards")

                        for card, link in valid:
                            try:
                                listing = await self._parse_card(card, link, period)
                                if listing: results.append(listing)
                            except Exception as e:
                                continue

                        await page.close()
                        await asyncio.sleep(1)
                    except Exception as e:
                        print(f"[RealEstateLB] Error: {e}")
            await browser.close()
        print(f"[RealEstateLB] Total: {len(results)}")
        return results

    async def _parse_card(self, card, link, period):
        url = await link.get_attribute("href")
        if not url: return None
        if not url.startswith("http"): url = f"https://www.realestate.com.lb{url}"

        full_text = (await card.inner_text()).strip()
        lines = [l.strip() for l in full_text.split("\n") if l.strip()]

        # Price
        price_raw = next((l for l in lines if "USD" in l or "$" in l), None)
        price = self.parse_price(price_raw)

        # Title: longest meaningful line
        skip = {"call","email","whatsapp","save","boosted","premium","featured","contact"}
        title = next((l for l in lines if len(l) > 20
                      and not any(s in l.lower() for s in skip)
                      and "USD" not in l and "$" not in l), None)

        # Size
        size_raw = next((l for l in lines if re.search(r'\d+\s*(sqm|m²|sq\.?\s*m)', l, re.I)), None)
        size = self.parse_size(size_raw) if size_raw else None

        # Location: line with comma
        location_raw = next((l for l in lines if "," in l and len(l) > 5
                             and "USD" not in l and not any(s in l.lower() for s in skip)), None)
        area = extract_area(location_raw or title)

        # Property type
        ptype = self.guess_property_type(title)
        type_kw = ["apartment","villa","townhouse","land","office","shop","chalet","duplex","studio"]
        explicit = next((l.lower() for l in lines if l.lower() in type_kw), None)
        if explicit: ptype = explicit

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
            property_type=ptype, size_sqm=size,
            image_url=img_url,
        )