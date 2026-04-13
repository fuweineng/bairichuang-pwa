import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function resolveRoot(...parts) {
  return path.resolve(rootDir, ...parts);
}

async function readText(relativePath) {
  return fs.readFile(resolveRoot(relativePath), 'utf8');
}

async function ensureFile(relativePath, label, errors) {
  try {
    await fs.access(resolveRoot(relativePath));
  } catch {
    errors.push(`${label} 缺失: ${relativePath}`);
  }
}

function extractLocalRefs(html) {
  const refs = new Set();
  const pattern = /\b(?:src|href)="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(html))) {
    const value = match[1];
    if (!value || value.startsWith('http') || value.startsWith('data:') || value.startsWith('#')) {
      continue;
    }
    refs.add(value);
  }
  return [...refs];
}

function extractPrecacheRefs(swSource) {
  const match = swSource.match(/const PRECACHE = \[(.*?)\];/s);
  if (!match) {
    return [];
  }
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

async function main() {
  const errors = [];

  const packageJson = JSON.parse(await readText('package.json'));
  const manifest = JSON.parse(await readText('manifest.webmanifest'));
  const version = JSON.parse(await readText('version.json'));
  const html = await readText('index.html');
  const swSource = await readText('sw.js');
  const questionBank = JSON.parse(await readText('questions/question_bank_v1.json'));

  for (const ref of extractLocalRefs(html)) {
    await ensureFile(ref, 'index.html 资源引用', errors);
  }

  for (const icon of manifest.icons || []) {
    if (icon.src) {
      await ensureFile(icon.src, 'manifest 图标', errors);
    }
  }

  if (manifest.start_url && manifest.start_url.startsWith('./')) {
    await ensureFile(manifest.start_url.slice(2), 'manifest start_url', errors);
  }

  for (const ref of extractPrecacheRefs(swSource)) {
    if (ref === './') {
      await ensureFile('index.html', 'SW 预缓存入口', errors);
      continue;
    }
    if (ref.startsWith('./')) {
      await ensureFile(ref.slice(2), 'SW 预缓存资源', errors);
    }
  }

  const subjectCounts = questionBank.reduce((acc, question) => {
    acc[question.subject] = (acc[question.subject] || 0) + 1;
    return acc;
  }, {});

  const requiredSubjects = ['chinese', 'math', 'english', 'science', 'biology', 'history', 'geography', 'politics'];
  for (const subject of requiredSubjects) {
    if (!subjectCounts[subject]) {
      errors.push(`题库缺少科目: ${subject}`);
    }
  }

  if (!Number.isInteger(version.version) || version.version < 1) {
    errors.push('version.json 的 version 必须是大于 0 的整数');
  }

  if (packageJson.version !== manifest.version) {
    errors.push(`package.json (${packageJson.version}) 与 manifest.webmanifest (${manifest.version}) 版本不一致`);
  }

  if (errors.length > 0) {
    console.error('项目校验失败:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const totalQuestions = questionBank.length;
  console.log(`校验通过: ${totalQuestions} 道题, 资源引用完整, PWA 配置可解析`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
