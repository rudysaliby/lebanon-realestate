import asyncio
import os
import sys
import time
import httpx
from dotenv import load_dotenv
load_dotenv()

from scrapers.olx import OLXScraper
from scrapers.realestateLB import RealEstateLBScraper
from db import upsert_listings
from enrich_all import run_enrichment

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]
HEADERS_SB = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# ── Global progress tracker ───────────────────────────────────────────────────
class Progress:
    def __init__(self, total_work: int):
        self.total    = total_work
        self.done     = 0
        self.start    = time.time()
        self.label    = ""

    def update(self, n: int = 1, label: str = ""):
        self.done += n
        if label:
            self.label = label
        self._render()

    def set_label(self, label: str):
        self.label = label
        self._render()

    def _render(self):
        elapsed = time.time() - self.start
        pct     = min(int(self.done / self.total * 100), 100)
        bar     = "█" * (pct // 5) + "░" * (20 - pct // 5)
        rate    = self.done / elapsed if elapsed > 0 else 0
        eta     = (self.total - self.done) / rate if rate > 0 and self.done > 0 else 0
        line    = (f"\r  [{bar}] {pct:>3}%  |  {_fmt(elapsed)} elapsed"
                   f"  |  ETA: {_fmt(eta)}  |  {self.label}          ")
        sys.stdout.write(line)
        sys.stdout.flush()

    def finish(self, msg: str = ""):
        self.done = self.total
        self._render()
        sys.stdout.write(f"\n  ✓ {msg}\n")
        sys.stdout.flush()

def _fmt(s: float) -> str:
    if s < 60:   return f"{int(s)}s"
    if s < 3600: return f"{int(s//60)}m{int(s%60):02d}s"
    return f"{int(s//3600)}h{int((s%3600)//60):02d}m"

def banner(text: str):
    print(f"\n── {text}")

async def cleanup_unlocatable():
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/listings",
            headers=HEADERS_SB,
            params={"is_active": "eq.true", "lat": "is.null", "area": "is.null"}
        )
        return resp.status_code in (200, 204)

async def run():
    run_start = time.time()

    # Estimate total work units
    OLX_PAGES    = 100
    OLX_DETAILS  = OLX_PAGES * 45   # ~4,500
    RELB_PAGES   = 131
    RELB_DETAILS = 2607
    EXTRA        = 300               # DB + enrichment + cleanup
    TOTAL        = OLX_PAGES + OLX_DETAILS + RELB_PAGES + RELB_DETAILS + EXTRA

    prog = Progress(TOTAL)

    print("█" * 55)
    print("  🏠 LEBANON REAL ESTATE SCRAPER")
    print(f"  Started: {time.strftime('%H:%M:%S')}  |  Est. ~8-12 min")
    print("█" * 55)

    # ── STEP 1: OLX ──────────────────────────────────────────
    banner("STEP 1/5  OLX scraper (100 pages, ~4,500 listings)")
    olx_result = []
    try:
        olx_result = await OLXScraper().scrape(max_pages=OLX_PAGES, progress=prog)
    except Exception as e:
        print(f"\n  ✗ OLX error: {e}")
    prog.done = OLX_PAGES + OLX_DETAILS  # normalize
    prog.finish(f"OLX: {len(olx_result)} listings | {sum(1 for l in olx_result if l.lat)} with coords")

    # ── STEP 2: RELB ─────────────────────────────────────────
    banner("STEP 2/5  Realestate.com.lb (~2,607 listings, 131 pages)")
    relb_result = []
    try:
        relb_result = await RealEstateLBScraper().scrape(max_pages=9999, progress=prog)
    except Exception as e:
        print(f"\n  ✗ RELB error: {e}")
    prog.done = OLX_PAGES + OLX_DETAILS + RELB_PAGES + RELB_DETAILS  # normalize
    prog.finish(f"RELB: {len(relb_result)} listings | {sum(1 for l in relb_result if l.lat)} with coords")

    all_listings = olx_result + relb_result
    with_coords  = sum(1 for l in all_listings if l.lat)
    print(f"\n  📊 Total scraped: {len(all_listings)} | {with_coords} with coords ({round(with_coords/max(len(all_listings),1)*100)}%)")

    # ── STEP 3: DB ────────────────────────────────────────────
    banner("STEP 3/5  Saving to database")
    prog.set_label("saving to Supabase...")
    saved = await upsert_listings(all_listings)
    prog.update(100, "database saved")
    prog.finish(f"Saved {saved} listings")

    # ── STEP 4: Enrichment ────────────────────────────────────
    without = len(all_listings) - with_coords
    banner(f"STEP 4/5  Enrichment (~{without} need location lookup)")
    prog.set_label("enriching locations + tags...")
    await run_enrichment()
    prog.update(150, "enrichment done")
    prog.finish("Enrichment complete")

    # ── STEP 5: Cleanup ───────────────────────────────────────
    banner("STEP 5/5  Cleanup")
    prog.set_label("removing unlocatable listings...")
    await cleanup_unlocatable()
    prog.update(50, "cleanup done")
    prog.finish("Cleanup complete")

    # ── Final summary ─────────────────────────────────────────
    print("\n" + "█"*55)
    print(f"  ✅ ALL DONE in {_fmt(time.time()-run_start)}")
    print(f"  {saved} listings  |  Finished: {time.strftime('%H:%M:%S')}")
    print("█"*55 + "\n")

if __name__ == "__main__":
    asyncio.run(run())