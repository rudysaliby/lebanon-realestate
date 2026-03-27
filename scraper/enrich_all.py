"""
Combined enrichment: AI location + AI tags for all unprocessed listings.
Run after each scrape: py -3.12 enrich_all.py
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
GOOGLE_KEY = os.environ.get("GOOGLE_MAPS_KEY", "")

HEADERS_SB = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# Will be loaded from lebanon_regions.py once geocoded Excel is available
try:
    from lebanon_regions import lookup_region
except ImportError:
    def lookup_region(name): return None

LOCATION_SYSTEM = """You are a Lebanese real estate geography expert.
Given a property listing title, return the most specific Lebanese location name mentioned.
Return ONLY JSON: {"area": "location name in English", "confidence": "high"|"medium"|"low"}
Use proper English spellings. If truly unknown return confidence "low" and area null."""

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

async def geocode_nominatim(area: str, client: httpx.AsyncClient) -> tuple | None:
    try:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": f"{area}, Lebanon", "format": "json", "limit": 1, "countrycodes": "lb"},
            headers={"User-Agent": "LBRealEstate-MVP/1.0"},
            timeout=8,
        )
        data = resp.json()
        if data:
            lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
            if 33.0 <= lat <= 34.7 and 35.1 <= lng <= 36.6:
                await asyncio.sleep(1.1)
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
    resp = await client.get(
        f"{SUPABASE_URL}/rest/v1/listings",
        headers=HEADERS_SB,
        params={
            "select": "id,title,description,area,lat,lng",
            "is_active": "eq.true",
            filter_key: "eq.false",
            "limit": "300",
        }
    )
    return resp.json() if resp.status_code == 200 else []

async def run_enrichment():
    print("=" * 50)
    print("Starting full enrichment (location + tags)")
    print("=" * 50)

    async with httpx.AsyncClient(timeout=25) as client:

        # --- PHASE 1: Location enrichment ---
        unverified = await get_pending(client, "ai_verified")
        print(f"\n[Location] {len(unverified)} listings need location enrichment")

        loc_updated = 0
        loc_sem = asyncio.Semaphore(1)

        async def enrich_location(listing):
            nonlocal loc_updated
            title = listing.get("title") or ""
            if not title: return

            async with loc_sem:
                await asyncio.sleep(1.3)

                # Extract area name via Claude
                result = await extract_location(title, client)
                if not result or not result.get("area") or result.get("confidence") == "low":
                    # Mark as verified even if no location found (avoid re-processing)
                    await update_listing(listing["id"], {"ai_verified": True}, client)
                    return

                area = result["area"]
                region_info = lookup_region(area)
                region    = region_info[0] if region_info else None
                subregion = region_info[1] if region_info else None

                # Skip if already has good coordinates
                if listing.get("lat"):
                    updates = {"area": area, "ai_verified": True}
                    if region:    updates["region"]    = region
                    if subregion: updates["subregion"] = subregion
                    await update_listing(listing["id"], updates, client)
                    loc_updated += 1
                    return

                # Geocode: Google first, then Nominatim
                coords = await geocode_google(area, client)
                if not coords:
                    await asyncio.sleep(1.1)
                    coords = await geocode_nominatim(area, client)
                if not coords:
                    await update_listing(listing["id"], {"ai_verified": True}, client)
                    return

                lat, lng = coords
                updates = {
                    "area": area, "lat": lat, "lng": lng,
                    "ai_verified": True,
                }
                if region:    updates["region"]    = region
                if subregion: updates["subregion"] = subregion

                ok = await update_listing(listing["id"], updates, client)
                if ok:
                    loc_updated += 1
                    print(f"  ✓ Location: '{title[:45]}' → {area} ({lat:.4f},{lng:.4f})")

        await asyncio.gather(*[enrich_location(l) for l in unverified])
        print(f"[Location] Enriched {loc_updated}/{len(unverified)} listings")

        # --- PHASE 2: Tag extraction ---
        untagged = await get_pending(client, "ai_tags_done")
        print(f"\n[Tags] {len(untagged)} listings need tag extraction")

        tag_updated = 0
        tag_sem = asyncio.Semaphore(2)

        async def enrich_tags(listing):
            nonlocal tag_updated
            title = listing.get("title") or ""
            desc  = listing.get("description") or ""
            if not title: return

            async with tag_sem:
                await asyncio.sleep(0.8)
                tags = await extract_tags(title, desc, client)
                if not tags:
                    await update_listing(listing["id"], {"ai_tags_done": True}, client)
                    return

                updates = {"ai_tags_done": True}
                if tags.get("furnished"):     updates["furnished"]     = tags["furnished"]
                if tags.get("condition"):     updates["condition"]     = tags["condition"]
                if tags.get("view"):          updates["view_type"]     = tags["view"]
                if tags.get("floor_type"):    updates["floor_type"]    = tags["floor_type"]
                if tags.get("bedrooms"):      updates["bedrooms"]      = tags["bedrooms"]
                if tags.get("bathrooms"):     updates["bathrooms"]     = tags["bathrooms"]
                if tags.get("features"):      updates["features"]      = tags["features"]
                if tags.get("payment"):       updates["payment_type"]  = tags["payment"]
                if tags.get("building_age"):  updates["building_age"]  = tags["building_age"]
                if tags.get("lifestyle"):     updates["lifestyle"]     = tags["lifestyle"]

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
