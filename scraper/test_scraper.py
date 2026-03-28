"""
Quick test script — runs each scraper for 1 page and prints results.
Run: py -3.12 test_scraper.py
"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

async def test():
    print("Testing RELB scraper (2 pages)...")
    try:
        from scrapers.realestateLB import RealEstateLBScraper
        results = await RealEstateLBScraper().scrape(max_pages=2)
        print(f"RELB: {len(results)} listings")
        if results:
            r = results[0]
            print(f"  Sample: {r.title[:50]} | price={r.price} | lat={r.lat} | area={r.area}")
        else:
            print("  RELB returned 0 listings!")
    except Exception as e:
        import traceback
        print(f"RELB ERROR: {e}")
        traceback.print_exc()

    print("\nTesting OLX scraper (1 page)...")
    try:
        from scrapers.olx import OLXScraper
        results = await OLXScraper().scrape(max_pages=1)
        print(f"OLX: {len(results)} listings")
        if results:
            r = results[0]
            print(f"  Sample: {r.title[:50]} | price={r.price} | lat={r.lat} | area={r.area}")
        else:
            print("  OLX returned 0 listings!")
    except Exception as e:
        import traceback
        print(f"OLX ERROR: {e}")
        traceback.print_exc()

asyncio.run(test())
