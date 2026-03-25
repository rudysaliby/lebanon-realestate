import asyncio
import os
import json
import httpx
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

SYSTEM = """You are a Lebanese geography expert. Given a real estate listing title, extract the precise location.
Return ONLY a JSON object with these fields:
{
  "area": "neighborhood name in English",
  "lat": latitude as number,
  "lng": longitude as number,
  "confidence": "high" | "medium" | "low"
}
Use null for lat/lng if you cannot determine location. Never guess wildly.
Focus on Lebanese locations only. Common areas: Hamra, Achrafieh, Jounieh, Kaslik, Baabda, Rabieh, Ballouneh, Sheileh, Zouk Mikael, Jbeil, Batroun, Tripoli, etc."""

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
            timeout=15,
        )
        text = resp.json()["content"][0]["text"].strip()
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        print(f"  [AI] Error: {e}")
        return None

async def get_ungeocoded(client: httpx.AsyncClient) -> list:
    resp = await client.get(
        f"{SUPABASE_URL}/rest/v1/listings",
        headers=HEADERS,
        params={
            "select": "id,title,location_raw,area",
            "lat": "is.null",
            "is_active": "eq.true",
            "limit": "200",
        }
    )
    return resp.json() if resp.status_code == 200 else []

async def update_listing(listing_id: str, area: str, lat: float, lng: float, client: httpx.AsyncClient):
    resp = await client.patch(
        f"{SUPABASE_URL}/rest/v1/listings",
        headers={**HEADERS, "Prefer": "return=minimal"},
        params={"id": f"eq.{listing_id}"},
        json={"area": area, "lat": lat, "lng": lng},
    )
    return resp.status_code in (200, 204)

async def run_enrichment():
    if not ANTHROPIC_KEY:
        print("[Enrich] No ANTHROPIC_API_KEY set — skipping AI location enrichment")
        return

    print("[Enrich] Fetching listings without coordinates...")
    async with httpx.AsyncClient(timeout=20) as client:
        listings = await get_ungeocoded(client)
        print(f"[Enrich] Found {len(listings)} listings to enrich")

        updated = 0
        # Process in batches of 5 concurrently
        sem = asyncio.Semaphore(5)

        async def process_one(listing):
            nonlocal updated
            title = listing.get("title") or listing.get("location_raw") or ""
            if not title or len(title) < 5:
                return

            async with sem:
                result = await extract_location(title, client)
                if result and result.get("lat") and result.get("lng") and result.get("confidence") != "low":
                    ok = await update_listing(
                        listing["id"],
                        result.get("area", listing.get("area", "")),
                        result["lat"],
                        result["lng"],
                        client,
                    )
                    if ok:
                        updated += 1
                        print(f"  [Enrich] ✓ '{title[:50]}' → {result.get('area')} ({result['lat']:.4f}, {result['lng']:.4f})")

        await asyncio.gather(*[process_one(l) for l in listings])
        print(f"[Enrich] Done — enriched {updated}/{len(listings)} listings")

if __name__ == "__main__":
    asyncio.run(run_enrichment())
