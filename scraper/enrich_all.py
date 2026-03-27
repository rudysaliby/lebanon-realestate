"""
Combined enrichment: location + AI tags for all unprocessed listings.
Coordinate priority:
  1. lebanon_regions.py lookup (pre-geocoded Google Maps coords) — free & instant
  2. Google Maps API — if area not in regions DB
  3. Skip listing entirely if neither works — no coordinate guessing ever
"""
import asyncio
import os
import json
import httpx
from dotenv import load_dotenv
load_dotenv()

from ai_tagger import extract_tags

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GOOGLE_KEY    = os.environ.get("GOOGLE_MAPS_KEY", "")

HEADERS_SB = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

try:
    from lebanon_regions import lookup
except ImportError:
    def lookup(name): return None

LOCATION_SYSTEM = """You are a Lebanese real estate geography expert.
Given a property listing title, extract the area/neighborhood name only.
Return ONLY JSON: {"area": "area name in English", "confidence": "high"|"medium"|"low"}
Examples: Hamra, Achrafieh, Jounieh, Kaslik, Ballouneh, Rabieh, Mansourieh, Baabda,
Dbayeh, Jdeideh, Antelias, Broumana, Batroun, Jbeil, Zahle, Tripoli, Saida.
Return the area NAME only. Never return coordinates.
If location is truly unclear return confidence "low" and area null."""

async def extract_location(title: str, client: httpx.AsyncClient) -> dict | None:
    try:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 80,
                "system": LOCATION_SYSTEM,
                "messages": [{"role": "user", "content": f"Listing: {title}"}],
            },
            timeout=15,
        )
        if resp.status_code == 429:
            await asyncio.sleep(5)
            return None
        data = resp.json()
        if resp.status_code != 200 or "content" not in data:
            return None
        text = data["content"][0]["text"].strip().replace("```json","").replace("```","").strip()
        return json.loads(text)
    except:
        return None

async def geocode_google(area: str, client: httpx.AsyncClient) -> tuple | None:
    if not GOOGLE_KEY:
        return None
    try:
        resp = await client.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": f"{area}, Lebanon", "key": GOOGLE_KEY, "components": "country:LB"},
            timeout=8,
        )
        data = resp.json()
        if data.get("status") == "OK" and data["results"]:
            loc = data["results"][0]["geometry"]["location"]
            lat, lng = loc["lat"], loc["lng"]
            if 33.0 <= lat <= 34.7 and 35.1 <= lng <= 36.6:
                return round(lat, 6), round(lng, 6)
    except:
        pass
    return None

async def update_listing(listing_id: str, updates: dict, client: httpx.AsyncClient):
    resp = await client.patch(
        f"{SUPABASE_URL}/rest/v1/listings",
        headers={**HEADERS_SB, "Prefer": "return=minimal"},
        params={"id": f"eq.{listing_id}"},
        json=updates,
    )
    return resp.status_code in (200, 204)

async def get_pending(client: httpx.AsyncClient, filter_key: str) -> list:
    all_rows = []
    page_size = 500
    offset = 0
    batch = 1
    while True:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/listings",
            headers=HEADERS_SB,
            params={
                "select": "id,title,description,area,lat,lng",
                "is_active": "eq.true",
                filter_key: "eq.false",
                "limit": str(page_size),
                "offset": str(offset),
            }
        )
        if resp.status_code not in (200, 206):
            break
        data = resp.json()
        if not data:
            break
        all_rows.extend(data)
        print(f"  [Fetch] Batch {batch}: {len(data)} rows (total: {len(all_rows)})")
        if len(data) < page_size:
            break
        offset += page_size
        batch += 1
    return all_rows

