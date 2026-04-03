"""
Quick test for AI tag extraction — tests 5 listings from DB.
Run: python test_tags.py
"""
import asyncio
import os
import httpx
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

async def test():
    print("=" * 55)
    print("Testing AI tag extraction (5 listings)...")
    print("=" * 55)

    if not ANTHROPIC_KEY:
        print("ERROR: ANTHROPIC_API_KEY not set")
        return

    # Fetch 5 untagged listings
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/listings",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
            params={
                "select": "id,title,description",
                "ai_tags_done": "eq.false",
                "is_active": "eq.true",
                "limit": "5",
            }
        )
        listings = resp.json()
        print(f"Found {len(listings)} untagged listings\n")

        if not listings:
            print("No untagged listings found — all done!")
            return

        from ai_tagger import extract_tags
        ai_client = httpx.AsyncClient(timeout=30)

        for l in listings:
            title = l.get("title","")
            desc  = l.get("description","")
            print(f"Title: {title[:60]}")
            tags = await extract_tags(title, desc, ai_client)
            print(f"Tags:  {tags}")
            print()

        await ai_client.aclose()

asyncio.run(test())
