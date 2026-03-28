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
    seen_urls = set()
    skipped = 0

    for l in listings:
        if not l.url or l.url in seen_urls:
            continue

        # Skip listings without price
        if not l.price or l.price <= 0:
            skipped += 1
            continue

        # Skip listings with no location at all (no coords AND no area AND no location_raw)
        has_any_location = (
            l.lat is not None or
            bool(getattr(l, "area", None)) or
            bool(getattr(l, "location_raw", None))
        )
        if not has_any_location:
            skipped += 1
            continue

        seen_urls.add(l.url)

        has_coords = l.lat is not None and l.lng is not None

        # Validate size — reject implausible values
        size = getattr(l, "size_sqm", None)
        if size is not None and not (20 <= size <= 5000):
            l.size_sqm = None

        row = {
            "source":        l.source,
            "url":           l.url,
            "title":         l.title,
            "description":   getattr(l, "description", None),
            "price":         l.price,
            "currency":      getattr(l, "currency", "USD"),
            "price_period":  getattr(l, "price_period", None),
            "property_type": getattr(l, "property_type", None),
            "size_sqm":      getattr(l, "size_sqm", None),
            "location_raw":  getattr(l, "location_raw", None),
            "area":          getattr(l, "area", None),
            "subregion":     getattr(l, "subregion", None),
            "region":        getattr(l, "region", None),
            "city":          "Beirut",
            "lat":           l.lat,
            "lng":           l.lng,
            "image_url":     getattr(l, "image_url", None),
            "is_active":     True,
            "ai_verified":   has_coords,
            "ai_tags_done":  any([
                getattr(l, "_furnished", None),
                getattr(l, "_bedrooms", None),
                getattr(l, "_amenities", None),
                getattr(l, "_condition", None),
            ]),
        }

        # All pre-scraped tags — no AI needed
        if getattr(l, "_furnished", None):    row["furnished"]     = l._furnished
        if getattr(l, "_bedrooms", None):     row["bedrooms"]      = l._bedrooms
        if getattr(l, "_bathrooms", None):    row["bathrooms"]     = l._bathrooms
        if getattr(l, "_amenities", None):    row["features"]      = l._amenities
        if getattr(l, "_floor", None):        row["floor_type"]    = l._floor
        if getattr(l, "_condition", None):    row["condition"]     = l._condition
        if getattr(l, "_payment", None):      row["payment_type"]  = l._payment
        if getattr(l, "_building_age", None): row["building_age"]  = l._building_age
        if getattr(l, "_view_type", None):    row["view_type"]     = l._view_type
        if getattr(l, "_lifestyle", None):    row["lifestyle"]     = l._lifestyle

        rows.append({k: v for k, v in row.items() if v is not None})

    if skipped:
        print(f"[DB] Skipped {skipped} listings (no price or no location)")

    chunk_size = 50
    total = 0
    async with httpx.AsyncClient(timeout=60) as client:
        for i in range(0, len(rows), chunk_size):
            chunk = rows[i:i + chunk_size]
            all_keys = set()
            for r in chunk: all_keys.update(r.keys())
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
                print(f"[DB] Error: {resp.status_code} - {resp.text[:300]}")

    return total