const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + process.cwd() + '/index.html');

  // Switch to Combat tab
  await page.click('button:has-text("COMBAT & INV")');

  // Click Actions header to collapse
  await page.click('.combat-section-header:has-text("ACTIONS")');

  // Check if content is hidden
  const isHidden = await page.isHidden('#actions-list');
  console.log('Actions list hidden after click:', isHidden);

  // Click Add Attack
  await page.click('button:has-text("+ ADD ATTACK")');
  const attacksCount = await page.locator('.attack-item').count();
  console.log('Attacks count after clicking + ADD ATTACK:', attacksCount);

  await page.screenshot({ path: '/home/jules/verification/fix_verification.png', fullPage: true });
  await browser.close();
})();
