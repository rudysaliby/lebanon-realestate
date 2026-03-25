from playwright.async_api import async_playwright
from .base import BaseScraper, RawListing
from .olx import extract_area
import asyncio

class RealEstateLBScraper(BaseScraper):
    SOURCE = "realestate.com.lb"
    SALE_URL = "https://www.realestate.com.lb/en/buy-properties-lebanon"
    RENT_URL = "https://www.realestate.com.lb/en/rent-properties-lebanon"

    async def scrape(self, max_pages: int = 5) -> list[RawListing]:
        results = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )

            for base_url, period in [(self.SALE_URL, "sale"), (self.RENT_URL, "monthly")]:
                for page_num in range(1, max_pages + 1):
                    url = f"{base_url}?page={page_num}"
                    print(f"[RealEstateLB] Scraping {period} page {page_num}")
                    try:
                        page = await context.new_page()
                        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        await page.wait_for_timeout(2500)

                        # Try multiple possible card selectors
                        cards = await page.query_selector_all(".property-card")
                        if not cards:
                            cards = await page.query_selector_all("[class*='property-item']")
                        if not cards:
                            cards = await page.query_selector_all("[class*='listing-card']")
                        if not cards:
                            cards = await page.query_selector_all("article")

                        print(f"[RealEstateLB] Found {len(cards)} cards on page {page_num}")

                        for card in cards:
                            try:
                                listing = await self._parse_card(card, period)
                                if listing:
                                    results.append(listing)
                            except Exception as e:
                                print(f"[RealEstateLB] Card error: {e}")
                                continue

                        await page.close()
                        await asyncio.sleep(2)

                    except Exception as e:
                        print(f"[RealEstateLB] Page error: {e}")
                        continue

            await browser.close()

        print(f"[RealEstateLB] Total: {len(results)} listings")
        return results

    async def _parse_card(self, card, period: str) -> RawListing | None:
        # Get URL
        link = await card.query_selector("a[href]")
        url = await link.get_attribute("href") if link else None
        if not url:
            return None
        if not url.startswith("http"):
            url = f"https://www.realestate.com.lb{url}"

        # Title
        for sel in ["h2", "h3", ".title", "[class*='title']", ".property-name"]:
            el = await card.query_selector(sel)
            if el:
                title = (await el.inner_text()).strip()
                break
        else:
            title = None

        # Price
        for sel in [".price", "[class*='price']", "[class*='Price']"]:
            el = await card.query_selector(sel)
            if el:
                price_raw = (await el.inner_text()).strip()
                break
        else:
            price_raw = None

        # Location
        for sel in [".location", "[class*='location']", "[class*='area']", ".address"]:
            el = await card.query_selector(sel)
            if el:
                loc_raw = (await el.inner_text()).strip()
                break
        else:
            loc_raw = None

        # Size
        for sel in ["[class*='size']", "[class*='sqm']", "[aria-label*='m']"]:
            el = await card.query_selector(sel)
            if el:
                size_raw = (await el.inner_text()).strip()
                break
        else:
            size_raw = None

        # Image
        img_url = None
        for sel in ["img[src]", "img[data-src]"]:
            el = await card.query_selector(sel)
            if el:
                img_url = await el.get_attribute("src") or await el.get_attribute("data-src")
                if img_url and img_url.startswith("http") and not "placeholder" in img_url.lower():
                    break
                img_url = None

        price = self.parse_price(price_raw)
        size  = self.parse_size(size_raw)
        area  = extract_area(loc_raw)
        ptype = self.guess_property_type(title)

        return RawListing(
            source=self.SOURCE,
            url=url,
            title=title,
            price=price,
            currency="USD",
            price_period=period,
            location_raw=loc_raw,
            area=area,
            property_type=ptype,
            size_sqm=size,
            image_url=img_url,
        )
