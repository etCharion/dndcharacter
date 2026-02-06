import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('http://localhost:8000')
        await asyncio.sleep(2)
        # Check if renderAll works
        result = await page.evaluate("""() => {
            try {
                if (window.renderAll) {
                    window.renderAll();
                    return "Success";
                }
                return "renderAll not found";
            } catch (e) {
                return e.message;
            }
        }""")
        print(f"Result: {result}")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
