"""
Enrichment pipeline — runs after scraping.

Phase 0: Price verification
- Listings with price_verified=false (price < 15000 on sale)
- Claude reads title + description + price + size
- Decides if it's price/sqm or total price
- If price/sqm: total = price × size

Phase 1: Location enrichment
- Listings with ai_verified=false (no coords yet)
- Step 1: Regex against lebanon_regions.py (instant, free)
- Step 2: Cache lookup (instant, free)
- Step 3: Claude extracts area name from title (batched 5 at a time)
- Step 4: Google Maps geocode new area names
- If no coords found AND no area → listing deleted by cleanup step

Phase 2: Tag enrichment
- Listings with ai_tags_done=false
- Claude reads title + description → extracts missing tags
"""
import asyncio
import os
import json
import re
import random
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

CACHE_FILE = os.path.join(os.path.dirname(__file__), "regions_cache.json")

try:
    from lebanon_regions import AREA_LOOKUP, SUBREGION_LOOKUP, ALIASES, _norm
    HAS_REGIONS = True
except ImportError:
    HAS_REGIONS = False
    AREA_LOOKUP = {}
    SUBREGION_LOOKUP = {}
    ALIASES = {}
    def _norm(s): return s.lower().strip()

def load_cache() -> dict:
    try:
        with open(CACHE_FILE) as f: return json.load(f)
    except: return {}

def save_cache(cache: dict):
    try:
        with open(CACHE_FILE, "w") as f: json.dump(cache, f, indent=2, ensure_ascii=False)
    except: pass

KNOWN_AREAS = sorted(
    set(list(AREA_LOOKUP.keys()) + list(SUBREGION_LOOKUP.keys()) + list(ALIASES.keys())),
    key=len, reverse=True
) if HAS_REGIONS else []

def regex_lookup(title: str) -> dict | None:
    if not title or not HAS_REGIONS: return None
    key = _norm(title)
    for area_key in KNOWN_AREAS:
        if re.search(r'\b' + re.escape(area_key) + r'\b', key):
            result = AREA_LOOKUP.get(area_key) or SUBREGION_LOOKUP.get(area_key)
            if result:
                return {
                    "area": result.get("area") or area_key.title(),
                    "subregion": result.get("subregion"),
                    "region": result.get("region"),
                    "lat": round(result["lat"] + random.uniform(-0.003, 0.003), 6),
                    "lng": round(result["lng"] + random.uniform(-0.003, 0.003), 6),
                }
    return None

def cache_lookup(area_name: str, cache: dict) -> dict | None:
    return cache.get(_norm(area_name))

async def extract_locations_batch(titles: list[str], client: httpx.AsyncClient) -> list[dict]:
    if not ANTHROPIC_KEY or not titles:
        return [{"area": None, "confidence": "low"}] * len(titles)
    numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(titles))
    try:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 300,
                "system": """Extract the neighborhood/area name from each Lebanese real estate listing title.
Return ONLY a JSON array: [{"area": "name or null", "confidence": "high/medium/low"}, ...]
Same number of items as input. Use English: Hamra, Achrafieh, Jounieh, etc.""",
                "messages": [{"role": "user", "content": f"Titles:\n{numbered}"}],
            },
            timeout=20,
        )
        if resp.status_code == 429:
            await asyncio.sleep(10)
            return [{"area": None, "confidence": "low"}] * len(titles)
        data = resp.json()
        if resp.status_code != 200: return [{"area": None, "confidence": "low"}] * len(titles)
        text = data["content"][0]["text"].strip().replace("```json","").replace("```","").strip()
        results = json.loads(text)
        if isinstance(results, list) and len(results) == len(titles):
            return results
    except: pass
    return [{"area": None, "confidence": "low"}] * len(titles)

async def geocode_google(area: str, client: httpx.AsyncClient) -> tuple | None:
    if not GOOGLE_KEY: return None
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
    except: pass
    return None

async def update_listing(listing_id: str, updates: dict, client: httpx.AsyncClient) -> bool:
    resp = await client.patch(
        f"{SUPABASE_URL}/rest/v1/listings",
        headers={**HEADERS_SB, "Prefer": "return=minimal"},
        params={"id": f"eq.{listing_id}"},
        json=updates,
    )
    return resp.status_code in (200, 204)

