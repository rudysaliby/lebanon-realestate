import asyncio
import os
from scrapers.olx import OLXScraper
from scrapers.propertyfinder import PropertyFinderScraper
from geocoding import geocode_location
from db import upsert_listings

async def run():
    print("=" * 50)
    print("Lebanon Real Estate Scraper - Starting")
    print("=" * 50)

    scrapers = [OLXScraper(), PropertyFinderScraper()]
    all_listings = []

    for scraper in scrapers:
        print(f"\n[Runner] Starting {scraper.SOURCE} scraper...")
        try:
            listings = await scraper.scrape(max_pages=3)
            all_listings.extend(listings)
            print(f"[Runner] {scraper.SOURCE}: {len(listings)} listings")
        except Exception as e:
            print(f"[Runner] {scraper.SOURCE} failed: {e}")

    print(f"\n[Runner] Geocoding {len(all_listings)} listings...")
    geocoded = 0
    for listing in all_listings:
        if listing.location_raw and not listing.lat:
            listing.lat, listing.lng = await geocode_location(listing.location_raw)
            if listing.lat:
                geocoded += 1

    print(f"[Runner] Geocoded {geocoded} listings")
    print(f"\n[Runner] Saving to database...")
    saved = await upsert_listings(all_listings)

    print(f"\n{'=' * 50}")
    print(f"Done! {saved} listings saved to database.")
    print(f"{'=' * 50}")

if __name__ == "__main__":
    asyncio.run(run())
