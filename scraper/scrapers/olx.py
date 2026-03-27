from playwright.async_api import async_playwright
from .base import BaseScraper, RawListing
import asyncio, re

URLS = [
    ("https://www.olx.com.lb/properties/apartments-villas-for-sale/", "sale"),
]

class OLXScraper(BaseScraper):
    SOURCE = "olx"

    async def scrape(self, max_pages=1):
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
                                if listing:
                                    results.append(listing)
                            except:
                                continue
                        await page.close()
                        await asyncio.sleep(1)
                    except Exception as e:
                        print(f"[OLX] Error: {e}")

            # Visit detail pages in parallel batches of 5
            print(f"[OLX] Visiting detail pages for {len(results)} listings...")
            enriched = 0
            sem = asyncio.Semaphore(5)

            async def fetch_detail(listing):
                nonlocal enriched
                async with sem:
                    try:
                        ok = await self._scrape_detail(listing, context)
                        if ok:
                            enriched += 1
                        await asyncio.sleep(0.3)
                    except:
                        pass

            await asyncio.gather(*[fetch_detail(l) for l in results if l.url])
            print(f"[OLX] Got coords for {enriched}/{len(results)} listings")

            await browser.close()
        print(f"[OLX] Total: {len(results)}")
        return results

    async def _parse_card(self, card, period):
        link = await card.query_selector("a[href]")
        url = await link.get_attribute("href") if link else None
        if not url:
            return None
        if not url.startswith("http"):
            url = f"https://www.olx.com.lb{url}"

        full_text = (await card.inner_text()).strip()
        lines = [l.strip() for l in full_text.split("\n") if l.strip()]

        title     = next((l for l in lines if len(l) > 15 and "USD" not in l and "$" not in l), None)
        price_raw = next((l for l in lines if "USD" in l or "$" in l), None)
        size_raw  = next((l for l in lines if re.search(r'\d+\s*(sqm|m²|sq)', l, re.I)), None)

        img_el = await card.query_selector("img[src]")
        img_url = None
        if img_el:
            src = await img_el.get_attribute("src")
            if src and src.startswith("http") and "placeholder" not in src.lower() and not src.endswith(".svg"):
                img_url = src

        return RawListing(
            source=self.SOURCE,
            url=url,
            title=title,
            price=self.parse_price(price_raw),
            price_period=period,
            location_raw=title,
            area=None,
            property_type=self.guess_property_type(title),
            size_sqm=self.parse_size(size_raw),
            image_url=img_url,
        )

    async def _scrape_detail(self, listing, context):
        """Extract coords, location hierarchy, and description from OLX detail page."""
        try:
            page = await context.new_page()
            await page.goto(listing.url, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(1000)

            html = await page.content()

            # 1. Coordinates from "geography":{"lat":...,"lng":...}
            geo_match = re.search(
                r'"geography"\s*:\s*\{"lat"\s*:([\d.]+)\s*,\s*"lng"\s*:([\d.]+)',
                html
            )
            if geo_match:
                lat = float(geo_match.group(1))
                lng = float(geo_match.group(2))
                if 33.0 <= lat <= 34.7 and 35.1 <= lng <= 36.6:
                    listing.lat = lat
                    listing.lng = lng

            # 2. Location hierarchy: ["Lebanon", "Metn", "Rabweh"]
            loc_match = re.search(r'"location"\s*:\s*\[(.*?)\]', html, re.DOTALL)
            if loc_match:
                names = re.findall(r'"name"\s*:\s*"([^"]+)"', loc_match.group(1))
                if len(names) >= 3:
                    listing.subregion = names[1]
                    listing.area      = names[2]
                elif len(names) == 2:
                    listing.area = names[1]

            # 3. Description
            desc_el = await page.query_selector("[data-aut-id='itemDescription']")
            if desc_el:
                listing.description = (await desc_el.inner_text()).strip()[:500]

            await page.close()
            return listing.lat is not None

        except Exception:
            try:
                await page.close()
            except:
                pass
            return False