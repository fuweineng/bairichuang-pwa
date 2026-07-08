import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.locator('#account-setup-close-btn').click().catch(()=>{});
await page.locator('[data-action="choose-section"][data-section="junior"]').first().click().catch(()=>{});
await page.waitForTimeout(1500);
const headerBtns = await page.evaluate(() => {
  return [...document.querySelectorAll('header button, header [data-action]')].map(e => ({ id: e.id, action: e.dataset.action, view: e.dataset.view, text: e.textContent.trim() }));
});
console.log('HEADER ELEMENTS:', JSON.stringify(headerBtns, null, 2));
const settingsVisible = await page.locator('#header-settings-btn').count();
console.log('settings-btn count:', settingsVisible);
await browser.close();
