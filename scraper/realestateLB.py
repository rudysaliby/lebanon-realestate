from playwright.async_api import async_playwright
from .base import BaseScraper, RawListing
import asyncio, re

URLS = [
    ("https://www.realestate.com.lb/en/buy-properties-lebanon", "sale"),
    ("https://www.realestate.com.lb/en/rent-properties-lebanon", "monthly"),
]

class RealEstateLBScraper(BaseScraper):
    SOURCE = "realestate.com.lb"

    async def scrape(self, max_pages=2):
        results = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )

            for base_url, period in URLS:
                for page_num in range(1, max_pages + 1):
                    url = f"{base_url}?page={page_num}"
                    print(f"[RELB] {period} page {page_num}")
                    try:
                        page = await context.new_page()
                        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        await page.wait_for_timeout(2000)

                        # Cards use MuiPaper-outlined class
                        cards = await page.query_selector_all(".MuiPaper-outlined")
                        print(f"[RELB] Found {len(cards)} cards")

                        for card in cards:
                            try:
                                listing = await self._parse_card(card, period)
                                if listing:
                                    results.append(listing)
                            except:
                                continue
                        await page.close()
                        await asyncio.sleep(1)
                    except Exception as e:
                        print(f"[RELB] Error: {e}")

            # Visit detail pages for coordinates
            print(f"[RELB] Enriching {len(results)} listings from detail pages...")
            enriched = 0
            for listing in results:
                if listing.url:
                    try:
                        ok = await self._scrape_detail(listing, context)
                        if ok:
                            enriched += 1
                        await asyncio.sleep(0.5)
                    except:
                        pass
            print(f"[RELB] Got coords for {enriched}/{len(results)} listings")

            await browser.close()
        print(f"[RELB] Total: {len(results)}")
        return results

    async def _parse_card(self, card, period):
        link = await card.query_selector("a[href]")
        url = await link.get_attribute("href") if link else None
        if not url:
            return None
        if not url.startswith("http"):
            url = f"https://www.realestate.com.lb{url}"

        full_text = (await card.inner_text()).strip()
        lines = [l.strip() for l in full_text.split("\n") if l.strip()]

        title = next((l for l in lines if len(l) > 10), None)
        price_raw = next((l for l in lines if "$" in l or "USD" in l or "usd" in l.lower()), None)
        size_raw = next((l for l in lines if re.search(r'\d+\s*(sqm|m²|sq\s*m)', l, re.I)), None)

        img_el = await card.query_selector("img[src]")
        img_url = None
        if img_el:
            src = await img_el.get_attribute("src")
            if src and src.startswith("http") and "placeholder" not in src.lower():
                img_url = src

        return RawListing(
            source=self.SOURCE, url=url, title=title,
            price=self.parse_price(price_raw), price_period=period,
            location_raw=title, area=None,
            property_type=self.guess_property_type(title),
            size_sqm=self.parse_size(size_raw),
            image_url=img_url,
        )

    async def _scrape_detail(self, listing, context):
        """Extract coords + area from community JSON in page scripts."""
        try:
            page = await context.new_page()
            await page.goto(listing.url, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(1500)

            html = await page.content()

            # Pattern: "community":{"id":...,"name_en":"El Biyada","latitude":"33.91465","longitude":"35.60766"
            community_match = re.search(
                r'"community"\s*:\s*\{[^}]*"name_en"\s*:\s*"([^"]+)"[^}]*"latitude"\s*:\s*"([\d.]+)"[^}]*"longitude"\s*:\s*"([\d.]+)"',
                html
            )
            if community_match:
                area = community_match.group(1)
                lat = float(community_match.group(2))
                lng = float(community_match.group(3))
                if 33.0 <= lat <= 34.7 and 35.1 <= lng <= 36.6:
                    listing.area = area
                    listing.lat = lat
                    listing.lng = lng

            # Also try district for subregion
            district_match = re.search(
                r'"district"\s*:\s*\{[^}]*"name_en"\s*:\s*"([^"]+)"',
                html
            )
            if district_match:
                listing.subregion = district_match.group(1).replace(" district", "").replace(" District", "")

            # Get description
            desc_el = await page.query_selector("[class*='description'], [class*='Description']")
            if desc_el:
                listing.description = (await desc_el.inner_text()).strip()[:500]

            await page.close()
            return listing.lat is not None

        except Exception as e:
            return False
