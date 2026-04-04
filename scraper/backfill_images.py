"""
Quick image backfill — fetches image URLs for listings that have null image_url.
Run this from the scraper folder: python backfill_images.py
"""
import asyncio, re, os
import httpx
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://fgpszczrwudsxlskemnc.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_secret_0jXgW2b8yr9cGQVwUSspnw_qHsLn90G")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
    "Accept-Language": "en-US,en;q=0.9",
}

async def fetch_image(client: httpx.AsyncClient, listing: dict) -> tuple[str, str | None]:
    url = listing["url"]
    try:
        r = await client.get(url, timeout=15)
        html = r.text

        # Primary: extract from photos JSON
        photo_m = re.search(r'"photos"\s*:\s*\[\s*\{"id"\s*:\s*(\d+)', html)
        if photo_m:
            return listing["id"], f"https://images.olx.com.lb/thumbnails/{photo_m.group(1)}-800x600.webp"

        # Fallback: direct thumbnail URL
        thumb_m = re.search(r'https://images\.olx\.com\.lb/thumbnails/(\d+)-\d+x\d+\.\w+', html)
        if thumb_m:
            return listing["id"], thumb_m.group(0)

        return listing["id"], None
    except Exception as e:
        print(f"  ERR {url[:60]}: {e}")
        return listing["id"], None

async def main():
    print("Fetching listings without images...")
    res = sb.table("listings").select("id,url").is_("image_url", "null").eq("is_active", True).limit(2000).execute()
    listings = res.data
    print(f"Found {len(listings)} listings without images")

    BATCH = 30
    updated = 0

    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True) as client:
        for i in range(0, len(listings), BATCH):
            batch = listings[i:i+BATCH]
            results = await asyncio.gather(*[fetch_image(client, l) for l in batch])

            updates = [(lid, img) for lid, img in results if img]
            for lid, img in updates:
                sb.table("listings").update({"image_url": img}).eq("id", lid).execute()

            updated += len(updates)
            print(f"  Batch {i//BATCH+1}: {len(updates)}/{len(batch)} images found | Total: {updated}")

    print(f"\nDone! Updated {updated} listings with images.")

asyncio.run(main())