async def get_pending(client: httpx.AsyncClient, filter_key: str, filter_val: str = "eq.false") -> list:
    all_rows = []
    page_size = 500
    offset = 0
    while True:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/listings",
            headers=HEADERS_SB,
            params={
                "select": "id,title,description,area,lat,lng,price,size_sqm,source",
                "is_active": "eq.true",
                filter_key: filter_val,
                "limit": str(page_size),
                "offset": str(offset),
            }
        )
        if resp.status_code not in (200, 206): break
        data = resp.json()
        if not data: break
        all_rows.extend(data)
        if len(data) < page_size: break
        offset += page_size
    return all_rows


async def run_enrichment():
    print("=" * 55)
    print("Enrichment pipeline starting")
    print("=" * 55)

    cache = load_cache()
    print(f"[Cache] Loaded {len(cache)} cached areas")

    async with httpx.AsyncClient(timeout=60) as client:

        # ── PHASE 0: Price verification ───────────────────────────────────────
        suspect = await get_pending(client, "price_verified")
        print(f"\n[Price] {len(suspect)} listings need price verification")

        if suspect:
            PRICE_SYSTEM = """You are a Lebanese real estate expert. Determine if the price field is:
1. TOTAL property price (normal)
2. Price PER SQM (seller entered wrong field)

Return ONLY JSON: {"is_per_sqm": true/false, "confidence": "high/medium/low"}

Guidelines:
- Lebanon apartments typically $150,000-$3,000,000 total
- Lebanon land typically $200,000-$5,000,000 total  
- Price/sqm in Lebanon typically $1,000-$5,000
- If price < 5,000: almost certainly per sqm
- If price 5,000-15,000: check title/description for clues
- "per sqm", "/m2", "per meter" in text = per sqm"""

            price_sem = asyncio.Semaphore(3)

            async def verify_price(listing):
                async with price_sem:
                    await asyncio.sleep(0.5)
                    title = listing.get("title") or ""
                    desc  = (listing.get("description") or "")[:300]
                    price = listing.get("price")
                    size  = listing.get("size_sqm")
                    prompt = f"Title: {title}\nDescription: {desc}\nPrice: ${price}\nSize: {size} sqm"

                    try:
                        resp = await client.post(
                            "https://api.anthropic.com/v1/messages",
                            headers={"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
                            json={
                                "model": "claude-haiku-4-5-20251001",
                                "max_tokens": 100,
                                "system": PRICE_SYSTEM,
                                "messages": [{"role": "user", "content": prompt}],
                            },
                            timeout=15,
                        )
                        if resp.status_code == 429:
                            await asyncio.sleep(10)
                            return
                        if resp.status_code != 200: return

                        text = resp.json()["content"][0]["text"].strip()
                        text = text.replace("```json","").replace("```","").strip()
                        result = json.loads(text)

                        updates = {"price_verified": True}
                        if result.get("is_per_sqm") and size and price:
                            new_price = round(float(price) * float(size))
                            updates["price"] = new_price
                            print(f"  [Price] Fixed: ${price}/sqm × {size}sqm = ${new_price:,} | {title[:50]}")
                        else:
                            pass  # Price is correct total

                        await update_listing(listing["id"], updates, client)

                    except Exception as e:
                        print(f"  [Price] Error: {e}")
                        # Mark as verified anyway to avoid loop
                        await update_listing(listing["id"], {"price_verified": True}, client)

            await asyncio.gather(*[verify_price(l) for l in suspect])
            print(f"[Price] Verification complete")

        # ── PHASE 1: Location enrichment ──────────────────────────────────────
        unverified = await get_pending(client, "ai_verified")
        total = len(unverified)
        print(f"\n[Location] {total} listings need location enrichment")

        regex_queue  = []
        claude_queue = []

        for listing in unverified:
            title = listing.get("title") or ""
            result = regex_lookup(title)
            if result:
                regex_queue.append((listing, result))
            else:
                claude_queue.append(listing)

        print(f"[Location] Regex: {len(regex_queue)} instant | Claude needed: {len(claude_queue)}")

        # Save regex results
        loc_updated = 0
        loc_skipped = 0

        async def save_regex(listing, result):
            nonlocal loc_updated
            updates = {
                "area": result["area"],
                "lat":  result["lat"],
                "lng":  result["lng"],
                "ai_verified": True,
            }
            if result.get("region"):    updates["region"]    = result["region"]
            if result.get("subregion"): updates["subregion"] = result["subregion"]
            ok = await update_listing(listing["id"], updates, client)
            if ok: loc_updated += 1

        for i in range(0, len(regex_queue), 20):
            batch = regex_queue[i:i+20]
            await asyncio.gather(*[save_regex(l, r) for l, r in batch])

        print(f"[Location] Regex done: {loc_updated} saved instantly")

        # Claude batches
        BATCH_SIZE  = 5
        batch_sem   = asyncio.Semaphore(1)

        async def process_batch(batch_listings):
            nonlocal loc_updated, loc_skipped
            titles  = [l.get("title") or "" for l in batch_listings]
            async with batch_sem:
                await asyncio.sleep(1.5)
                results = await extract_locations_batch(titles, client)

            for listing, result in zip(batch_listings, results):
                area       = result.get("area")
                confidence = result.get("confidence", "low")

                if not area or confidence == "low":
                    # Check if listing already has an area from scraping
                    if listing.get("area"):
                        area = listing["area"]
                    else:
                        await update_listing(listing["id"], {"ai_verified": True}, client)
                        loc_skipped += 1
                        continue

                # Check cache
                cached = cache_lookup(area, cache)
                if cached:
                    updates = {"area": area, "lat": cached["lat"], "lng": cached["lng"], "ai_verified": True}
                    if cached.get("region"):    updates["region"]    = cached["region"]
                    if cached.get("subregion"): updates["subregion"] = cached["subregion"]
                    await update_listing(listing["id"], updates, client)
                    loc_updated += 1
                    continue

                # Check lebanon_regions
                region_data = AREA_LOOKUP.get(_norm(area)) or SUBREGION_LOOKUP.get(_norm(area))
                if not region_data:
                    alias = ALIASES.get(_norm(area))
                    if alias:
                        region_data = AREA_LOOKUP.get(_norm(alias)) or SUBREGION_LOOKUP.get(_norm(alias))

                if region_data:
                    lat = round(region_data["lat"] + random.uniform(-0.003, 0.003), 6)
                    lng = round(region_data["lng"] + random.uniform(-0.003, 0.003), 6)
                    cache[_norm(area)] = {"lat": region_data["lat"], "lng": region_data["lng"],
                                         "region": region_data.get("region"), "subregion": region_data.get("subregion")}
                    updates = {"area": area, "lat": lat, "lng": lng, "ai_verified": True}
                    if region_data.get("region"):    updates["region"]    = region_data["region"]
                    if region_data.get("subregion"): updates["subregion"] = region_data["subregion"]
                    await update_listing(listing["id"], updates, client)
                    loc_updated += 1
                    continue

                # Google Maps
                coords = await geocode_google(area, client)
                if coords:
                    lat, lng = coords
                    cache[_norm(area)] = {"lat": lat, "lng": lng, "region": None, "subregion": None}
                    save_cache(cache)
                    updates = {"area": area, "lat": lat, "lng": lng, "ai_verified": True}
                    await update_listing(listing["id"], updates, client)
                    loc_updated += 1
                    print(f"  ✓ [google] '{area}'")
                else:
                    await update_listing(listing["id"], {"ai_verified": True}, client)
                    loc_skipped += 1

        batches = [claude_queue[i:i+BATCH_SIZE] for i in range(0, len(claude_queue), BATCH_SIZE)]
        print(f"[Location] Processing {len(claude_queue)} via Claude in {len(batches)} batches...")

        for i, batch in enumerate(batches):
            await process_batch(batch)
            if (i+1) % 20 == 0:
                save_cache(cache)
                print(f"  [Progress] {(i+1)*BATCH_SIZE}/{len(claude_queue)} | enriched={loc_updated} skipped={loc_skipped}")

        save_cache(cache)
        print(f"[Location] Complete — {loc_updated} enriched, {loc_skipped} skipped")
        print(f"[Cache] Now contains {len(cache)} areas")

        # ── PHASE 2: Tag enrichment ───────────────────────────────────────────
        untagged = await get_pending(client, "ai_tags_done")
        print(f"\n[Tags] {len(untagged)} listings need tag extraction")

        tag_updated = 0
        tag_sem = asyncio.Semaphore(5)

        async def enrich_tags(listing):
            nonlocal tag_updated
            title = listing.get("title") or ""
            desc  = listing.get("description") or ""
            if not title: return

            async with tag_sem:
                await asyncio.sleep(0.3)
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
            if ok: tag_updated += 1

        for i in range(0, len(untagged), 50):
            batch = untagged[i:i+50]
            await asyncio.gather(*[enrich_tags(l) for l in batch])
            if (i+50) % 200 == 0:
                print(f"  [Tags] {min(i+50, len(untagged))}/{len(untagged)} processed")

        print(f"[Tags] Complete — {tag_updated}/{len(untagged)} extracted")

    print(f"\n{'='*55}")
    print("Enrichment complete!")
    print(f"{'='*55}")

if __name__ == "__main__":
    asyncio.run(run_enrichment())
