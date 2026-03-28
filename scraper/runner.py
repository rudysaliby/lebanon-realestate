import asyncio
import os
import httpx
from dotenv import load_dotenv
load_dotenv()

from scrapers.olx import OLXScraper
from scrapers.realestateLB import RealEstateLBScraper
from db import upsert_listings
from enrich_all import run_enrichment

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]
HEADERS_SB = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

async def cleanup_unlocatable():
    """Delete listings that still have no coords AND no area after enrichment — unsaveable."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/listings",
            headers=HEADERS_SB,
            params={
                "is_active": "eq.true",
                "lat": "is.null",
                "area": "is.null",
            }
        )
        if resp.status_code in (200, 204):
            print(f"[Cleanup] Removed unlocatable listings (no coords, no area)")
        else:
            print(f"[Cleanup] Error: {resp.status_code} {resp.text[:100]}")

async def run():
    print("=" * 50)
    print("Lebanon Real Estate Scraper - Starting")
    print("=" * 50)

    scraper_configs = [
        (OLXScraper(),          100),   # 100 pages × 45 cards = ~4,500 listings
        (RealEstateLBScraper(), 9999),  # auto-stops at last page (~2,607 listings)
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

    print(f"\n[Runner] Running enrichment...")
    await run_enrichment()

    print(f"\n[Runner] Cleaning up unlocatable listings...")
    await cleanup_unlocatable()

    print(f"\n{'=' * 50}")
    print(f"Done! {saved} listings saved.")
    print(f"{'=' * 50}")

if __name__ == "__main__":
    asyncio.run(run())