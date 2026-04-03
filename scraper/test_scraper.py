"""
Test script — runs each scraper for enough pages to get ~150 listings.
Run: python test_scraper.py
"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

async def test():
    print("=" * 55)
    print("Testing RELB scraper (8 pages = ~160 listings)...")
    print("=" * 55)
    try:
        from scrapers.realestateLB import RealEstateLBScraper
        results = await RealEstateLBScraper().scrape(max_pages=8)
        print(f"\nRELB: {len(results)} listings")
        with_coords = sum(1 for r in results if r.lat)
        with_size   = sum(1 for r in results if r.size_sqm)
        with_type   = sum(1 for r in results if r.property_type)
        suspect     = sum(1 for r in results if r._price_suspect)
        print(f"  With coords:        {with_coords}/{len(results)} ({round(with_coords/max(len(results),1)*100)}%)")
        print(f"  With size:          {with_size}/{len(results)}")
        print(f"  With property type: {with_type}/{len(results)}")
        print(f"  Suspect prices:     {suspect}")
        if results:
            r = results[0]
            print(f"\n  Sample listing:")
            print(f"    Title:    {r.title[:60]}")
            print(f"    Price:    ${r.price:,}")
            print(f"    Size:     {r.size_sqm} sqm")
            print(f"    Type:     {r.property_type}")
            print(f"    Area:     {r.area}")
            print(f"    Sub:      {r.subregion}")
            print(f"    Region:   {r.region}")
            print(f"    Coords:   {r.lat}, {r.lng}")
            print(f"    Furnished:{r._furnished}")
            print(f"    Beds:     {r._bedrooms}")
            print(f"    Baths:    {r._bathrooms}")
            print(f"    Amenities:{r._amenities}")
    except Exception as e:
        import traceback
        print(f"RELB ERROR: {e}")
        traceback.print_exc()

    print("\n" + "=" * 55)
    print("Testing OLX scraper (3 pages = ~135 listings)...")
    print("=" * 55)
    try:
        from scrapers.olx import OLXScraper
        results = await OLXScraper().scrape(max_pages=3)
        print(f"\nOLX: {len(results)} listings")
        with_coords = sum(1 for r in results if r.lat)
        with_size   = sum(1 for r in results if r.size_sqm)
        with_type   = sum(1 for r in results if r.property_type)
        suspect     = sum(1 for r in results if r._price_suspect)
        print(f"  With coords:        {with_coords}/{len(results)} ({round(with_coords/max(len(results),1)*100)}%)")
        print(f"  With size:          {with_size}/{len(results)}")
        print(f"  With property type: {with_type}/{len(results)}")
        print(f"  Suspect prices:     {suspect}")
        if results:
            r = results[0]
            print(f"\n  Sample listing:")
            print(f"    Title:    {r.title[:60]}")
            print(f"    Price:    ${r.price:,}")
            print(f"    Size:     {r.size_sqm} sqm")
            print(f"    Type:     {r.property_type}")
            print(f"    Area:     {r.area}")
            print(f"    Region:   {r.region}")
            print(f"    Coords:   {r.lat}, {r.lng}")
            print(f"    Furnished:{r._furnished}")
            print(f"    Beds:     {r._bedrooms}")
            print(f"    Baths:    {r._bathrooms}")
    except Exception as e:
        import traceback
        print(f"OLX ERROR: {e}")
        traceback.print_exc()

asyncio.run(test())