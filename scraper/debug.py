import asyncio
from playwright.async_api import async_playwright

async def debug():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width":1280,"height":800}
        )
        page = await context.new_page()
        print("Loading...")
        await page.goto("https://www.realestate.com.lb/en/buy-properties-lebanon", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)

        # Count MuiGrid-grid-xs-true elements
        cards = await page.query_selector_all(".MuiGrid-grid-xs-true")
        print(f"MuiGrid-grid-xs-true: {len(cards)}")

        # Print class of ALL items that have a property link
        links = await page.query_selector_all("a[href*='/en/buy-properties-lebanon/']")
        print(f"Property links found: {len(links)}")
        for i, link in enumerate(links[:5]):
            href = await link.get_attribute("href")
            # Get parent element classes
            parent = await link.evaluate("el => el.parentElement.className")
            gparent = await link.evaluate("el => el.parentElement.parentElement.className")
            print(f"\nLink {i+1}: {href[:80]}")
            print(f"  Parent class: {parent[:80]}")
            print(f"  Grandparent class: {gparent[:80]}")

        await browser.close()

asyncio.run(debug())
