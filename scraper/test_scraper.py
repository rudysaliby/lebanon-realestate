"""
Quick test — scrapes 2 pages per category to verify everything works.
Run: python test_scraper.py
"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

async def test():
    print("=" * 55)
    print("Testing OLX scraper (2 pages per category)...")
    print("=" * 55)

    try:
        from scrapers.olx import OLXScraper
        results = await OLXScraper().scrape(max_pages=2)
        with_coords = sum(1 for l in results if l.lat)
        sale = [l for l in results if l.price_period == "sale"]
        rent = [l for l in results if l.price_period == "monthly"]
        land = [l for l in results if l.property_type == "land"]
        suspect = [l for l in results if l._price_suspect]

        print(f"\nTotal listings:  {len(results)}")
        print(f"With coords:     {with_coords} ({round(with_coords/max(len(results),1)*100)}%)")
        print(f"For sale:        {len(sale)}")
        print(f"For rent:        {len(rent)}")
        print(f"Land:            {len(land)}")
        print(f"Suspect prices:  {len(suspect)}")

        if results:
            r = results[0]
            print(f"\nSample listing:")
            print(f"  Title:    {r.title[:60]}")
            print(f"  Price:    ${r.price:,.0f} ({r.price_period})")
            print(f"  Type:     {r.property_type}")
            print(f"  Size:     {r.size_sqm} sqm")
            print(f"  Area:     {r.area}, {r.region}")
            print(f"  Coords:   {r.lat}, {r.lng}")
            print(f"  Beds:     {r._bedrooms} | Baths: {r._bathrooms}")
            print(f"  Furnished:{r._furnished}")
            print(f"  Condition:{r._condition}")
            print(f"  Floor:    {r._floor}")
            print(f"  Payment:  {r._payment}")

    except Exception as e:
        import traceback
        print(f"ERROR: {e}")
        traceback.print_exc()

asyncio.run(test())