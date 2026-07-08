import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:4173/';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const logs = [];
const errors = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', r => errors.push('REQFAIL: ' + r.url() + ' :: ' + (r.failure()?.errorText)));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => errors.push('GOTO: ' + e.message));
await page.waitForTimeout(3000);

// What actually rendered?
const appHTML = await page.$eval('#app', el => el.innerHTML.length).catch(() => -1);
const homeView = await page.$eval('#view-home', el => el.innerText.slice(0, 300)).catch(() => 'NO HOME');
const title = await page.title();
const modals = await page.evaluate(() => {
  const ids = ['account-setup-modal','section-select-modal','avatar-choice-modal'];
  return ids.map(id => { const e=document.getElementById(id); return id + ':' + (e?getComputedStyle(e).display:'missing'); });
});

console.log('=== TITLE ===', title);
console.log('=== #app innerHTML length ===', appHTML);
console.log('=== MODALS ===', modals.join(' | '));
console.log('=== HOME VIEW TEXT (first 300) ===');
console.log(homeView);
console.log('=== PAGE ERRORS ===');
console.log(errors.join('\n') || '(none)');
console.log('=== CONSOLE LOGS (last 40) ===');
console.log(logs.slice(-40).join('\n'));

await browser.close();
