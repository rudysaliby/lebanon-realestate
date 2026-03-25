import asyncio
import os
import json
import httpx
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

SYSTEM = """You are a Lebanese geography expert. Given a real estate listing title, extract the precise location.
Return ONLY a JSON object with these fields:
{
  "area": "neighborhood name in English",
  "lat": latitude as number,
  "lng": longitude as number,
  "confidence": "high" | "medium" | "low"
}
Use null for lat/lng if you cannot determine location. Never guess wildly.
Focus on Lebanese locations only. Examples: Hamra, Achrafieh, Jounieh, Kaslik, Cornet Chehwan, Rabieh, Ballouneh, Zouk Mikael, Jbeil, Batroun, Tripoli, Saida etc."""

async def extract_location(title: str, client: httpx.AsyncClient) -> dict | None:
    if not ANTHROPIC_KEY:
        return None
    try:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_KEY,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 150,
                "system": SYSTEM,
                "messages": [{"role": "user", "content": f"Listing title: {title}"}],
            },
            timeout=20,
        )
        data = resp.json()
        if resp.status_code != 200:
            print(f"  [AI] HTTP {resp.status_code}: {data.get('error', {}).get('message', '')}")
            return None
        if "content" not in data:
            return None
        text = data["content"][0]["text"].strip()
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except json.JSONDecodeError:
        return None
    except Exception as e:
        print(f"  [AI] Error: {type(e).__name__}: {e}")
        return None

async def get_all_listings(client: httpx.AsyncClient) -> list:
    resp = await client.get(
        f"{SUPABASE_URL}/rest/v1/listings",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
        params={
            "select": "id,title,location_raw,area",
            "is_active": "eq.true",
            "ai_verified": "eq.false",
            "limit": "500",
        }
    )
    if resp.status_code != 200:
        print(f"  [DB] Error: {resp.status_code} {resp.text[:200]}")
        return []
    return resp.json()

async def update_listing(listing_id: str, area: str, lat: float, lng: float, client: httpx.AsyncClient):
    resp = await client.patch(
        f"{SUPABASE_URL}/rest/v1/listings",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        params={"id": f"eq.{listing_id}"},
         json={"area": area, "lat": lat, "lng": lng, "ai_verified": True},
    )
    return resp.status_code in (200, 204)

async def run_enrichment():
    if not ANTHROPIC_KEY:
        print("[Enrich] No ANTHROPIC_API_KEY — skipping")
        return

    print("[Enrich] Fetching all listings...")
    async with httpx.AsyncClient(timeout=60) as client:
        listings = await get_all_listings(client)
        print(f"[Enrich] Processing {len(listings)} listings with AI...")

        if not listings:
            return

        updated = 0
        sem = asyncio.Semaphore(1)

        async def process_one(listing):
            nonlocal updated
            title = listing.get("title") or listing.get("location_raw") or ""
            if not title or len(title) < 5:
                return
            async with sem:
               result = await extract_location(title, client)
               await asyncio.sleep(1.5)
               if result and result.get("lat") and result.get("lng") and result.get("confidence") != "low":
                    ok = await update_listing(
                        listing["id"],
                        result.get("area", ""),
                        result["lat"],
                        result["lng"],
                        client,
                    )
                    if ok:
                        updated += 1
                        print(f"  ✓ '{title[:50]}' → {result.get('area')} ({result['lat']:.4f}, {result['lng']:.4f})")

        await asyncio.gather(*[process_one(l) for l in listings])
        print(f"[Enrich] Done — enriched {updated}/{len(listings)} listings")

if __name__ == "__main__":
    asyncio.run(run_enrichment())