import asyncio
import os
import sys
import time
import httpx
from dotenv import load_dotenv
load_dotenv()

from scrapers.olx import OLXScraper
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
    def __init__(self, name, total_pages):
        self.name           = name
        self.total_pages    = total_pages
        self.pages_done     = 0
        self.listings_found = 0
        self.details_done   = 0
        self.details_ok     = 0
        self.phase          = "pages"
        self.start          = time.time()
        self.finished       = False
        self.summary        = ""

    def update(self, n=1, label=""):
        import re as _re
        if "detail" in label.lower():
            if self.phase == "pages":
                self.phase = "details"
            self.details_done += n
            if "error" not in label.lower(): self.details_ok += n
        else:
            m = _re.search(r"found:(\d+)", label)
            count = int(m.group(1)) if m else 45
            self.pages_done     += n
            self.listings_found += count

    def finish(self, summary=""):
        self.finished = True
        self.summary  = summary

    def render(self):
        elapsed = time.time() - self.start
        sym = "✓" if self.finished else "⟳"

        if self.finished:
            bar  = _bar(100)
            line = (f"\r  {sym} {self.name:<5} [{bar}] 100%"
                    f"  {_fmt(elapsed)}"
                    f"  {self.summary:<60}")
        elif self.phase == "pages":
            pct  = int(self.pages_done / max(self.total_pages, 1) * 100)
            bar  = _bar(pct)
            rate = self.pages_done / elapsed if elapsed > 0 and self.pages_done > 0 else 0
            eta  = (self.total_pages - self.pages_done) / rate if rate > 0 else -1
            line = (f"\r  {sym} {self.name:<5} [{bar}] {pct:>3}%"
                    f"  {_fmt(elapsed)} elapsed  ETA {_fmt(eta)}"
                    f"  page {self.pages_done}/{self.total_pages}"
                    f"  {self.listings_found} found{' '*10}")
        else:
            total = max(self.listings_found, 1)
            pct   = int(self.details_done / total * 100)
            bar   = _bar(pct)
            rate  = self.details_done / elapsed if elapsed > 0 and self.details_done > 0 else 0
            eta   = (total - self.details_done) / rate if rate > 0 else -1
            ok_pct = int(self.details_ok / max(self.details_done, 1) * 100)
            line  = (f"\r  {sym} {self.name:<5} [{bar}] {pct:>3}%"
                     f"  {_fmt(elapsed)} elapsed  ETA {_fmt(eta)}"
                     f"  detail {self.details_done}/{total}"
                     f"  {self.details_ok} saved ({ok_pct}%){' '*5}")

        sys.stdout.write(line)
        sys.stdout.flush()

async def cleanup_dead_listings():
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/listings",
            headers=HEADERS_SB,
            params={"is_active": "eq.true", "lat": "is.null", "area": "is.null"}
        )
        return resp.status_code in (200, 204)

async def render_loop(prog, stop_event):
    while not stop_event.is_set():
        sys.stdout.write("\033[1A")
        prog.render()
        sys.stdout.write("\n")
        sys.stdout.flush()
        await asyncio.sleep(0.5)

async def run():
    run_start = time.time()

    print("█" * 57)
    print("  🏠 LEBANON REAL ESTATE SCRAPER  (OLX only)")
    print(f"  Started: {time.strftime('%H:%M:%S')}")
    print("█" * 57)
    print("\n── STEP 1/4  Scraping all OLX property categories\n")

    # Total pages across all categories
    TOTAL_PAGES = 659 + 172 + 78 + 29 + 17 + 165 + 151  # 1271
    prog = ScrapeProgress("OLX", TOTAL_PAGES)

    sys.stdout.write(f"  ⟳ OLX   [{'░'*20}]   0%  starting...\n")
    sys.stdout.flush()

    olx_result  = []
    stop_render = asyncio.Event()

    async def run_olx():
        nonlocal olx_result
        try:
            olx_result = await OLXScraper().scrape(max_pages=500, progress=prog)
            with_coords = sum(1 for l in olx_result if l.lat)
            suspect     = sum(1 for l in olx_result if l._price_suspect)
            scanned     = prog.listings_found
            saved_pct   = round(len(olx_result) / max(scanned, 1) * 100)
            prog.finish(
                f"scanned {scanned}  →  saved {len(olx_result)} ({saved_pct}%)"
                f"  |  {with_coords} coords  |  {suspect} suspect prices"
            )
        except Exception as e:
            prog.finish(f"ERROR: {e}")

    scraper_task = asyncio.create_task(run_olx())
    render_task  = asyncio.create_task(render_loop(prog, stop_render))
    await scraper_task
    stop_render.set()
    render_task.cancel()
    try: await render_task
    except asyncio.CancelledError: pass

    # Final render
    sys.stdout.write("\033[1A")
    prog.render()
    sys.stdout.write("\n")
    sys.stdout.flush()

    with_coords = sum(1 for l in olx_result if l.lat)
    pct = round(with_coords / max(len(olx_result), 1) * 100)
    print(f"\n  📊 Total: {len(olx_result)} | {with_coords} with coords ({pct}%)")

    # ── STEP 2: DB ────────────────────────────────────────────────────────────
    print(f"\n── STEP 2/4  Saving to database")
    sys.stdout.write(f"  ⟳ Saving {len(olx_result)} listings...")
    sys.stdout.flush()
    saved = await upsert_listings(olx_result)
    sys.stdout.write(f"\r  ✓ Saved {saved} listings{' '*30}\n")
    sys.stdout.flush()

    # ── STEP 3: Enrichment ────────────────────────────────────────────────────
    without = len(olx_result) - with_coords
    suspect = sum(1 for l in olx_result if l._price_suspect)
    print(f"\n── STEP 3/4  Enrichment ({without} need location | {suspect} need price check)")
    sys.stdout.write(f"  ⟳ Running enrichment...")
    sys.stdout.flush()
    await run_enrichment()
    sys.stdout.write(f"\r  ✓ Enrichment complete{' '*40}\n")
    sys.stdout.flush()

    # ── STEP 4: Cleanup ───────────────────────────────────────────────────────
    print(f"\n── STEP 4/4  Cleanup")
    sys.stdout.write(f"  ⟳ Removing listings with no location...")
    sys.stdout.flush()
    await cleanup_dead_listings()
    sys.stdout.write(f"\r  ✓ Cleanup done{' '*40}\n")
    sys.stdout.flush()

    elapsed = time.time() - run_start
    print("\n" + "█" * 57)
    print(f"  ✅ ALL DONE in {_fmt(elapsed)}")
    print(f"  {saved} listings  |  Finished: {time.strftime('%H:%M:%S')}")
    print("█" * 57 + "\n")

if __name__ == "__main__":
    asyncio.run(run())