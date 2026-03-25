from playwright.async_api import async_playwright
from .base import BaseScraper, RawListing
import asyncio

AREA_KEYWORDS = [
    "Beirut", "Hamra", "Verdun", "Achrafieh", "Gemmayzeh", "Mar Mikhael",
    "Jounieh", "Jdeideh", "Dbayeh", "Kaslik", "Baabda", "Hazmieh",
    "Broummana", "Beit Mery", "Metn", "Dekwaneh", "Sin El Fil",
    "Tripoli", "Saida", "Sidon", "Tyre", "Sour", "Zahle",
    "Jbeil", "Byblos", "Batroun", "Koura", "Zgharta",
    "Chouf", "Aley", "Bhamdoun", "Sawfar",
]

def extract_area(text: str | None) -> str | None:
    if not text:
        return None
    for area in AREA_KEYWORDS:
        if area.lower() in text.lower():
            return area
    return text.split(",")[0].strip() if text else None

class OLXScraper(BaseScraper):
    SOURCE = "olx"
    BASE_URL = "https://www.olx.com.lb/real-estate_c1484"

    async def scrape(self, max_pages: int = 5) -> list[RawListing]:
        results = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )
            for page_num in range(1, max_pages + 1):
                url = f"{self.BASE_URL}?page={page_num}"
                print(f"[OLX] Scraping page {page_num}: {url}")
                try:
                    page = await context.new_page()
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(2000)

                    cards = await page.query_selector_all("li[data-aut-id='itemBox']")
                    if not cards:
                        cards = await page.query_selector_all("[data-aut-id='itemBox']")

                    print(f"[OLX] Found {len(cards)} cards on page {page_num}")

                    for card in cards:
                        try:
                            listing = await self._parse_card(card)
                            if listing:
                                results.append(listing)
                        except Exception as e:
                            print(f"[OLX] Card parse error: {e}")
                            continue

                    await page.close()
                    await asyncio.sleep(1.5)

                except Exception as e:
                    print(f"[OLX] Page {page_num} error: {e}")
                    continue

            await browser.close()

        print(f"[OLX] Total listings scraped: {len(results)}")
        return results

    async def _parse_card(self, card) -> RawListing | None:
        title_el  = await card.query_selector("[data-aut-id='itemTitle']")
        price_el  = await card.query_selector("[data-aut-id='itemPrice']")
        loc_el    = await card.query_selector("[data-aut-id='item-location']")
        link_el   = await card.query_selector("a[href]")

        title = (await title_el.inner_text()).strip() if title_el else None
        url   = await link_el.get_attribute("href") if link_el else None

        if not url:
            return None
        if not url.startswith("http"):
            url = f"https://www.olx.com.lb{url}"

        price_raw    = (await price_el.inner_text()).strip() if price_el else None
        location_raw = (await loc_el.inner_text()).strip() if loc_el else None

        price = self.parse_price(price_raw)
        area  = extract_area(location_raw)
        ptype = self.guess_property_type(title)

        return RawListing(
            source=self.SOURCE,
            url=url,
            title=title,
            price=price,
            currency="USD",
            location_raw=location_raw,
            area=area,
            property_type=ptype,
        )