async def run_enrichment():
    print("=" * 50)
    print("Starting enrichment (location + tags)")
    print("=" * 50)

    async with httpx.AsyncClient(timeout=60) as client:

        # --- PHASE 1: Location enrichment ---
        unverified = await get_pending(client, "ai_verified")
        print(f"\n[Location] {len(unverified)} listings need location enrichment")

        loc_updated = 0
        loc_skipped = 0
        loc_counter = 0
        loc_total = len(unverified)
        loc_sem = asyncio.Semaphore(1)

        async def enrich_location(listing):
            nonlocal loc_updated, loc_skipped, loc_counter
            title = listing.get("title") or ""
            if not title:
                return

            async with loc_sem:
                await asyncio.sleep(1.3)

                # Step 1: Claude extracts area name only
                result = await extract_location(title, client)
                if not result or not result.get("area") or result.get("confidence") == "low":
                    await update_listing(listing["id"], {"ai_verified": True}, client)
                    loc_skipped += 1
                    return

                area = result["area"]

                # Step 2: Look up in lebanon_regions.py (Google Maps pre-geocoded)
                region_data = lookup(area)

                if region_data:
                    lat       = region_data["lat"]
                    lng       = region_data["lng"]
                    region    = region_data["region"]
                    subregion = region_data["subregion"]
                    official_area = region_data.get("area") or area
                    coord_source = "regions_db"
                else:
                    # Step 3: Call Google Maps API directly
                    coords = await geocode_google(area, client)
                    if not coords:
                        # Skip — no pin, no guessing
                        await update_listing(listing["id"], {"ai_verified": True}, client)
                        loc_skipped += 1
                        print(f"  ✗ Not found: '{title[:45]}' → {area}")
                        return
                    lat, lng = coords
                    region = None
                    subregion = None
                    official_area = area
                    coord_source = "google_api"

                updates = {
                    "area": official_area,
                    "lat": lat,
                    "lng": lng,
                    "ai_verified": True,
                }
                if region:    updates["region"]    = region
                if subregion: updates["subregion"] = subregion

                ok = await update_listing(listing["id"], updates, client)
                if ok:
                    loc_updated += 1
                    print(f"  ✓ [{coord_source}] '{title[:40]}' → {official_area} ({lat:.4f},{lng:.4f})")

        await asyncio.gather(*[enrich_location(l) for l in unverified])
        print(f"[Location] Done — {loc_updated} enriched, {loc_skipped} skipped (no location found)")

        # --- PHASE 2: Tag extraction ---
        untagged = await get_pending(client, "ai_tags_done")
        print(f"\n[Tags] {len(untagged)} listings need tag extraction")

        tag_updated = 0
        tag_sem = asyncio.Semaphore(2)

        async def enrich_tags(listing):
            nonlocal tag_updated
            title = listing.get("title") or ""
            desc  = listing.get("description") or ""
            if not title:
                return

            async with tag_sem:
                await asyncio.sleep(0.8)
                tags = await extract_tags(title, desc, client)
                if not tags:
                    await update_listing(listing["id"], {"ai_tags_done": True}, client)
                    return

                updates = {"ai_tags_done": True}
                if tags.get("furnished"):    updates["furnished"]    = tags["furnished"]
                if tags.get("condition"):    updates["condition"]    = tags["condition"]
                if tags.get("view"):         updates["view_type"]    = tags["view"]
                if tags.get("floor_type"):   updates["floor_type"]   = tags["floor_type"]
                if tags.get("bedrooms"):     updates["bedrooms"]     = tags["bedrooms"]
                if tags.get("bathrooms"):    updates["bathrooms"]    = tags["bathrooms"]
                if tags.get("features"):     updates["features"]     = tags["features"]
                if tags.get("payment"):      updates["payment_type"] = tags["payment"]
                if tags.get("building_age"): updates["building_age"] = tags["building_age"]
                if tags.get("lifestyle"):    updates["lifestyle"]    = tags["lifestyle"]

                ok = await update_listing(listing["id"], updates, client)
                if ok:
                    tag_updated += 1

        await asyncio.gather(*[enrich_tags(l) for l in untagged])
        print(f"[Tags] Extracted tags for {tag_updated}/{len(untagged)} listings")

    print(f"\n{'='*50}")
    print("Enrichment complete!")
    print(f"{'='*50}")

if __name__ == "__main__":
    asyncio.run(run_enrichment())