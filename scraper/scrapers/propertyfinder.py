from playwright.async_api import async_playwright
from .base import BaseScraper, RawListing
from .olx import extract_area
import asyncio

class PropertyFinderScraper(BaseScraper):
    SOURCE = "propertyfinder"
    BASE_URL = "https://www.propertyfinder.com.lb/en/buy/properties-for-sale.html"
    RENT_URL = "https://www.propertyfinder.com.lb/en/rent/properties-for-rent.html"

    async def scrape(self, max_pages: int = 5) -> list[RawListing]:
        results = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )

            for base_url, period in [(self.BASE_URL, "sale"), (self.RENT_URL, "monthly")]:
                for page_num in range(1, max_pages + 1):
                    url = f"{base_url}?page={page_num}"
                    print(f"[PropFinder] Scraping {period} page {page_num}")
                    try:
                        page = await context.new_page()
                        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        await page.wait_for_timeout(2000)

                        cards = await page.query_selector_all("[data-testid='property-card']")
                        if not cards:
                            cards = await page.query_selector_all(".property-card")

                        print(f"[PropFinder] Found {len(cards)} cards")

                        for card in cards:
                            try:
                                listing = await self._parse_card(card, period)
                                if listing:
                                    results.append(listing)
                            except Exception as e:
                                print(f"[PropFinder] Card error: {e}")
                                continue

                        await page.close()
                        await asyncio.sleep(1.5)

                    except Exception as e:
                        print(f"[PropFinder] Page error: {e}")
                        continue

            await browser.close()

        print(f"[PropFinder] Total listings: {len(results)}")
        return results

    async def _parse_card(self, card, period: str) -> RawListing | None:
        link_el = await card.query_selector("a[href]")
        url = await link_el.get_attribute("href") if link_el else None
        if not url:
            return None
        if not url.startswith("http"):
            url = f"https://www.propertyfinder.com.lb{url}"

        title_el = await card.query_selector("h2, h3, [data-testid='property-name']")
        price_el = await card.query_selector("[data-testid='property-price'], .price")
        loc_el   = await card.query_selector("[data-testid='property-location'], .location")
        size_el  = await card.query_selector("[data-testid='property-size'], .size, [aria-label*='sqm']")
        type_el  = await card.query_selector("[data-testid='property-type'], .property-type")

        title        = (await title_el.inner_text()).strip() if title_el else None
        price_raw    = (await price_el.inner_text()).strip() if price_el else None
        location_raw = (await loc_el.inner_text()).strip() if loc_el else None
        size_raw     = (await size_el.inner_text()).strip() if size_el else None
        type_raw     = (await type_el.inner_text()).strip() if type_el else None

        price = self.parse_price(price_raw)
        size  = self.parse_size(size_raw)
        area  = extract_area(location_raw)
        ptype = type_raw.lower() if type_raw else self.guess_property_type(title)

        return RawListing(
            source=self.SOURCE,
            url=url,
            title=title,
            price=price,
            currency="USD",
            price_period=period,
            location_raw=location_raw,
            area=area,
            property_type=ptype,
            size_sqm=size,
        )
