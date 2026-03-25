import os
import httpx

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

# All possible columns — every row will have all keys
ALL_COLUMNS = [
    "source", "url", "title", "description", "price", "currency",
    "price_period", "property_type", "size_sqm", "location_raw",
    "area", "city", "lat", "lng", "image_url", "external_id", "is_active"
]

async def upsert_listings(listings) -> int:
    if not listings:
        return 0

    rows = []
    for l in listings:
        # Build row with ALL columns present — None for missing ones
        row = {
            "source":        l.source,
            "url":           l.url,
            "title":         l.title,
            "description":   None,
            "price":         l.price,
            "currency":      getattr(l, 'currency', 'USD'),
            "price_period":  getattr(l, 'price_period', None),
            "property_type": getattr(l, 'property_type', None),
            "size_sqm":      getattr(l, 'size_sqm', None),
            "location_raw":  getattr(l, 'location_raw', None),
            "area":          getattr(l, 'area', None),
            "city":          "Beirut",
            "lat":           getattr(l, 'lat', None),
            "lng":           getattr(l, 'lng', None),
            "image_url":     getattr(l, 'image_url', None),
            "external_id":   getattr(l, 'external_id', None),
            "is_active":     True,
        }
        rows.append(row)

    chunk_size = 50
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
                print(f"[DB] Saved {len(chunk)} rows (total: {total})")
            else:
                print(f"[DB] Error: {resp.status_code} - {resp.text[:200]}")

    return total