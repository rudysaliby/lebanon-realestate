import os
import httpx
from scrapers.base import RawListing

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

async def upsert_listings(listings: list[RawListing]) -> int:
    if not listings:
        return 0

    rows = []
    for l in listings:
        row = {
            "source":        l.source,
            "url":           l.url,
            "title":         l.title,
            "price":         l.price,
            "currency":      l.currency,
            "price_period":  l.price_period,
            "location_raw":  l.location_raw,
            "area":          l.area,
            "description":   l.description,
            "property_type": l.property_type,
            "size_sqm":      l.size_sqm,
            "external_id":   l.external_id,
            "lat":           l.lat,
            "lng":           l.lng,
            "is_active":     True,
        }
        # Remove None values to avoid overwriting existing data
        rows.append({k: v for k, v in row.items() if v is not None})

    # Batch upsert in chunks of 100
    chunk_size = 100
    total = 0
    async with httpx.AsyncClient(timeout=30) as client:
        for i in range(0, len(rows), chunk_size):
            chunk = rows[i:i + chunk_size]
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/listings",
                headers=HEADERS,
                json=chunk,
                params={"on_conflict": "url"},
            )
            if resp.status_code in (200, 201):
                total += len(chunk)
                print(f"[DB] Upserted {len(chunk)} rows (total: {total})")
            else:
                print(f"[DB] Error: {resp.status_code} - {resp.text[:200]}")

    # Refresh materialized view
    await refresh_area_stats(client if False else None)
    return total

async def refresh_area_stats(client=None):
    async with httpx.AsyncClient(timeout=30) as c:
        resp = await c.post(
            f"{SUPABASE_URL}/rest/v1/rpc/refresh_area_stats",
            headers=HEADERS,
            json={}
        )
        print(f"[DB] Area stats refresh: {resp.status_code}")
