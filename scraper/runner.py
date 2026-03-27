import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from scrapers.olx import OLXScraper
from scrapers.realestateLB import RealEstateLBScraper
from db import upsert_listings
from enrich_all import run_enrichment

async def run():
    print("=" * 50)
    print("Lebanon Real Estate Scraper - Starting")
    print("=" * 50)

    # OLX: 10 pages × 45 cards = ~450 listings
    # realestate.com.lb: all pages (2598 total, 20/page = 130 pages)
    scraper_configs = [
        (OLXScraper(), 10),
        (RealEstateLBScraper(), 130),
    ]

    all_listings = []

    results = await asyncio.gather(
        *[s.scrape(max_pages=pages) for s, pages in scraper_configs],
        return_exceptions=True
    )

    for i, res in enumerate(results):
        name = scraper_configs[i][0].SOURCE
        if isinstance(res, Exception):
            print(f"[Runner] {name} failed: {res}")
        else:
            print(f"[Runner] {name}: {len(res)} listings")
            all_listings.extend(res)

    with_coords = sum(1 for l in all_listings if l.lat)
    print(f"\n[Runner] {len(all_listings)} listings scraped, {with_coords} with coordinates")

    print(f"\n[Runner] Saving to database...")
    saved = await upsert_listings(all_listings)
    print(f"[Runner] Saved {saved} listings")

    print(f"\n[Runner] Running enrichment for listings without coordinates...")
    await run_enrichment()

    print(f"\n{'=' * 50}")
    print(f"Done! {saved} listings saved.")
    print(f"{'=' * 50}")

if __name__ == "__main__":
    asyncio.run(run())