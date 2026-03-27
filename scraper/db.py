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

async def upsert_listings(listings) -> int:
    if not listings:
        return 0

    rows = []
    for l in listings:
        has_coords = getattr(l, 'lat', None) is not None and getattr(l, 'lng', None) is not None

        row = {
            "source":        l.source,
            "url":           l.url,
            "title":         l.title,
            "description":   getattr(l, 'description', None),
            "price":         l.price,
            "currency":      getattr(l, 'currency', 'USD'),
            "price_period":  getattr(l, 'price_period', None),
            "property_type": getattr(l, 'property_type', None),
            "size_sqm":      getattr(l, 'size_sqm', None),
            "location_raw":  getattr(l, 'location_raw', None),
            "area":          getattr(l, 'area', None),
            "subregion":     getattr(l, 'subregion', None),
            "region":        getattr(l, 'region', None),
            "city":          "Beirut",
            "lat":           getattr(l, 'lat', None),
            "lng":           getattr(l, 'lng', None),
            "image_url":     getattr(l, 'image_url', None),
            "is_active":     True,
            # Mark as verified only if we already have real coords from the scraper
            # This prevents enrich_all.py from overwriting good coordinates
            "ai_verified":   has_coords,
            "ai_tags_done":  False,
        }

        # Include pre-scraped tags from realestate.com.lb
        if getattr(l, '_furnished', None):
            row["furnished"] = l._furnished
        if getattr(l, '_bedrooms', None):
            row["bedrooms"] = l._bedrooms
        if getattr(l, '_bathrooms', None):
            row["bathrooms"] = l._bathrooms
        if getattr(l, '_amenities', None):
            row["features"] = l._amenities
        if getattr(l, '_floor', None):
            row["floor_type"] = l._floor

        rows.append({k: v for k, v in row.items() if v is not None})

    chunk_size = 50
    total = 0
    async with httpx.AsyncClient(timeout=30) as client:
        for i in range(0, len(rows), chunk_size):
            chunk = rows[i:i + chunk_size]
            all_keys = set()
            for r in chunk:
                all_keys.update(r.keys())
            chunk = [{k: r.get(k) for k in all_keys} for r in chunk]

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