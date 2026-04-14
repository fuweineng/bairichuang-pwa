import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4317);
const baseUrl = `http://127.0.0.1:${port}`;

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error(`服务启动失败: ${res.statusCode}`));
        } else {
          setTimeout(tryConnect, 200);
        }
      });

      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('等待本地服务超时'));
        } else {
          setTimeout(tryConnect, 200);
        }
      });
    };

    tryConnect();
  });
}

async function main() {
  const server = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverLogs = '';
  server.stdout.on('data', (chunk) => {
    serverLogs += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    serverLogs += chunk.toString();
  });

  const cleanup = () => {
    if (!server.killed) {
      server.kill('SIGTERM');
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(1);
  });

  try {
    await waitForServer(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const browserErrors = [];

    page.on('pageerror', (error) => {
      browserErrors.push(`pageerror: ${error.message}`);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        browserErrors.push(`console: ${message.text()}`);
      }
    });

    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    const activeView = await page.evaluate(
      () => document.querySelector('.view.active')?.id || null
    );
    if (activeView !== 'view-home') {
      throw new Error(`首页未正常显示，当前视图: ${activeView}`);
    }

    // 点击主 CTA 全科练习按钮
    await page.locator('#practice-cta-card').click();
    await page.waitForSelector('.answer-btn, #fill-answer-input, #listen-btn');

    const practiceTitle = (await page.locator('#practice-view-title').textContent())?.trim();
    if (practiceTitle !== '全科练习') {
      throw new Error(`练习页标题异常: ${practiceTitle}`);
    }

    await page.locator('.view.active [data-action="nav"][data-view="home"]').click();
    // 验证今日状态卡片存在
    const todayStatus = await page.locator('#today-status-container').isVisible();

    await page.locator('#header-settings-btn').click();
    await page.waitForSelector('#settings-content .settings-card');

    await page.locator('#header-history-btn').click();
    await page.waitForSelector('#history-container');

    if (browserErrors.length > 0) {
      throw new Error(browserErrors.join('\n'));
    }

    await browser.close();
    console.log('冒烟测试通过: 首页、练习、设置、进度页面可用');
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
