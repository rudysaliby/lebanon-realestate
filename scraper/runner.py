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
    def __init__(self, name, total_pages):
        self.name          = name
        self.total_pages   = total_pages
        self.pages_done    = 0
        self.listings_found = 0      # actual listings found from pages
        self.details_done  = 0
        self.details_ok    = 0       # details that returned a valid listing
        self.phase         = "pages" # "pages" or "details"
        self.start         = time.time()
        self.finished      = False
        self.summary       = ""

    def page_done(self, listings_on_page):
        self.pages_done     += 1
        self.listings_found += listings_on_page

    def detail_done(self, success: bool):
        self.details_done += 1
        if success:
            self.details_ok += 1

    def start_details(self):
        self.phase = "details"

    def finish(self, summary=""):
        self.finished = True
        self.summary  = summary

    def render(self):
        elapsed = time.time() - self.start
        sym = "✓" if self.finished else "⟳"

        if self.finished:
            # Always 100% bar on finish, summary next to it
            bar  = _bar(100)
            line = (f"\r  {sym} {self.name:<5} [{bar}] 100%"
                    f"  {_fmt(elapsed)}"
                    f"  {self.summary:<55}")

        elif self.phase == "pages":
            pct  = int(self.pages_done / self.total_pages * 100) if self.total_pages > 0 else 0
            bar  = _bar(pct)
            rate = self.pages_done / elapsed if elapsed > 0 and self.pages_done > 0 else 0
            eta  = (self.total_pages - self.pages_done) / rate if rate > 0 else -1
            line = (f"\r  {sym} {self.name:<5} [{bar}] {pct:>3}%"
                    f"  {_fmt(elapsed)} elapsed  ETA {_fmt(eta)}"
                    f"  page {self.pages_done}/{self.total_pages}"
                    f"  {self.listings_found} listings found{' '*10}")

        else:  # details phase
            total = self.listings_found
            pct   = int(self.details_done / total * 100) if total > 0 else 0
            bar   = _bar(pct)
            rate  = self.details_done / elapsed if elapsed > 0 and self.details_done > 0 else 0
            eta   = (total - self.details_done) / rate if rate > 0 else -1
            ok_pct = int(self.details_ok / self.details_done * 100) if self.details_done > 0 else 0
            line  = (f"\r  {sym} {self.name:<5} [{bar}] {pct:>3}%"
                     f"  {_fmt(elapsed)} elapsed  ETA {_fmt(eta)}"
                     f"  detail {self.details_done}/{total}"
                     f"  {self.details_ok} saved ({ok_pct}%){' '*5}")

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

async def render_loop(progs, stop_event):
    n = len(progs)
    while not stop_event.is_set():
        sys.stdout.write(f"\033[{n}A")
        for p in progs:
            p.render()
            sys.stdout.write("\n")
        sys.stdout.flush()
        await asyncio.sleep(0.5)

async def run():
    run_start = time.time()

    print("█" * 57)
    print("  🏠 LEBANON REAL ESTATE SCRAPER")
    print(f"  Started: {time.strftime('%H:%M:%S')}")
    print("█" * 57)
    print("\n── STEP 1/4  OLX + Realestate.com.lb in parallel\n")

    OLX_PAGES  = 100
    RELB_PAGES = 131

    olx_prog  = ScrapeProgress("OLX",  OLX_PAGES)
    relb_prog = ScrapeProgress("RELB", RELB_PAGES)

    sys.stdout.write(f"  ⟳ OLX   [{'░'*20}]   0%  starting...\n")
    sys.stdout.write(f"  ⟳ RELB  [{'░'*20}]   0%  starting...\n")
    sys.stdout.flush()

    olx_result  = []
    relb_result = []
    stop_render = asyncio.Event()

    # Callback objects passed to scrapers
    import re as _re

    class OLXCb:
        def update(self, n=1, label=""):
            if "listing pages" in label or ("page" in label.lower() and "detail" not in label.lower()):
                m = _re.search(r"found:(\d+)", label)
                count = int(m.group(1)) if m else 45
                olx_prog.page_done(count)
            elif "detail" in label.lower():
                if olx_prog.phase == "pages":
                    olx_prog.start_details()
                success = "error" not in label.lower()
                olx_prog.detail_done(success)

    class RELBCb:
        def update(self, n=1, label=""):
            if "page" in label.lower() and "detail" not in label.lower():
                m = _re.search(r"found:(\d+)", label)
                count = int(m.group(1)) if m else 20
                relb_prog.page_done(count)
            elif "detail" in label.lower():
                if relb_prog.phase == "pages":
                    relb_prog.start_details()
                success = "error" not in label.lower()
                relb_prog.detail_done(success)

    async def run_olx():
        nonlocal olx_result
        try:
            olx_result = await OLXScraper().scrape(max_pages=OLX_PAGES, progress=OLXCb())
            with_coords = sum(1 for l in olx_result if l.lat)
            pct = round(with_coords / max(len(olx_result), 1) * 100)
            scanned = olx_prog.listings_found
            saved_pct = round(len(olx_result) / max(scanned, 1) * 100)
            olx_prog.finish(f"scanned {scanned}  →  saved {len(olx_result)} ({saved_pct}%)  |  {with_coords} with coords ({pct}%)")
        except Exception as e:
            olx_prog.finish(f"ERROR: {e}")

    async def run_relb():
        nonlocal relb_result
        await asyncio.sleep(0.2)
        try:
            relb_result = await RealEstateLBScraper().scrape(max_pages=9999, progress=RELBCb())
            with_coords = sum(1 for l in relb_result if l.lat)
            pct = round(with_coords / max(len(relb_result), 1) * 100)
            scanned = relb_prog.listings_found
            saved_pct = round(len(relb_result) / max(scanned, 1) * 100)
            relb_prog.finish(f"scanned {scanned}  →  saved {len(relb_result)} ({saved_pct}%)  |  {with_coords} with coords ({pct}%)")
        except Exception as e:
            relb_prog.finish(f"ERROR: {e}")

    scraper_task = asyncio.gather(run_olx(), run_relb())
    render_task  = asyncio.create_task(render_loop([olx_prog, relb_prog], stop_render))
    await scraper_task
    stop_render.set()
    render_task.cancel()
    try: await render_task
    except asyncio.CancelledError: pass

    # Final render — always 100% with summary
    sys.stdout.write("\033[2A")
    olx_prog.render();  sys.stdout.write("\n")
    relb_prog.render(); sys.stdout.write("\n")
    sys.stdout.flush()

    all_listings = olx_result + relb_result
    with_coords  = sum(1 for l in all_listings if l.lat)
    pct = round(with_coords / max(len(all_listings), 1) * 100)
    print(f"\n  📊 Total: {len(all_listings)} listings  |  {with_coords} with coords ({pct}%)")

    # ── STEP 2: DB ────────────────────────────────────────────
    print(f"\n── STEP 2/4  Saving to database")
    sys.stdout.write(f"  ⟳ Saving {len(all_listings)} listings...")
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

    elapsed = time.time() - run_start
    print("\n" + "█" * 57)
    print(f"  ✅ ALL DONE in {_fmt(elapsed)}")
    print(f"  {saved} listings  |  Finished: {time.strftime('%H:%M:%S')}")
    print("█" * 57 + "\n")

if __name__ == "__main__":
    asyncio.run(run())