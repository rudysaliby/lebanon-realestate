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

class LineProgress:
    """Single-line progress tracker for one scraper. Uses ANSI to stay on its line."""
    def __init__(self, label: str, total: int, line: int):
        self.label   = label
        self.total   = total
        self.done    = 0
        self.start   = time.time()
        self.line    = line   # which terminal line (0 = first scraper, 1 = second)
        self.status  = "starting..."
        self.done_flag = False

    def update(self, n=1, status=""):
        self.done = min(self.done + n, self.total)
        if status: self.status = status
        self._render()

    def finish(self, msg=""):
        self.done = self.total
        self.done_flag = True
        self.status = msg or "done"
        self._render()
        # Move to next line after finishing
        sys.stdout.write("\n")
        sys.stdout.flush()

    def _render(self):
        elapsed = time.time() - self.start
        pct     = int(self.done / self.total * 100) if self.total > 0 else 0
        bar     = _bar(pct)
        rate    = self.done / elapsed if elapsed > 0 else 0
        eta     = (self.total - self.done) / rate if rate > 0 and self.done > 0 else -1
        eta_str = _fmt(eta) if not self.done_flag else _fmt(elapsed)
        prefix  = "✓" if self.done_flag else "⟳"
        line    = (f"\r  {prefix} {self.label:<8} [{bar}] {pct:>3}%"
                   f"  {_fmt(elapsed)} elapsed  ETA {eta_str}"
                   f"  {self.status[:45]:<45}")
        # Use ANSI to move to correct line if needed
        sys.stdout.write(line)
        sys.stdout.flush()

async def cleanup_unlocatable():
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/listings",
            headers=HEADERS_SB,
            params={"is_active": "eq.true", "lat": "is.null", "area": "is.null"}
        )
        return resp.status_code in (200, 204)

def simple_progress(label: str, msg: str):
    """Simple single-line updater for non-scraper steps."""
    sys.stdout.write(f"\r  ⟳ {label:<12} {msg:<60}")
    sys.stdout.flush()

def simple_done(label: str, msg: str):
    sys.stdout.write(f"\r  ✓ {label:<12} {msg:<60}\n")
    sys.stdout.flush()

async def run():
    run_start = time.time()

    print("█" * 57)
    print("  🏠 LEBANON REAL ESTATE SCRAPER")
    print(f"  Started: {time.strftime('%H:%M:%S')}")
    print("█" * 57)

    # ── STEP 1: Both scrapers in parallel ─────────────────────
    print("\n── STEP 1/4  Scraping (OLX + Realestate.com.lb in parallel)\n")

    # Two separate progress trackers — one per scraper
    # OLX: 100 pages + ~4500 details
    # RELB: 131 pages + 2607 details
    olx_prog  = LineProgress("OLX",  100 + 4500, line=0)
    relb_prog = LineProgress("RELB", 131 + 2607, line=1)

    # Print two blank lines to reserve space
    sys.stdout.write("  ⟳ OLX      [░░░░░░░░░░░░░░░░░░░░]   0%\n")
    sys.stdout.write("  ⟳ RELB     [░░░░░░░░░░░░░░░░░░░░]   0%\n")
    sys.stdout.flush()

    olx_result  = []
    relb_result = []
    lock = asyncio.Lock()

    async def run_olx():
        nonlocal olx_result
        try:
            # Move cursor up 2 lines to OLX line
            class OLXProg:
                def update(self, n=1, label=""):
                    sys.stdout.write("\033[2A")  # up 2 lines
                    olx_prog.update(n, label)
                    sys.stdout.write("\033[2B\r")  # back down 2
                    sys.stdout.flush()
            olx_result = await OLXScraper().scrape(max_pages=100, progress=OLXProg())
        except Exception as e:
            sys.stdout.write(f"\033[2A\r  ✗ OLX error: {e}\n\033[1B\r")
            sys.stdout.flush()

    async def run_relb():
        nonlocal relb_result
        await asyncio.sleep(0.1)  # tiny offset so OLX prints first
        try:
            # Move cursor up 1 line to RELB line
            class RELBProg:
                def update(self, n=1, label=""):
                    sys.stdout.write("\033[1A")  # up 1 line
                    relb_prog.update(n, label)
                    sys.stdout.write("\033[1B\r")  # back down 1
                    sys.stdout.flush()
            relb_result = await RealEstateLBScraper().scrape(max_pages=9999, progress=RELBProg())
        except Exception as e:
            sys.stdout.write(f"\033[1A\r  ✗ RELB error: {e}\n\033[1B\r")
            sys.stdout.flush()

    await asyncio.gather(run_olx(), run_relb())

    # Final status lines
    sys.stdout.write("\033[2A")
    olx_prog.finish(f"{len(olx_result)} listings | {sum(1 for l in olx_result if l.lat)} with coords")
    relb_prog.finish(f"{len(relb_result)} listings | {sum(1 for l in relb_result if l.lat)} with coords")

    all_listings = olx_result + relb_result
    with_coords  = sum(1 for l in all_listings if l.lat)
    print(f"\n  📊 Total: {len(all_listings)} listings | {with_coords} with coords ({round(with_coords/max(len(all_listings),1)*100)}%)")

    # ── STEP 2: DB ────────────────────────────────────────────
    print("\n── STEP 2/4  Saving to database")
    simple_progress("Database", f"saving {len(all_listings)} listings...")
    saved = await upsert_listings(all_listings)
    simple_done("Database", f"saved {saved} listings")

    # ── STEP 3: Enrichment ────────────────────────────────────
    without = len(all_listings) - with_coords
    print(f"\n── STEP 3/4  Enrichment (~{without} need location lookup)")
    simple_progress("Enrichment", "running location + tag enrichment...")
    await run_enrichment()
    simple_done("Enrichment", "complete")

    # ── STEP 4: Cleanup ───────────────────────────────────────
    print("\n── STEP 4/4  Cleanup")
    simple_progress("Cleanup", "removing unlocatable listings...")
    await cleanup_unlocatable()
    simple_done("Cleanup", "done")

    # ── Summary ───────────────────────────────────────────────
    elapsed = time.time() - run_start
    print("\n" + "█" * 57)
    print(f"  ✅ ALL DONE in {_fmt(elapsed)}")
    print(f"  {saved} listings  |  Finished: {time.strftime('%H:%M:%S')}")
    print("█" * 57 + "\n")

if __name__ == "__main__":
    asyncio.run(run())