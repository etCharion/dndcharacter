from playwright.sync_api import sync_playwright
import time

def verify_links():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto("http://localhost:8000")
        time.sleep(2)

        results = page.evaluate("""() => {
            const getUrl = (name, type) => {
                // Find item by name in master data if not in state
                let item = null;
                if (type === 'spell') item = window.__STATE__.spells.all.find(s => s.name === name);
                if (type === 'plan') item = window.__STATE__.plans.all.find(p => p.name === name);
                if (type === 'feature') item = window.__STATE__.features.find(f => f.name === name);
                if (!item && name === 'Steel Defender') item = window.__STATE__.steelDefender;

                // We need to call getWikidotUrl which is internal, but we can access it if we exposed it or just re-implement logic here to check
                // Actually js/app.js doesn't expose getWikidotUrl.
                // But we can check if item.url is present.
                return item ? item.url : null;
            };

            return {
                shield: getUrl('Shield +1', 'plan'),
                dragonsBreath: getUrl('Dragon’s Breath', 'spell'),
                extraAttack: getUrl('Extra Attack', 'feature'),
                steelDefender: getUrl('Steel Defender', 'feature')
            };
        }""")

        print(f"Verified URLs: {results}")

        # Check some values
        assert results['shield'] == "http://dnd2024.wikidot.com/magic-item:shield-1-2-or-3"
        assert "dragons-breath" in results['dragonsBreath']
        assert "artificer:main#toc10" in results['extraAttack']
        assert "artificer:battle-smith" in results['steelDefender']

        print("All tested URLs are correct!")
        browser.close()

if __name__ == "__main__":
    verify_links()
