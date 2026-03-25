import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from scrapers.olx import OLXScraper
from scrapers.realestateLB import RealEstateLBScraper
from geocoding import geocode_location
from db import upsert_listings
from enrich_locations import run_enrichment

async def run():
    print("=" * 50)
    print("Lebanon Real Estate Scraper - Starting")
    print("=" * 50)

    scrapers = [OLXScraper(), RealEstateLBScraper()]
    all_listings = []

    results = await asyncio.gather(
        *[s.scrape(max_pages=2) for s in scrapers],
        return_exceptions=True
    )

    for i, res in enumerate(results):
        name = scrapers[i].SOURCE
        if isinstance(res, Exception):
            print(f"[Runner] {name} failed: {res}")
        else:
            print(f"[Runner] {name}: {len(res)} listings")
            all_listings.extend(res)

    # Fast local geocoding first
    print(f"\n[Runner] Geocoding {len(all_listings)} listings...")
    sem = asyncio.Semaphore(10)
    done = 0

    async def geocode_one(listing):
        nonlocal done
        if listing.location_raw and not listing.lat:
            async with sem:
                listing.lat, listing.lng = await geocode_location(listing.location_raw)
        done += 1
        if done % 50 == 0:
            print(f"[Runner] Geocoded {done}/{len(all_listings)}...")

    await asyncio.gather(*[geocode_one(l) for l in all_listings])
    geocoded = sum(1 for l in all_listings if l.lat)
    print(f"[Runner] Geocoded {geocoded} with local lookup")

    print(f"\n[Runner] Saving to database...")
    saved = await upsert_listings(all_listings)
    print(f"[Runner] Saved {saved} listings")

    # AI enrichment for listings without coordinates
    print(f"\n[Runner] Running AI location enrichment...")
    await run_enrichment()

    print(f"\n{'=' * 50}")
    print(f"Done! {saved} listings saved, AI enrichment complete.")
    print(f"{'=' * 50}")

if __name__ == "__main__":
    asyncio.run(run())
