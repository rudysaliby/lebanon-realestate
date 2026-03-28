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

def _fmt(s):
    if s < 0:    return "?:??"
    if s < 60:   return f"{int(s)}s"
    if s < 3600: return f"{int(s//60)}m{int(s%60):02d}s"
    return f"{int(s//3600)}h{int((s%3600)//60):02d}m"

def _bar(pct, width=20):
    filled = int(pct / 100 * width)
    return "█" * filled + "░" * (width - filled)

class ScrapeProgress:
    """Independent progress tracker for one scraper — renders on its own line."""
    def __init__(self, name: str, pages: int, details: int):
        self.name     = name
        self.pages    = pages
        self.details  = details
        self.total    = pages + details
        self.done     = 0
        self.start    = time.time()
        self.status   = "starting..."
        self.finished = False

    def update(self, n=1, status=""):
        self.done = min(self.done + n, self.total)
        if status: self.status = status

    def render(self, move_up=0):
        """Render this line, optionally moving cursor up first."""
        elapsed = time.time() - self.start
        pct     = int(self.done / self.total * 100) if self.total > 0 else 0
        bar     = _bar(pct)
        rate    = self.done / elapsed if elapsed > 0 else 0
        eta     = (self.total - self.done) / rate if rate > 0 and self.done > 0 else -1
        symbol  = "✓" if self.finished else "⟳"
        line    = (f"\r  {symbol} {self.name:<5} [{bar}] {pct:>3}%"
                   f"  {_fmt(elapsed)} elapsed"
                   f"  ETA {_fmt(eta) if not self.finished else '---'}"
                   f"  {self.status[:50]:<50}")
        if move_up:
            sys.stdout.write(f"\033[{move_up}A")
        sys.stdout.write(line)
        if move_up:
            sys.stdout.write(f"\033[{move_up}B\r")
        sys.stdout.flush()

    def finish(self, msg=""):
        self.done = self.total
        self.finished = True
        self.status = msg

async def cleanup_unlocatable():
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/listings",
            headers=HEADERS_SB,
            params={"is_active": "eq.true", "lat": "is.null", "area": "is.null"}
        )
        return resp.status_code in (200, 204)

async def render_loop(olx_prog: ScrapeProgress, relb_prog: ScrapeProgress, stop_event: asyncio.Event):
    """Background task that redraws both progress lines every 0.5s."""
    while not stop_event.is_set():
        # Redraw OLX line (2 lines up)
        sys.stdout.write("\033[2A")
        olx_prog.render()
        sys.stdout.write("\n")
        relb_prog.render()
        sys.stdout.write("\n")
        sys.stdout.flush()
        await asyncio.sleep(0.5)

async def run():
    run_start = time.time()

    print("█" * 57)
    print("  🏠 LEBANON REAL ESTATE SCRAPER")
    print(f"  Started: {time.strftime('%H:%M:%S')}")
    print("█" * 57)

    # ── STEP 1: Both scrapers in parallel ─────────────────────
    print("\n── STEP 1/4  Scraping OLX + Realestate.com.lb in parallel\n")

    OLX_PAGES   = 100
    OLX_DETAILS = OLX_PAGES * 45
    RELB_PAGES  = 131
    RELB_DET    = 2607

    olx_prog  = ScrapeProgress("OLX",  OLX_PAGES,  OLX_DETAILS)
    relb_prog = ScrapeProgress("RELB", RELB_PAGES, RELB_DET)

    # Reserve two lines for progress
    sys.stdout.write(f"  ⟳ OLX   [{'░'*20}]   0%  starting...\n")
    sys.stdout.write(f"  ⟳ RELB  [{'░'*20}]   0%  starting...\n")
    sys.stdout.flush()

    olx_result  = []
    relb_result = []
    stop_render = asyncio.Event()

    class OLXCallback:
        def update(self, n=1, label=""):
            olx_prog.update(n, label)

    class RELBCallback:
        def update(self, n=1, label=""):
            relb_prog.update(n, label)

    async def run_olx():
        nonlocal olx_result
        try:
            olx_result = await OLXScraper().scrape(max_pages=OLX_PAGES, progress=OLXCallback())
            olx_prog.finish(f"{len(olx_result)} listings | {sum(1 for l in olx_result if l.lat)} with coords")
        except Exception as e:
            olx_prog.finish(f"ERROR: {e}")

    async def run_relb():
        nonlocal relb_result
        await asyncio.sleep(0.2)
        try:
            relb_result = await RealEstateLBScraper().scrape(max_pages=9999, progress=RELBCallback())
            relb_prog.finish(f"{len(relb_result)} listings | {sum(1 for l in relb_result if l.lat)} with coords")
        except Exception as e:
            relb_prog.finish(f"ERROR: {e}")

    # Run both scrapers + render loop in parallel
    await asyncio.gather(
        run_olx(),
        run_relb(),
        render_loop(olx_prog, relb_prog, stop_render)
    )
    stop_render.set()

    # Final render
    sys.stdout.write("\033[2A")
    olx_prog.render()
    sys.stdout.write("\n")
    relb_prog.render()
    sys.stdout.write("\n")
    sys.stdout.flush()

    all_listings = olx_result + relb_result
    with_coords  = sum(1 for l in all_listings if l.lat)
    pct = round(with_coords / max(len(all_listings), 1) * 100)
    print(f"\n  📊 Total: {len(all_listings)} listings | {with_coords} with coords ({pct}%)")

    # ── STEP 2: DB ────────────────────────────────────────────
    print(f"\n── STEP 2/4  Saving to database")
    sys.stdout.write(f"  ⟳ Saving {len(all_listings)} listings to Supabase...")
    sys.stdout.flush()
    saved = await upsert_listings(all_listings)
    sys.stdout.write(f"\r  ✓ Saved {saved} listings{' '*30}\n")
    sys.stdout.flush()

    # ── STEP 3: Enrichment ────────────────────────────────────
    without = len(all_listings) - with_coords
    print(f"\n── STEP 3/4  Enrichment (~{without} need location lookup)")
    sys.stdout.write(f"  ⟳ Running enrichment...")
    sys.stdout.flush()
    await run_enrichment()
    sys.stdout.write(f"\r  ✓ Enrichment complete{' '*30}\n")
    sys.stdout.flush()

    # ── STEP 4: Cleanup ───────────────────────────────────────
    print(f"\n── STEP 4/4  Cleanup")
    sys.stdout.write(f"  ⟳ Removing unlocatable listings...")
    sys.stdout.flush()
    await cleanup_unlocatable()
    sys.stdout.write(f"\r  ✓ Cleanup done{' '*30}\n")
    sys.stdout.flush()

    # ── Summary ───────────────────────────────────────────────
    elapsed = time.time() - run_start
    print("\n" + "█" * 57)
    print(f"  ✅ ALL DONE in {_fmt(elapsed)}")
    print(f"  {saved} listings  |  Finished: {time.strftime('%H:%M:%S')}")
    print("█" * 57 + "\n")

if __name__ == "__main__":
    asyncio.run(run())