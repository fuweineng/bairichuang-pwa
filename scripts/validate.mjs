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

function isRelativeAsset(value) {
  return typeof value === 'string' && value !== '' && !value.startsWith('http') && !value.startsWith('data:');
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

  const requiredSubjects = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics'];
  for (const subject of requiredSubjects) {
    if (!subjectCounts[subject]) {
      errors.push(`题库缺少科目: ${subject}`);
    }
  }

  for (const question of questionBank) {
    if (question.type === 'choice' && Array.isArray(question.options) && question.options.length > 0) {
      const firstOpt = question.options[0];
      const isNewFormat = typeof firstOpt === 'object' && firstOpt !== null;
      const opts = isNewFormat ? question.options.map(o => o.label) : question.options;
      if (!opts.includes(question.answer)) {
        errors.push(`选择题答案不在选项中: ${question.id} (answer=${question.answer})`);
      }
    }

    if (question.type === 'listening') {
      if (!Array.isArray(question.choices) || question.choices.length < 2) {
        errors.push(`听力题缺少 choices: ${question.id}`);
      }
      if (!question.audio_text && !question.audioUrl && !question.tts) {
        errors.push(`听力题缺少音频信息: ${question.id}`);
      }
    }

    if ((question.type === 'dictation' || question.type === 'passage_dictation') && !question.text && !question.passage && !question.audioUrl && !question.tts) {
      errors.push(`听写题缺少朗读内容: ${question.id}`);
    }

    const imageRefs = [
      question.image,
      question.imageUrl,
      ...(Array.isArray(question.images) ? question.images : []),
    ].filter(Boolean);

    for (const ref of imageRefs) {
      if (isRelativeAsset(ref)) {
        await ensureFile(ref, `题库图片资源(${question.id})`, errors);
      }
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
