import asyncio
import os
import json
import httpx

ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

SYSTEM = """You are a Lebanese real estate data extractor.
Extract structured tags from listing title and description.
Return ONLY a JSON object with these exact fields:
{
  "furnished": "furnished" | "unfurnished" | "semi-furnished" | null,
  "condition": "new" | "under-construction" | "renovated" | "well-maintained" | "old" | null,
  "view": ["sea","mountain","open","city","garden"] — include only what is mentioned,
  "floor_type": "rooftop" | "penthouse" | "duplex" | "triplex" | "ground" | "high-floor" | null,
  "bedrooms": number or null,
  "bathrooms": number or null,
  "features": array from: ["pool","garden","terrace","parking","elevator","generator","storage","gym","balcony","sea-access","solar","security"],
  "payment": "installments" | "cash" | null,
  "building_age": "new-building" | "recent" | "old-building" | null,
  "lifestyle": array from: ["luxury","quiet","prime-location","gated","corner-unit","last-unit","investment"]
}
Be conservative — only extract what is clearly mentioned. Return null for unknown fields."""

async def extract_tags(title: str, description: str | None, client: httpx.AsyncClient) -> dict:
    if not ANTHROPIC_KEY:
        return {}

    content = f"Title: {title}"
    if description:
        content += f"\nDescription: {description[:300]}"

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
                "max_tokens": 300,
                "system": SYSTEM,
                "messages": [{"role": "user", "content": content}],
            },
            timeout=20,
        )
        if resp.status_code == 429:
            await asyncio.sleep(3)
            return {}
        data = resp.json()
        if resp.status_code != 200 or "content" not in data:
            return {}
        text = data["content"][0]["text"].strip().replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception:
        return {}
