import asyncio
from scrapers.olx import OLXScraper

async def test():
    s = OLXScraper()
    results = await s.scrape(max_pages=1)
    with_coords = [r for r in results if r.lat]
    print(f'Total: {len(results)}, With coords: {len(with_coords)}')
    for r in with_coords[:3]:
        print(f'  {r.title[:40]} -> {r.lat},{r.lng}')

asyncio.run(test())
