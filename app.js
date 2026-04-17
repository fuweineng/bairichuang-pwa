// 百日闯 PWA — 重构版

import { get, set, clear, del } from './js/idb-keyval.mjs';
import {
  formatDateKeyLabel,
  formatDateKeyShort,
  getLocalDateKey,
  listRecentDateKeys,
  shiftDate,
} from './js/date-utils.mjs';

'use strict';

// ============================================================
// STATE
// ============================================================
const state = {
  // Routing
  view: 'home',
  subject: null,
  entry: null, // null | 'new' | 'weak' | 'mastered'
  ttsUtterance: null,
  chartSubject: 'all',  // 'all' | subject name

  // Practice session
  sessionQuestions: [],
  sessionIndex: 0,
  sessionScore: { correct: 0, wrong: 0 },
  sessionResults: [],
  sessionStartTime: null,
  selectedChoice: null,   // { idx: number, submitted: bool } — null = 未选
  sessionStartQCount: 0,
  sessionStartCorrect: 0,

  // Persistent data (in-memory cache, synced to IndexedDB)
  questionBank: {},
  progress: {},
  daily: {},
  sessions: [],
  meta: {},
  account: null,
  settings: { section: 'junior', sectionVersions: {}, weakThreshold: 0.6, lastQuestionBankUpdate: null, appVersion: 1, audioVersion: '', questionBankVersion: '' },
  remoteVersions: null,
};

// ============================================================
// KEYS
// ============================================================
const K = {
  PROGRESS: 'question_progress',
  DAILY: 'checkin_daily',
  SESSIONS: 'checkin_sessions',
  META: 'checkin_meta',
  SETTINGS: 'settings',
  QB_CACHE: 'question_bank_cache',
  ACCOUNT: 'user_account',
};

const VERSION_URL = 'https://raw.githubusercontent.com/fuweineng/bairichuang-pwa/main/version.json';
const SUPPORTERS_URL = 'supporters.json';
const INDEX_URL = 'questions/index.json';
const SUBJECTS_ALL = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics'];

const SUBJECTS_BY_SECTION = {
  primary:   ['chinese', 'math', 'english'],
  junior:    ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics'],
  senior:    ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics'],
};

function getSubjects(section) {
  return SUBJECTS_BY_SECTION[section] || SUBJECTS_BY_SECTION.junior;
}

// Per-section index URLs for multi-section question bank support
const SECTION_INDEX_URLS = {
  primary: 'questions/primary/index.json',
  junior:  'questions/index.json',
  senior:  'questions/senior/index.json',
};

// Legacy — kept for migration
const SUBJECTS = SUBJECTS_ALL;

// Legacy key — kept for migration
const LEGACY_QB_CACHE = 'question_bank_cache';

// ============================================================
// THEME SYSTEM
// ============================================================
const THEMES = {
  morning:   { label: '早晨', start: 5,  end: 12 },
  afternoon: { label: '下午', start: 12, end: 18 },
  evening:   { label: '傍晚', start: 18, end: 22 },
  night:     { label: '深夜', start: 22, end: 5  }, // wraps to next day
};

const GREETINGS = {
  morning:   '早起的鸟儿有虫吃',
  afternoon:  '上午好，精神不错',
  evening:    '傍晚充电中',
  night:      '夜深了，还在坚持',
  midnight:   '夜猫子模式开启',
};

function getAutoTheme() {
  const h = new Date().getHours();
  if (h >= 5  && h < 7)  return 'morning';
  if (h >= 7  && h < 12) return 'morning';
  if (h >= 12 && h < 14) return 'afternoon';
  if (h >= 14 && h < 18) return 'afternoon';
  if (h >= 18 && h < 20) return 'evening';
  if (h >= 20 && h < 23) return 'night';
  return 'midnight';
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 7)  return GREETINGS.morning;
  if (h >= 7  && h < 12) return GREETINGS.morning;
  if (h >= 12 && h < 14) return GREETINGS.afternoon;
  if (h >= 14 && h < 18) return GREETINGS.morning; // "下午好，继续加油"
  if (h >= 18 && h < 20) return GREETINGS.evening;
  if (h >= 20 && h < 23) return GREETINGS.night;
  return GREETINGS.midnight;
}

function getEffectiveTheme() {
  return state.settings.theme || getAutoTheme();
}

function applyTheme(theme) {
  const effective = (theme === 'auto' || theme === null || theme === undefined)
    ? getAutoTheme()
    : theme;
  document.body.dataset.theme = effective;
}

// Auto theme ticker — update every 5 minutes when in auto mode
let _themeTickInterval = null;
function startAutoThemeTicker() {
  if (_themeTickInterval) clearInterval(_themeTickInterval);
  _themeTickInterval = setInterval(() => {
    if (state.settings.theme === 'auto' || state.settings.theme === null || state.settings.theme === undefined) {
      applyTheme('auto');
    }
  }, 5 * 60 * 1000);
}

function initTheme() {
  const saved = state.settings.theme;
  applyTheme(saved); // if saved is null, getEffectiveTheme() returns auto
  startAutoThemeTicker();
}

function createEmptyQuestionBank() {
  return { math: [], english: [], chinese: [], physics: [], chemistry: [], biology: [], history: [], geography: [], politics: [] };
}

// Migrate legacy question_bank_cache to new per-subject index.json format
async function migrateLegacyQB() {
  const cached = await get(LEGACY_QB_CACHE);
  if (!cached || typeof cached !== 'object') return null;
  // Already migrated (flat map)?
  if (Array.isArray(cached)) return null;
  const migrated = await fetchQuestionPack({ force: true });
  await del(LEGACY_QB_CACHE);
  console.log('[QB] 迁移: legacy question_bank_cache → index.json 格式');
  return migrated;
}

async function fetchQuestionPack({ section, force = false } = {}) {
  const sec = section || state.settings.section;
  const idxUrl = SECTION_INDEX_URLS[sec] || SECTION_INDEX_URLS.junior;
  const effectiveIdxUrl = force ? `${idxUrl}?_=${Date.now()}` : idxUrl;
  const idxResp = await fetch(effectiveIdxUrl, force ? { cache: 'no-store' } : undefined);
  if (!idxResp.ok) throw new Error(`题库索引加载失败: ${idxResp.status}`);
  const index = await idxResp.json();

  // Parallel load all subject files for this section
  const results = await Promise.all(
    getSubjects(sec).map(async (subj) => {
      const info = index.subjects?.[subj];
      if (!info) return [subj, []];
      const url = `${idxUrl.replace(/index\.json$/, '')}${info.file}`;
      try {
        const resp = await fetch(force ? `${url}?_=${Date.now()}` : url, force ? { cache: 'no-store' } : undefined);
        if (!resp.ok) return [subj, []];
        const data = await resp.json();
        return [subj, Array.isArray(data) ? data : []];
      } catch (e) {
        return [subj, []];
      }
    })
  );

  const grouped = createEmptyQuestionBank();
  for (const [subj, qs] of results) {
    grouped[subj] = qs;
  }
  return grouped;
}

function hasQuestionPackUpdate() {
  const remoteVersion = state.remoteVersions?.questionBankVersion;
  if (!remoteVersion) return false;
  return compareVersion(remoteVersion, state.settings.questionBankVersion || '0.0.0') > 0;
}

// ============================================================
// INIT
// ============================================================
async function init() {
  console.log('百日闯 PWA 初始化中...');

  // Load persisted state
  state.progress = await get(K.PROGRESS) || {};
  state.daily    = await get(K.DAILY)    || {};
  state.sessions = await get(K.SESSIONS) || [];
  state.meta     = await get(K.META)     || {};
  state.account  = await get(K.ACCOUNT)  || null;
  state.settings = await get(K.SETTINGS) || { section: 'junior', sectionVersions: {}, weakThreshold: 0.6, lastQuestionBankUpdate: null, appVersion: '9.1.2', audioVersion: '', questionBankVersion: '' };

  // Load local version from version.json
  try {
    const vr = await fetch('version.json?_=' + Date.now(), { cache: 'no-store' });
    if (vr.ok) {
      const vdata = await vr.json();
      state.settings.appVersion = vdata.version || '';
    }
  } catch(e) {}

  // Apply time-based theme
  initTheme();

  // Check for app shell and question pack updates
  state.remoteVersions = await checkForAppUpdate();

  // Load question bank: cache first, then refresh from network if cache is stale
  // Migrate legacy flat question_bank_cache if present
  const legacyCached = await get(LEGACY_QB_CACHE);
  if (legacyCached && typeof legacyCached === 'object' && !Array.isArray(legacyCached)) {
    // Legacy format found — migrate to new per-subject format
    const migrated = await fetchQuestionPack({ section: state.settings.section, force: true });
    await del(LEGACY_QB_CACHE);
    state.questionBank = migrated;
    await set(K.QB_CACHE, migrated);
  } else {
    const cached = await get(K.QB_CACHE);
    state.questionBank = cached || createEmptyQuestionBank();
  }
  fetchQuestionPack({ section: state.settings.section, force: true })
    .then(async (grouped) => {
      state.questionBank = grouped;
      state.settings.lastQuestionBankUpdate = todayKey();
      if (state.remoteVersions?.questionBankVersion) {
        state.settings.questionBankVersion = state.remoteVersions.questionBankVersion;
      }
      await set(K.QB_CACHE, grouped);
      await set(K.SETTINGS, state.settings);
      if (state.view === 'home') renderHome();
      if (state.view === 'settings') renderSettings();
    })
    .catch(() => {});

  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }

  // Bind events
  document.addEventListener('click', handleClick);
  window.addEventListener('hashchange', router);

  // Kick off router
  router();

  // Show account setup if first time
  if (!state.account) {
    showAccountSetupModal();
  }

  // Show section setup if first launch (no sessions ever)
  if (!state.meta.startDate) {
    showSectionSetupModal();
  }

  // Avatar choice modal
  document.getElementById('avatar-camera-input')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const preview = document.getElementById('avatar-preview');
      if (preview) preview.src = ev.target.result;
      document.getElementById('avatar-choice-modal').style.display = 'none';
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  // Close avatar choice modal buttons
  document.getElementById('avatar-choice-close-btn')?.addEventListener('click', () => {
    document.getElementById('avatar-choice-modal').style.display = 'none';
  });

  // Account setup confirm button
  document.getElementById('account-setup-confirm-btn')?.addEventListener('click', confirmAccountSetup);

  // Account setup close (skip → anonymous)
  document.getElementById('account-setup-close-btn')?.addEventListener('click', async () => {
    if (!state.account) {
      state.account = {
        name: '学生',
        avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23ddd'/%3E%3Ctext x='50' y='65' text-anchor='middle' font-size='50'%3E👤%3C/text%3E%3C/svg%3E",
        createdAt: Date.now()
      };
      await set(K.ACCOUNT, state.account);
    }
    document.getElementById('account-setup-modal').style.display = 'none';
  });

  // Completion modal confirm
  document.getElementById('completion-confirm-btn')?.addEventListener('click', () => {
    document.getElementById('completion-modal').style.display = 'none';
  });

  // QR import close
  document.getElementById('qr-import-close-btn')?.addEventListener('click', closeQRImport);

  // Donate modal close
  document.getElementById('donate-close-btn')?.addEventListener('click', () => {
    document.getElementById('donate-modal').style.display = 'none';
  });
  document.getElementById('donate-modal')?.addEventListener('click', e => {
    if (e.target.id === 'donate-modal') document.getElementById('donate-modal').style.display = 'none';
  });

  // Support modal close
  document.getElementById('support-modal')?.addEventListener('click', e => {
    if (e.target.id === 'support-modal') document.getElementById('support-modal').style.display = 'none';
  });
  document.getElementById('support-donate-btn')?.addEventListener('click', () => {
    document.getElementById('support-modal').style.display = 'none';
    document.getElementById('donate-modal').style.display = 'flex';
  });

  console.log('百日闯 PWA 初始化完成');
}

// 比较两个 X.Y.Z-YYYYMMDD 版本号：return positive if a > b
function compareVersion(a, b) {
  // Parse semver X.Y.Z, ignoring any -YYYYMMDD date suffix
  const parse = v => {
    const core = String(v || '0.0.0').split('-')[0];
    const parts = core.split('.').map(Number);
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
  };
  const va = parse(a), vb = parse(b);
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  if (va.patch !== vb.patch) return va.patch - vb.patch;
  return 0;
}

// ============================================================
// APP UPDATE
// ============================================================
async function checkForAppUpdate() {
  try {
    const resp = await fetch(`${VERSION_URL}?_=${Date.now()}`, { cache: 'no-store' });
    if (!resp.ok) return null;
    const remote = await resp.json();

    const localVer = state.settings.appVersion || '0.0.0';
    if (remote.version && compareVersion(remote.version, localVer) > 0) {
      showUpdateBanner(remote);
    }

    // Always save audio version for cache-busting
    if (remote.audioVersion) {
      state.settings.audioVersion = remote.audioVersion;
      await set(K.SETTINGS, state.settings);
    }
    return remote;
  } catch(e) {
    console.warn('Update check failed:', e);
    return null;
  }
}

function showUpdateBanner(remote) {
  const banner = document.getElementById('update-banner');
  if (banner) {
    banner.style.display = 'flex';
    banner.querySelector('.update-btn').onclick = () => doAppUpgrade(remote);
  }
}

async function doManualAppUpdateCheck() {
  const btn = document.getElementById('check-app-update-btn');
  if (btn) { btn.disabled = true; btn.textContent = '检查中...'; }

  try {
    const remote = await checkForAppUpdate();
    if (!remote?.version) {
      showToast('检查失败，请稍后重试');
    } else if (compareVersion(remote.version, state.settings.appVersion || '0.0.0') <= 0) {
      showToast('已是最新版本');
    } else {
      if (confirm(`发现新版本 v${remote.version}，是否更新？\n\n${remote.changelog || ''}`)) {
        doAppUpgrade(remote);
        return;
      }
    }
  } catch {
    showToast('检查失败，请稍后重试');
  }

  if (btn) { btn.disabled = false; btn.textContent = '检查更新'; }
}

async function doAppUpgrade(remote) {
  const banner = document.getElementById('update-banner');
  if (banner) banner.querySelector('.update-text').textContent = '正在更新...';

  // 1. Save new versions (keep QB cache — it survives app updates)
  state.settings.appVersion = remote.version;
  state.settings.audioVersion = remote.audioVersion || '';
  await set(K.SETTINGS, state.settings);

  // 2. Reload — SW will pick up new app.js
  location.reload();
}

// ============================================================
// ROUTER
// ============================================================
function router() {
  const hash = location.hash || '#/home';
  const [path, query] = hash.slice(2).split('?');
  const segs = path.split('/');
  const view = segs[0] || 'home';
  const params = query ? new URLSearchParams(query) : null;
  const entryParam = params ? params.get('entry') : null;

  state.view    = view;
  state.subject = segs[1] || null;
  state.entry = entryParam || null;

  renderAll();
}

function navigate(hash) {
  if (location.hash === hash) {
    router();
    return;
  }
  location.hash = hash;
}

// ============================================================
// RENDER
// ============================================================
function renderAll() {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + state.view);
  if (el) el.classList.add('active');

  switch (state.view) {
    case 'home':     renderHome();    break;
    case 'practice': renderPractice(); break;
    case 'progress': renderProgress(); break;
    case 'settings': renderSettings(); break;
  }
}

// HOME
async function renderHome() {
  // Reload persistent state from IndexedDB to catch any writes from other tabs/sessions
  state.daily = await get(K.DAILY) || {};
  state.progress = await get(K.PROGRESS) || {};
  state.meta = await get(K.META) || {};

  // Account info in header — always show avatar button (leads to settings)
  let accEl = document.getElementById('header-account-info');
  if (!accEl) {
    accEl = document.createElement('div');
    accEl.id = 'header-account-info';
    accEl.style.cssText = 'display:flex;align-items:center;gap:6px;margin-right:8px;cursor:pointer';
    accEl.dataset.action = 'open-avatar-choice';
    accEl.innerHTML = `
      <img id="header-account-avatar" src="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.15)">
      <span id="header-account-name" style="font-size:13px;font-weight:500;color:#fff;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>`;
    const headerRight = document.getElementById('header-right-container');
    headerRight.insertBefore(accEl, headerRight.firstChild);
  }
  const avatar = state.account?.avatar || '';
  const name = state.account?.name || '';
  document.getElementById('header-account-avatar').src = avatar;
  document.getElementById('header-account-avatar').style.background = avatar ? 'transparent' : '#aaa';
  document.getElementById('header-account-name').textContent = name;
  document.getElementById('header-account-name').style.display = name ? 'inline' : 'none';

  // Chart
  const homeChartEl = document.getElementById('home-chart-container');
  if (homeChartEl) homeChartEl.innerHTML = drawChart();

  // 全科练习大按钮 — 柱状图下方，主题色
  let allBtn = document.getElementById('home-all-btn');
  const hasAssessment = !!(state.meta.day1SubjectAcc);
  if (!allBtn) {
    allBtn = document.createElement('button');
    allBtn.id = 'home-all-btn';
    allBtn.className = 'chart-all-btn-large';
    homeChartEl.parentNode.insertBefore(allBtn, homeChartEl.nextSibling);
  }
  // 动态设置文字和 action
  if (hasAssessment) {
    allBtn.textContent = '全科练习';
    allBtn.dataset.action = 'start-subject';
    allBtn.dataset.subject = 'all';
    allBtn.dataset.entry = 'standard';
  } else {
    allBtn.textContent = '开始摸底测试';
    allBtn.dataset.action = 'start-assessment';
    allBtn.dataset.subject = 'all';
    allBtn.dataset.entry = 'assessment';
  }


  // Update badge
  const badge = document.getElementById('update-badge');
  if (badge) badge.style.display = hasQuestionPackUpdate() ? 'inline-block' : 'none';
}


// 计算某科目的掌握率 = 答对≥1次的题数 / 题库总题数（全部考点完整覆盖）
function getSubjectAccuracy(subj) {
  const questions = state.questionBank[subj] || [];
  if (questions.length === 0) return null;
  let mastered = 0;
  questions.forEach(q => {
    const p = state.progress[q.id];
    if (p && p.correct >= 1) mastered++;
  });
  // 有练习数据 → 用实际掌握率
  if (mastered > 0 || questions.some(q => state.progress[q.id])) {
    return Math.round((mastered / questions.length) * 100);
  }
  // 无 progress 数据时 → 用摸底测试结果
  if (state.meta.day1SubjectAcc) {
    return state.meta.day1SubjectAcc[subj] ?? null;
  }
  return null;
}


function renderWeakSubjects() {
  const el = document.getElementById('weak-subjects-container');
  if (!el) return;

  const threshold = state.settings.weakThreshold * 100;
  const thresholdPct = Math.round(threshold);

  // 全科按正确率升序排列（null/未学排最后），低于阈值的排前面
  const all = getSubjects(state.settings.section).map(subj => {
    const acc = getSubjectAccuracy(subj);
    return { subj, acc };
  }).sort((a, b) => {
    if (a.acc === null && b.acc === null) return 0;
    if (a.acc === null) return 1;
    if (b.acc === null) return -1;
    const aLow = a.acc < thresholdPct;
    const bLow = b.acc < thresholdPct;
    if (aLow && !bLow) return -1;
    if (!aLow && bLow) return 1;
    return a.acc - b.acc;
  });

  const pills = all.map(({ subj, acc }) => {
    const isWeak = acc !== null && acc < thresholdPct;
    return `<button class="weak-pill${isWeak ? ' weak-pill-danger' : ''}" data-action="start-subject" data-subject="${subj}">
      <span class="weak-pill-name">${subjectName(subj)}</span>
      <span class="weak-pill-rate">${acc === null ? '未学' : acc + '%'}</span>
    </button>`;
  }).join('');

  el.innerHTML = `
    <div class="weak-section-header">低于${thresholdPct}%正确率的科目</div>
    <div class="weak-pills-row">${pills}</div>`;
}

function getPracticeMode() {
  return state.entry || 'standard';
}

function getPracticeModeLabel(mode = getPracticeMode()) {
  return {
    standard: '综合刷题',
    new: '新题优先',
    weak: '错题重练',
    mastered: '熟练巩固',
  }[mode] || '综合刷题';
}

function renderPracticeModeBar() {
  document.querySelectorAll('.practice-mode-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === getPracticeMode());
  });
}

function getQuestionStatus(question) {
  return (state.progress[question.id] || {}).status || 'new';
}

function questionMatchesMode(question, mode = getPracticeMode()) {
  if (mode === 'standard') return true;
  if (mode === 'assessment') return true; // 摸底测试不限状态
  return getQuestionStatus(question) === mode;
}

function countQuestionsForSubject(subject, mode = getPracticeMode()) {
  const questions = state.questionBank[subject] || [];
  return questions.filter(question => questionMatchesMode(question, mode)).length;
}

// Update per-subject counts on the home screen grid
function renderSubjectBadges() {
  const mode = getPracticeMode();

  getSubjects(state.settings.section).forEach(subj => {
    const badge = document.getElementById('badge-' + subj);
    const meta = document.getElementById('meta-' + subj);
    const total = countQuestionsForSubject(subj, mode);

    if (meta) {
      meta.textContent = `${total}题可练`;
    }

    if (badge) {
      if (mode === 'standard') {
        const weakCount = countQuestionsForSubject(subj, 'weak');
        badge.textContent = weakCount > 0 ? `${weakCount}错题` : '';
        badge.style.display = weakCount > 0 ? 'inline-block' : 'none';
      } else {
        badge.textContent = total > 99 ? '99+' : total;
        badge.style.display = total > 0 ? 'inline-block' : 'none';
      }
    }
  });
}

function setCount(id, n) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = n + '题';
}

// PRACTICE
function renderPractice() {
  const container = document.getElementById('question-container');
  const entryInfo = document.getElementById('practice-entry-info');
  const title = document.getElementById('practice-view-title');
  const mode = getPracticeMode();

  if (!state.subject) {
    entryInfo.className = 'practice-entry-info';
    entryInfo.textContent = '从首页选择全科或单科学习后，会直接进入练习。';
    title.textContent = '开始练习';
    container.innerHTML = '<p class="placeholder">正在等待你的选择...</p>';
    return;
  }

  const availableCount = state.subject === 'all'
    ? getSubjects(state.settings.section).reduce((sum, subj) => sum + countQuestionsForSubject(subj, mode), 0)
    : countQuestionsForSubject(state.subject, mode);
  const subjectLabel = state.subject === 'all' ? '全科练习' : subjectName(state.subject);

  title.textContent = subjectLabel;
  entryInfo.className = `practice-entry-info ${mode === 'standard' ? '' : mode}`.trim();
  entryInfo.textContent = `${subjectLabel} · ${getPracticeModeLabel(mode)} · ${availableCount}题可练`;
  startSession(state.subject, state.entry);
}

function buildSessionQuestions(subject, mode = getPracticeMode()) {
  if (subject === 'all') {
    const buckets = getSubjects(state.settings.section).map(subj => shuffle((state.questionBank[subj] || []).filter(question => questionMatchesMode(question, mode))));
    const mixed = [];
    let cursor = 0;
    while (mixed.length < 24) {
      let addedThisRound = false;
      for (const bucket of buckets) {
        if (bucket[cursor]) {
          mixed.push(bucket[cursor]);
          addedThisRound = true;
        }
        if (mixed.length >= 24) break;
      }
      if (!addedThisRound) break;
      cursor++;
    }
    return shuffle(mixed);
  }

  return shuffle((state.questionBank[subject] || []).filter(question => questionMatchesMode(question, mode))).slice(0, 20);
}

// SESSION
async function startSession(subject, entry) {
  // Record baseline
  const today = todayKey();
  const todayBefore = (state.daily[today] || { questionsCount: 0, correct: 0 });
  state.sessionStartQCount = todayBefore.questionsCount;
  state.sessionStartCorrect = todayBefore.correct;
  state.sessionStartTime = Date.now();
  state.sessionScore = { correct: 0, wrong: 0 };
  state.sessionResults = [];
  state.sessionIndex = 0;
  state.selectedChoice = null;

  const filtered = buildSessionQuestions(subject, entry || 'standard');

  if (filtered.length === 0) {
    document.getElementById('question-container').innerHTML =
      `<p class="placeholder">${getPracticeModeLabel(entry || 'standard')}下暂时没有可练题目</p>`;
    return;
  }

  state.sessionQuestions = filtered;
  state.subject = subject;
  state.entry = entry || null;

  // Auto-checkin on first session of the day
  await ensureTodayCheckin();

  renderQuestion();
}

// Current audio instance (for local file playback)
let currentAudio = null;

function normalizeAnswerText(value) {
  return String(value)
    .replace(/^"(.*)"$/, '$1')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[，、；;]/g, ',')
    .trim();
}

function splitAnswerParts(value) {
  return normalizeAnswerText(value)
    .split(/[,\n/|]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function formatAnswerForDisplay(answer) {
  return Array.isArray(answer) ? answer.join('，') : answer;
}

function isAnswerMatch(userAnswer, correctAnswer, question = null) {
  const normalizedUser = normalizeAnswerText(userAnswer);

  if (question?.acceptAnswers?.length) {
    return question.acceptAnswers.some(answer => isAnswerMatch(userAnswer, answer));
  }

  if (Array.isArray(correctAnswer)) {
    const expected = correctAnswer.map(item => normalizeAnswerText(item));
    const joinCandidates = [
      expected.join(','),
      expected.join(' '),
      expected.join('/'),
    ];
    if (joinCandidates.includes(normalizedUser)) return true;

    const userParts = splitAnswerParts(userAnswer);
    if (userParts.length === expected.length && userParts.every((part, index) => part === expected[index])) {
      return true;
    }

    return expected.every(part => normalizedUser.includes(part));
  }

  if (question?.keywords?.length) {
    return question.keywords.every(keyword => normalizedUser.includes(normalizeAnswerText(keyword)));
  }

  const normalizedAnswer = normalizeAnswerText(correctAnswer);
  return normalizedUser === normalizedAnswer
    || normalizedUser === normalizedAnswer.replace(/\s+/g, '')
    || userAnswer === String(correctAnswer)
    || normalizedUser.startsWith(normalizedAnswer.replace(/\s+/g, ''));
}

function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // LaTeX inline math: $...$ → just content
    .replace(/\$+([^$\n]+)\$+/g, '$1')
    // LaTeX block: $$...$$ → remove
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    // Image/links: ![alt](url) → alt, [text](url) → text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Headings: ## 中文标题 → just text (strip leading ## and spaces)
    .replace(/^#{1,6}\s+[\u4e00-\u9fa5a-zA-Z0-9].*/gm, m => m.replace(/^#{1,6}\s+/, ''))
    // Bold with space inside: ** 65° ** → 65°
    .replace(/\*\*\s*([^*]+?)\s*\*\*/g, '$1')
    // Bold standard: **text** → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Italic with space: * text * → text
    .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_(?![*])([^_]+)_(?![*_])/g, '$1')
    // List markers: "- item" or "* item" → "· item"
    .replace(/^[-*+]\s+(?=[^\n])/gm, '· ')
    // Numbered list: "1. item" → "· item"
    .replace(/^\d+\.\s+(?=[^\n])/gm, '· ')
    // Horizontal rules and dashes
    .replace(/^---\s*$/gm, '')
    .replace(/---/g, '')
    // Collapse blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function appendExplanation(fb, questionLike, skipPassage = false) {
  if (questionLike?.audio_text) {
    fb.innerHTML += `<p class="explanation"><strong>听力原文：</strong>${questionLike.audio_text.replace(/\n/g, '<br>')}</p>`;
  }
  if (!skipPassage && questionLike?.passage) {
    fb.innerHTML += `<p class="explanation"><strong>短文原文：</strong>${questionLike.passage.replace(/\n/g, '<br>')}</p>`;
  }
  if (questionLike?.explanation) {
    const clean = stripMarkdown(questionLike.explanation).replace(/\n/g, '<br>');
    fb.innerHTML += `<p class="explanation">${clean}</p>`;
  }
}

// 反馈区结构：按钮始终在最上方，解释在中间，正确/错误提示在按钮下方
function buildFeedbackHTML(btnHTML, feedbackHTML, questionLike, skipPassage = false) {
  let html = btnHTML;
  if (questionLike?.audio_text) {
    html += `<p class="explanation"><strong>听力原文：</strong>${questionLike.audio_text.replace(/\n/g, '<br>')}</p>`;
  }
  if (!skipPassage && questionLike?.passage) {
    html += `<p class="explanation"><strong>短文原文：</strong>${questionLike.passage.replace(/\n/g, '<br>')}</p>`;
  }
  if (questionLike?.explanation) {
    const clean = stripMarkdown(questionLike.explanation).replace(/\n/g, '<br>');
    html += `<p class="explanation">${clean}</p>`;
  }
  html += feedbackHTML;
  return html;
}

function speakQuestion() {
  const q = state.sessionQuestions[state.sessionIndex];
  if (!q) return;

  // Stop any current playback
  speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  // Try local audio file first (from local server)
  // Local files use dash format: english-026.m4a
  // GitHub/remote files use underscore: english_026.m4a
  const dashId = q.id.replace(/_/g, '-');   // en_l_001 → en-l-001 or english-001 stays english-001
  const undId  = q.id.replace(/-/g, '_');   // english-001 → english_001
  const av = state.settings.audioVersion || Date.now();

  const LOCAL_BASE = new URL('audio/', window.location.href).href;
  const CDN_BASE = 'https://cdn.jsdelivr.net/gh/fuweineng/bairichuang-pwa@main/audio/';

  const paths = [];
  if (q.audioUrl) {
    paths.push(new URL(q.audioUrl, window.location.href).href);
  }
  if (Array.isArray(q.audioUrls)) {
    q.audioUrls.forEach(url => paths.push(new URL(url, window.location.href).href));
  }
  paths.push(
    new URL(`${q.subject}/${dashId}.m4a?_=${av}`, LOCAL_BASE).href,
    new URL(`${q.subject}/${undId}.m4a?_=${av}`, LOCAL_BASE).href,
    new URL(`${q.subject}/${undId}.m4a?_=${av}`, CDN_BASE).href,
  );

  let pathIndex = 0;
  const tryPlayNext = () => {
    if (pathIndex >= paths.length) {
      // All failed → TTS
      speakWithWebSpeech(q);
      const btn = document.getElementById('listen-btn');
      if (btn) { btn.textContent = '播放'; btn.disabled = false; }
      return;
    }
    const audioPath = paths[pathIndex++];
    const audio = new Audio(audioPath);
    currentAudio = audio;

    const grid = document.querySelector('.answer-grid');
    if (grid) grid.style.pointerEvents = 'none';
    const btn = document.getElementById('listen-btn');
    if (btn) { btn.textContent = '播放中...'; btn.disabled = true; }

    audio.onended = () => {
      currentAudio = null;
      if (grid) grid.style.pointerEvents = '';
      if (btn) { btn.textContent = '已听完'; btn.disabled = false; }
    };
    audio.onerror = () => {
      currentAudio = null;
      // Try next path instead of jumping to TTS
      tryPlayNext();
    };
    audio.play().catch(() => {
      currentAudio = null;
      // Try next path instead of jumping to TTS
      tryPlayNext();
    });
  };

  tryPlayNext();
}

function speakWithWebSpeech(q) {
  if (!('speechSynthesis' in window)) return;
  const lang = q.tts || 'en-US';

  let textToSpeak = q.question;
  if (q.type === 'dictation') {
    textToSpeak = q.text || q.question;
  } else if (q.type === 'listening') {
    textToSpeak = q.audio_text || q.question;
  } else if (q.type === 'passage_dictation') {
    textToSpeak = q.passage || q.question;
  }

  const utter = new SpeechSynthesisUtterance(textToSpeak);
  utter.lang = lang;
  utter.rate = 0.75;
  utter.pitch = 1;
  utter.volume = 1;

  const grid = document.querySelector('.answer-grid');
  if (grid) grid.style.pointerEvents = 'none';
  const btn = document.getElementById('listen-btn');
  if (btn) { btn.textContent = '播放中...'; btn.disabled = true; }

  utter.onend = () => {
    if (grid) grid.style.pointerEvents = '';
    if (btn) { btn.textContent = '已听完'; btn.disabled = false; }
  };
  utter.onerror = () => {
    if (grid) grid.style.pointerEvents = '';
    if (btn) { btn.textContent = '重试'; btn.disabled = false; }
  };

  state.ttsUtterance = utter;
  speechSynthesis.speak(utter);
}

// ── 小学音频：点击题目文字播放 ───────────────────────────────────────
window.playQAudio = function(el) {
  const url = el.dataset.audio;
  if (!url) return;
  stopCurrentAudio();
  const btn = document.getElementById('action-btn');
  const grid = document.getElementById('answer-grid');
  const label = document.querySelector('.q-text-audio');
  if (label) { label.textContent = '🔊 播放中...'; label.style.pointerEvents = 'none'; }
  if (grid) grid.style.pointerEvents = 'none';

  const audio = new Audio(url);
  currentAudio = audio;
  audio.onended = () => {
    currentAudio = null;
    if (label) { label.textContent = el.textContent; label.style.pointerEvents = ''; }
    if (grid) grid.style.pointerEvents = '';
  };
  audio.onerror = () => {
    currentAudio = null;
    if (label) { label.textContent = el.textContent; label.style.pointerEvents = ''; }
    if (grid) grid.style.pointerEvents = '';
  };
  audio.play().catch(() => {
    currentAudio = null;
    if (label) { label.textContent = el.textContent; label.style.pointerEvents = ''; }
    if (grid) grid.style.pointerEvents = '';
  });
};

// ── 小学音频：点击选项文字播放 ───────────────────────────────────────
window.playOpAudio = function(audioPath) {
  if (!audioPath) return;
  stopCurrentAudio();
  const grid = document.getElementById('answer-grid');
  const btns = document.querySelectorAll('.answer-btn[data-opaudio]');
  if (grid) grid.style.pointerEvents = 'none';

  const url = audioPath.startsWith('http') ? audioPath
    : `https://cdn.jsdelivr.net/gh/fuweineng/bairichuang-pwa@main/${audioPath}`;
  const audio = new Audio(url);
  currentAudio = audio;

  audio.onended = () => {
    currentAudio = null;
    if (grid) grid.style.pointerEvents = '';
    btns.forEach(b => { b.textContent = b.textContent.replace(' 播放中', ''); });
  };
  audio.onerror = () => {
    currentAudio = null;
    if (grid) grid.style.pointerEvents = '';
    btns.forEach(b => { b.textContent = b.textContent.replace(' 播放中', ''); });
  };
  audio.play().catch(() => {
    currentAudio = null;
    if (grid) grid.style.pointerEvents = '';
  });
  // 标记正在播放
  btns.forEach(b => {
    if (b.dataset.opaudio === audioPath) {
      b.textContent += ' 播放中';
    } else {
      b.textContent = b.textContent.replace(' 播放中', '');
    }
  });
};

function stopCurrentAudio() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  speechSynthesis.cancel();
}

// ── 提交答案 ─────────────────────────────────────────────────────────
function handleSubmit() {
  const sel = state.selectedChoice;
  if (!sel || sel.submitted) return;
  sel.submitted = true;
  state.selectedChoice = sel;
  handleAnswer(sel.idx);  // 显示对错 feedback，不 re-render
  // 改按钮文字为"下一题 →"，不重新渲染整题（避免清除 feedback）
  const btn = document.getElementById('action-btn');
  if (btn) {
    btn.textContent = '下一题 →';
    btn.dataset.action = 'next-question';
  }
}

function speakVariant(lang) {
  if (!('speechSynthesis' in window)) return;
  const q = state.sessionQuestions[state.sessionIndex];
  const variants = q.ttsVariants || {};
  const langMap = {
    mandarin:  { text: variants.mandarin,  lang: 'zh-CN' },
    cantonese: { text: variants.cantonese, lang: 'zh-HK' },
    english:   { text: variants.english,   lang: 'en-US' },
  };
  const cfg = langMap[lang];
  if (!cfg || !cfg.text) {
    showToast('暂无此语言版本'); return;
  }
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(cfg.text);
  utter.lang = cfg.lang;
  utter.rate = 0.8;
  utter.pitch = 1;
  utter.volume = 1;
  // Highlight active button
  document.querySelectorAll('.tts-lang-btn').forEach(b => b.classList.remove('tts-active'));
  const btn = document.querySelector(`[data-lang="${lang}"]`);
  if (btn) { btn.classList.add('tts-active'); btn.textContent = btn.textContent + ' ...'; }
  utter.onend = () => {
    if (btn) { btn.classList.remove('tts-active'); btn.textContent = btn.textContent.replace(' ...', ''); }
  };
  utter.onerror = () => {
    if (btn) { btn.classList.remove('tts-active'); btn.textContent = btn.textContent.replace(' ...', ''); }
    showToast('播放失败，请重试');
  };
  speechSynthesis.speak(utter);
}

function renderQuestion() {
  const container = document.getElementById('question-container');
  if (state.sessionIndex >= state.sessionQuestions.length) {
    renderSessionEnd();
    return;
  }

  const q = state.sessionQuestions[state.sessionIndex];
  const total = state.sessionQuestions.length;
  const idx = state.sessionIndex;

  const typeLabel = {
    choice: '选择题', fill: '填空题', reading: '阅读理解',
    dictation: '听写填空', listening: '听力选择', passage_dictation: '短文听写',
    expression: '表达题', short_answer: '简答题'
  }[q.type] || '选择题';
  const diffLabel = {1:'简单',2:'中等',3:'困难',medium:'中等'}[q.difficulty] || '';
  const imageSources = Array.isArray(q.images)
    ? q.images
    : [q.imageUrl || q.image].filter(Boolean);
  const imageBlock = imageSources.length > 0
    ? `<div class="question-image-grid">${imageSources.map(src => `<img class="question-image" src="${src}" alt="题目配图" loading="lazy" />`).join('')}</div>`
    : '';

  // ── 多语种朗读工具栏（所有题型通用）─────────────────────────────────
  const ttsVariantsBlock = q.ttsVariants
    ? `<div class="tts-lang-bar">
         <button class="tts-lang-btn" data-action="speak-lang" data-lang="mandarin">国语</button>
         <button class="tts-lang-btn" data-action="speak-lang" data-lang="cantonese">广东话</button>
         <button class="tts-lang-btn" data-action="speak-lang" data-lang="english">English</button>
       </div>`
    : '';

  const mathSymbols = ['²', '³', '√', '°', '±', 'π', '∠', '×', '÷', 'Δ', 'α', 'β'];
  const mathSymbolBtns = mathSymbols.map(s =>
    `<button type="button" class="math-sym-btn" onclick="var inp=document.getElementById('fill-answer-input');inp.value+=('${s}');inp.focus()">${s}</button>`
  ).join('');

  // ── LISTENING TYPE: dictation ──────────────────────────────────────
  if (q.type === 'dictation') {
    const listenBtn = `<button class="listen-btn" id="listen-btn" data-action="listen">听句子</button>`;
    container.innerHTML = `
      <div class="question-meta">
        <span>${typeLabel}</span><span>${diffLabel}</span>
        <span class="question-progress">${idx + 1}/${total}</span>
      </div>
      ${q.hint ? `<div class="question-hint">${q.hint}</div>` : ''}
      ${listenBtn}
      ${imageBlock}
      ${ttsVariantsBlock}
      <div class="question-text">请填写你听到的关键词：</div>
      <div class="fill-area">
        <div class="math-symbol-toolbar">${mathSymbolBtns}</div>
        <div class="fill-input-row">
          <input type="text" class="fill-input" id="fill-answer-input"
            placeholder="输入答案后按回车或点击提交" autocomplete="off"
            onkeydown="if(event.key==='Enter')document.getElementById('fill-answer-input') && document.getElementById('fill-answer-input').closest('.fill-area').querySelector('[data-action]').click()" />
          <button class="fill-submit-btn primary-btn" data-action="dictation-submit">提交</button>
        </div>
      </div>
      <div id="answer-feedback" style="display:none;margin-top:12px"></div>
    `;
    const inp = document.getElementById('fill-answer-input');
    if (inp) inp.focus();
    return;
  }

  // ── LISTENING TYPE: passage_dictation ─────────────────────────────
  if (q.type === 'passage_dictation') {
    // Track current sub-question index in session state
    if (state.pdIndex === undefined) state.pdIndex = 0;
    const subIdx = state.pdIndex;
    const subQs = q.questions || [];
    if (subIdx >= subQs.length) {
      // All sub-questions answered — show passage summary and move on
      state.pdIndex = 0;
      nextQuestion();
      return;
    }
    const sq = subQs[subIdx];
    const listenBtn = `<button class="listen-btn" id="listen-btn" data-action="listen">听短文</button>`;
    container.innerHTML = `
      <div class="question-meta">
        <span>${typeLabel}</span><span>${diffLabel}</span>
        <span class="question-progress">${idx + 1}/${total}</span>
        <span class="sub-progress">小题 ${subIdx + 1}/${subQs.length}</span>
      </div>
      ${listenBtn}
      ${q.hint ? `<div class="question-hint">${q.hint}</div>` : ''}
      ${imageBlock}
      ${ttsVariantsBlock}
      <div class="question-text">${sq.q}</div>
      <div class="fill-area">
        <div class="fill-input-row">
          <input type="text" class="fill-input" id="fill-answer-input"
            placeholder="输入答案后按回车或点击提交" autocomplete="off" />
          <button class="fill-submit-btn primary-btn" data-action="pd-submit">提交</button>
        </div>
      </div>
      <div id="answer-feedback" style="display:none;margin-top:12px"></div>
    `;
    const inp = document.getElementById('fill-answer-input');
    if (inp) inp.focus();
    return;
  }

  // ── LISTENING TYPE: listening (choice with audio_text) ────────────
  const shouldShowListenBtn = q.type === 'listening';
  const listenBtn = shouldShowListenBtn
    ? `<button class="listen-btn" id="listen-btn" data-action="listen">播放音频</button>`
    : '';

  // ── 判断题型 ──────────────────────────────────────────────────────────
  // choice 类型: q.options 或 q.choices 数组；listening 类型: q.choices 数组
  const hasOptions = q.options && q.options.length > 0;         // choice 用 options
  const hasChoices = q.choices && q.choices.length > 0;         // listening / choice 用 choices
  const isChoice = (hasOptions || hasChoices) && q.type === 'choice';
  const isListeningType = hasChoices && q.type === 'listening';
  const isFillOrShort = !hasOptions && !hasChoices && (q.type === 'fill' || q.type === 'short_answer' || q.type === 'expression');

  // ── 小学语/英/数：题目文字可点播放音频 ────────────────────────────────
  const primaryWithAudio = ['chinese', 'english', 'math'].includes(q.subject) && q.audio;
  const qAudioUrl = primaryWithAudio
    ? `https://cdn.jsdelivr.net/gh/fuweineng/bairichuang-pwa@main/${q.audio}`
    : '';

  // 选项按钮 (choice 用 options/choices 文字；listening 用 choices[{label,text}])
  // 小学primary科目：选项也可点着播放音频
  // optionAudio 格式：[{key:'A',audio:'...'}] 或 {'a':'...','b':'...'}
  let optionAudioMap = {};
  if (['chinese', 'english', 'math'].includes(q.subject) && q.optionAudio) {
    if (Array.isArray(q.optionAudio)) {
      q.optionAudio.forEach(item => {
        if (item.key) optionAudioMap[item.key.toLowerCase()] = item.audio;
      });
    } else {
      optionAudioMap = q.optionAudio; // 已是 dict
    }
  }
  const primaryWithOptionAudio = Object.keys(optionAudioMap).length > 0;
  const sel = state.selectedChoice;
  const isSubmitted = sel?.submitted === true;

  const opts = isChoice
    ? (q.options || q.choices).map((opt, i) => {
        const label = typeof opt === 'string' ? '' : opt.label + '. ';
        const text  = typeof opt === 'string' ? opt    : opt.text;
        const selected = sel?.idx === i ? ' selected' : '';
        const opAudio = primaryWithOptionAudio ? optionAudioMap['abcd'[i]] : '';
        return `<button class="answer-btn${selected}" data-action="answer" data-choice="${i}"${opAudio ? ` data-opaudio="${opAudio}"` : ''}>${label}${text}</button>`;
      }).join('')
    : isListeningType
    ? q.choices.map((c, i) =>
        `<button class="answer-btn" data-action="answer" data-choice="${i}">${c.label}. ${c.text}</button>`
      ).join('')
    : '';

  const inputArea = isFillOrShort
    ? `<div class="fill-area">
         <div class="math-symbol-toolbar">${mathSymbolBtns}</div>
         <div class="fill-input-row">
           <input type="text" class="fill-input" id="fill-answer-input" placeholder="${q.type === 'short_answer' ? '写出答案...' : '填写答案...'}" autocomplete="off" onkeydown="if(event.key==='Enter')document.getElementById('fill-answer-input') && document.getElementById('fill-answer-input').closest('.fill-area').querySelector('[data-action]').click()" />
           <button class="fill-submit-btn primary-btn" data-action="fill-submit">提交</button>
         </div>
       </div>`
    : '';

  // 底部操作按钮：始终显示"下一题"样式按钮，点击时判断是提交还是下一题
  const submitBtn = isChoice && !isFillOrShort
    ? `<button class="primary-btn" id="action-btn" data-action="${isSubmitted ? 'next-question' : 'submit'}">${isSubmitted ? '下一题 →' : '提交'}</button>`
    : '';

  const qTextWithAudio = primaryWithAudio
    ? `<span class="q-text-audio" data-audio="${qAudioUrl}" onclick="playQAudio(this)">${q.question}</span>`
    : `<span>${q.question}</span>`;

  container.innerHTML = `
    <div class="question-meta">
      <span>${typeLabel}</span><span>${diffLabel}</span>
      <span class="question-progress">${idx + 1}/${total}</span>
    </div>
    ${listenBtn}
    ${q.hint ? `<div class="question-hint">${q.hint}</div>` : ''}
    ${imageBlock}
    ${ttsVariantsBlock}
    ${q.passage ? `<div class="passage-block"><strong>短文：</strong>${q.passage.replace(/\\n/g, '<br>')}</div>` : ''}
    <div class="question-text">${qTextWithAudio}</div>
    ${opts ? `<div class="answer-grid" id="answer-grid">${opts}</div>` : ''}
    ${inputArea}
    ${submitBtn}
    <div id="answer-feedback" style="display:none;margin-top:12px"></div>
  `;

  // 键盘：1-4 选答案，回车提交/下一题
  const onKey = (e) => {
    if (!state.sessionQuestions.length) return;
    const q = state.sessionQuestions[state.sessionIndex];
    if (!q || q.type !== 'choice') return;
    const maxChoice = (q.options || q.choices || []).length;
    const curSel = state.selectedChoice;
    const nowSubmitted = curSel?.submitted === true;

    if (e.key >= '1' && e.key <= '4' && parseInt(e.key) <= maxChoice) {
      const idx2 = parseInt(e.key) - 1;
      state.selectedChoice = { idx: idx2, submitted: nowSubmitted };
      renderQuestion();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nowSubmitted) {
        nextQuestion();
      } else if (curSel !== null) {
        handleSubmit();
      }
    }
  };
  document.removeEventListener('keydown', onKey);
  document.addEventListener('keydown', onKey);

  if (isFillOrShort) {
    const inp = document.getElementById('fill-answer-input');
    if (inp) inp.focus();
  }

  if (state.ttsUtterance) {
    state.ttsUtterance = null;
  }
}

async function handleAnswer(choiceIdx) {
  const q = state.sessionQuestions[state.sessionIndex];

  // 判断答案：choice 用 q.options[idx] === q.answer；listening 用 q.choices[idx].label === q.answer
  let isCorrect = false;
  if (q.type === 'choice' && (q.options || q.choices)) {
    // options/choices 可能是纯字符串数组，也可能是 {label,text} 对象数组
    const source = q.options || q.choices;
    const opt = source[choiceIdx];
    const optText = typeof opt === 'string' ? opt : opt.text;
    const answerStr = String(q.answer);
    isCorrect = optText === answerStr ||
      optText.startsWith(answerStr + '. ') ||
      (Array.isArray(q.answer) && q.answer.includes(answerStr)) ||
      (typeof opt === 'object' && opt.label === answerStr);
  } else if (q.type === 'listening' && q.choices) {
    isCorrect = q.choices[choiceIdx].label === String(q.answer);
  }

  if (isCorrect) state.sessionScore.correct++;
  else state.sessionScore.wrong++;

  await recordAnswer(q.id, isCorrect, q.subject, q.type);

  const fb = document.getElementById('answer-feedback');
  if (fb) {
    fb.style.display = 'block';
    // 显示正确答案标签
    let correctLabel = q.answer;
    if ((q.type === 'listening' || q.type === 'choice') && q.choices) {
      const found = q.choices.find(c => c.label === q.answer);
      if (found) correctLabel = `${q.answer}. ${found.text}`;
    }
    const feedbackHTML = isCorrect
      ? `<span class="fb-correct">正确</span>`
      : `<span class="fb-wrong">错误，正确答案是：${correctLabel}</span>`;
    fb.innerHTML = buildFeedbackHTML(
      `<button class="primary-btn" data-action="next-question" style="margin-top:8px">下一题 →</button>`,
      feedbackHTML, q
    );
  }
}

// ── Dictation (听写填空) ──────────────────────────────────────────────────
async function handleDictationSubmit() {
  const inp = document.getElementById('fill-answer-input');
  if (!inp) return;
  const userAnswer = inp.value.trim();
  if (!userAnswer) return;

  const q = state.sessionQuestions[state.sessionIndex];
  const correctAns = q.answer;
  const isCorrect = isAnswerMatch(userAnswer, correctAns, q);

  if (isCorrect) state.sessionScore.correct++;
  else state.sessionScore.wrong++;

  await recordAnswer(q.id, isCorrect, q.subject, q.type);

  const fb = document.getElementById('answer-feedback');
  if (fb) {
    fb.style.display = 'block';
    const feedbackHTML = isCorrect
      ? `<span class="fb-correct">正确</span>`
      : `<span class="fb-wrong">错误，正确答案是：${formatAnswerForDisplay(q.answer)}</span>`;
    fb.innerHTML = buildFeedbackHTML(
      `<button class="primary-btn" data-action="dictation-next" style="margin-top:8px">下一题 →</button>`,
      feedbackHTML, q
    );
  }
}

// ── Passage dictation (短文听写) sub-question ─────────────────────────────
async function handlePDSubmit() {
  const inp = document.getElementById('fill-answer-input');
  if (!inp) return;
  const userAnswer = inp.value.trim();
  if (!userAnswer) return;

  const q = state.sessionQuestions[state.sessionIndex];
  const subIdx = state.pdIndex !== undefined ? state.pdIndex : 0;
  const sq = (q.questions || [])[subIdx];
  if (!sq) return;

  const correctAns = sq.answer;
  const isCorrect = isAnswerMatch(userAnswer, correctAns, sq);

  if (isCorrect) state.sessionScore.correct++;
  else state.sessionScore.wrong++;

  await recordAnswer(q.id + '_sub_' + subIdx, isCorrect, q.subject, q.type);

  const fb = document.getElementById('answer-feedback');
  if (fb) {
    fb.style.display = 'block';
    const btnLabel = subIdx + 1 >= (q.questions || []).length ? '短文结束 →' : '下一题 →';
    const feedbackHTML = isCorrect
      ? `<span class="fb-correct">正确</span>`
      : `<span class="fb-wrong">错误，正确答案是：${formatAnswerForDisplay(sq.answer)}</span>`;
    fb.innerHTML = buildFeedbackHTML(
      `<button class="primary-btn" data-action="pd-next" style="margin-top:8px">${btnLabel}</button>`,
      feedbackHTML, { ...sq, passage: q.passage }
    );
  }
}

async function handleFillAnswer(userAnswer) {
  const q = state.sessionQuestions[state.sessionIndex];
  if (!q || !userAnswer) return;

  const correctAns = q.answer;
  const isCorrect = isAnswerMatch(userAnswer, correctAns, q);

  if (isCorrect) state.sessionScore.correct++;
  else state.sessionScore.wrong++;

  await recordAnswer(q.id, isCorrect, q.subject, q.type);

  const fb = document.getElementById('answer-feedback');
  if (fb) {
    fb.style.display = 'block';
    const skipPassage = q.type === 'fill' || q.type === 'short_answer';
    const feedbackHTML = isCorrect
      ? `<span class="fb-correct">正确</span>`
      : `<span class="fb-wrong">错误，正确答案是：${formatAnswerForDisplay(correctAns)}</span>`;
    fb.innerHTML = buildFeedbackHTML(
      `<button class="primary-btn" data-action="next-question" style="margin-top:10px">下一题 →</button>`,
      feedbackHTML, q, skipPassage
    );
  }
}

async function nextQuestion() {
  state.sessionIndex++;
  state.pdIndex = 0;
  state.selectedChoice = null;
  renderQuestion();
}

async function recordAnswer(questionId, isCorrect, subject, qtype) {
  const p = state.progress[questionId] || { status: 'new', correct: 0, wrong: 0, lastPracticed: null };

  if (isCorrect) {
    p.correct++;
    if (p.correct >= 3) p.status = 'mastered';
  } else {
    p.wrong++;
    const total = p.correct + p.wrong;
    const acc = total > 0 ? p.correct / total : 0;
    if (p.wrong >= 2 || acc < state.settings.weakThreshold) {
      p.status = 'weak';
    }
  }
  p.lastPracticed = todayKey();
  p.subject = subject;
  p.type = qtype;
  state.progress[questionId] = p;
  state.sessionResults.push({ questionId, isCorrect, subject, type: qtype || 'choice' });
  await set(K.PROGRESS, state.progress);
}

async function renderSessionEnd() {
  const container = document.getElementById('question-container');
  const { correct, wrong } = state.sessionScore;
  const total = correct + wrong;
  const today = todayKey();

  // Merge into daily bySubject
  const existing = state.daily[today] || { practiced: 0, questionsCount: 0, correct: 0, accuracy: 0, score: 0, bySubject: {} };
  const isNewCheckin = existing.questionsCount === 0; // today's first session
  const byS = existing.bySubject || {};
  state.sessionResults.forEach(result => {
    const subject = result.subject || 'unknown';
    const type = result.type || 'choice';
    if (!byS[subject]) {
      byS[subject] = { correct: 0, wrong: 0, byType: {} };
    }
    if (!byS[subject].byType[type]) {
      byS[subject].byType[type] = { correct: 0, wrong: 0 };
    }
    if (result.isCorrect) {
      byS[subject].correct += 1;
      byS[subject].byType[type].correct += 1;
    } else {
      byS[subject].wrong += 1;
      byS[subject].byType[type].wrong += 1;
    }
  });

  // Total across all subjects
  const totalAll = Object.values(byS).reduce((sc, sd) => sc + (sd.correct || 0) + (sd.wrong || 0), 0);
  const correctAll = Object.values(byS).reduce((sc, sd) => sc + (sd.correct || 0), 0);
  const acc = totalAll > 0 ? correctAll / totalAll : 0;
  const sessionAcc = total > 0 ? Math.round(correct / total * 100) : 0;
  const newScore = Math.round((totalAll + 1) * acc);

  state.daily[today] = {
    practiced: existing.practiced + 1,
    questionsCount: totalAll,
    correct: correctAll,
    accuracy: acc,
    score: newScore,
    bySubject: byS,
  };
  await set(K.DAILY, state.daily);

  // 今日首次打卡 → 烟花特效
  if (isNewCheckin) fireworks();

  // Record session + init meta (day1 baseline)
  const sessionEntry = {
    date: today,
    practiced: 1,
    questionsCount: totalAll,
    correct: correctAll,
    accuracy: acc,
    score: newScore,
    bySubject: byS,
  };
  state.sessions.push(sessionEntry);
  await set(K.SESSIONS, state.sessions);

  // First session ever → set day1 baseline + mark assessment done
  if (!state.meta.startDate) {
    state.meta.startDate = today;
    state.meta.assessmentCompleted = true;
    const day1Acc = {};
    getSubjects(state.settings.section).forEach(s => {
      const sd = byS[s];
      if (sd) {
        const total = (sd.correct || 0) + (sd.wrong || 0);
        day1Acc[s] = total > 0 ? Math.round((sd.correct || 0) / total * 100) : 0;
      } else {
        day1Acc[s] = null;
      }
    });
    state.meta.day1SubjectAcc = day1Acc;
    const valid = Object.values(day1Acc).filter(v => v !== null);
    state.meta.day1AvgAcc = valid.length > 0
      ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length)
      : null;
    await set(K.META, state.meta);
  }

  const streak = calcStreak();
  const totalDays = Object.keys(state.daily).length;

  // Check 100-day completion
  await checkCompletion100();

  container.innerHTML = `
    <div class="session-end">
      <p class="placeholder">本轮完成！</p>
      <div class="session-score">
        <span class="big-num">${correct}/${total} (${sessionAcc}%)</span>
      </div>
      <div class="session-daily">
        <p>今日累计: ${state.daily[today].questionsCount}题 | 得分: ${state.daily[today].score}</p>
        <p>已坚持 <strong>${streak}</strong> 天（累计 <strong>${totalDays}</strong> 天）</p>
      </div>
      <button class="primary-btn" data-action="back-home" style="margin-top:16px">返回首页</button>
    </div>
  `;
}

// 烟花特效 — 今日首次打卡触发
function fireworks() {
  const colors = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6B6B','#C77DFF'];
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden';
  document.body.appendChild(container);
  for (let i = 0; i < 60; i++) {
    const particle = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const angle = Math.random() * Math.PI * 2;
    const velocity = 3 + Math.random() * 5;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    const size = 4 + Math.random() * 6;
    particle.style.cssText = `position:absolute;border-radius:50%;width:${size}px;height:${size}px;background:${color};left:50%;top:50%;opacity:1`;
    container.appendChild(particle);
    let x = 0, y = 0, opacity = 1, gravity = 0.1;
    const anim = setInterval(() => {
      x += vx;
      y += vy + gravity;
      opacity -= 0.02;
      gravity += 0.05;
      particle.style.transform = `translate(${x}px, ${y}px)`;
      particle.style.opacity = opacity;
      if (opacity <= 0) { clearInterval(anim); container.remove(); }
    }, 30);
  }
}

// PROGRESS VIEW
function renderProgress() {
  const container = document.getElementById('history-container');
  const streak = calcStreak();
  const totalScore = Object.values(state.daily).reduce((s, d) => s + (d.score || 0), 0);
  const totalDays = Object.keys(state.daily).length;
  const weekDays = getWeekDays();
  const weekScore = weekDays.reduce((s, d) => s + ((state.daily[d] || {}).score || 0), 0);

  const chartSVG = drawChart();

  const rows = Object.keys(state.daily).sort().reverse().slice(0, 14).map(date => {
    const d = state.daily[date];
    const label = dateLabel(date);
    return `<div class="history-row">
      <span class="history-date">${label}</span>
      <span class="history-score">${d.score}分</span>
      <span class="history-detail">${d.questionsCount}题/${Math.round(d.accuracy*100)}%</span>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="progress-stats">
      <div class="progress-stat"><span class="ps-num">${streak}</span><span class="ps-label">连续天数</span></div>
      <div class="progress-stat"><span class="ps-num">${totalDays}</span><span class="ps-label">累计天数</span></div>
      <div class="progress-stat"><span class="ps-num">${totalScore}</span><span class="ps-label">累计得分</span></div>
      <div class="progress-stat"><span class="ps-num">${weekScore}</span><span class="ps-label">本周得分</span></div>
    </div>
    <div class="chart-container" id="chart-svg">${chartSVG}</div>
    <div class="history-list">${rows || '<p class="placeholder">还没有打卡记录</p>'}</div>
  `;
}

// 柱状图 — 各科掌握情况，每科目独立 易错题库/熟练掌握 按钮
function drawChart() {
  const sectionSubjects = getSubjects(state.settings.section);
  const subjects = sectionSubjects;
  const subjectColors = {
    chinese: '#E91E63', math: '#2196F3', english: '#FF9800',
    physics: '#9C27B0', chemistry: '#E91E63', biology: '#009688',
    history: '#795548', geography: '#607D8B', politics: '#F44336'
  };

  const totalDays = Object.keys(state.daily).length;
  const todayKey = getLocalDateKey(new Date());
  const today = state.daily[todayKey];
  const practicedToday = !!today;
  const todayCount = today ? today.questionsCount : 0;

  // 未完成摸底测试 → 显示引导
  if (!state.meta.assessmentCompleted) {
    return `
    <div class="home-header-strip">
      <div class="home-header-top">
        <span class="home-header-date-badge">${formatDateKeyLabel(todayKey)}</span>
        <span class="home-header-days"><span class="home-header-days-dot"></span>累计 ${totalDays} 天</span>
      </div>
      <div class="home-header-body">
        <div class="home-header-left">
          <div class="home-header-greeting">${getTimeGreeting()}</div>
        </div>
        <div class="home-header-right">
          <div class="home-header-today-label">今日练习</div>
          <div class="home-header-today-stat">${todayCount}<span class="home-header-today-unit"> 题</span></div>
        </div>
      </div>
      <div class="home-header-divider"></div>
    </div>
    <div class="chart-empty">
      <div class="chart-empty-icon">测评</div>
      <div class="chart-empty-title">还没有练习数据</div>
      <div class="chart-empty-sub">先做一次摸底测试，了解各科水平</div>
      <button class="chart-assessment-btn" data-action="start-assessment" data-subject="all" data-entry="assessment">开始摸底测试</button>
    </div>`;
  }

  // 已完成摸底测试 → 各科柱状图
  const barData = subjects.map(subj => {
    const acc = getSubjectAccuracy(subj);
    return { subj, acc };
  }).sort((a, b) => {
    if (a.acc === null && b.acc === null) return 0;
    if (a.acc === null) return 1;
    if (b.acc === null) return -1;
    return b.acc - a.acc;
  });

  const rows = barData.map(({ subj, acc }) => {
    const color = subjectColors[subj] || '#999';
    const pct = acc === null ? 0 : acc;
    const barWidth = (pct / 100) * 100;
    const label = acc === null ? '未学' : `${acc}%`;

    // 该科目的易错题 / 熟练题数量
    const questions = state.questionBank[subj] || [];
    const weakCount = questions.filter(q => {
      const p = state.progress[q.id];
      if (!p || p.status === 'new') return false;
      const total = p.correct + p.wrong;
      if (total === 0) return false;
      return (p.correct / total) < 0.9;
    }).length;
    const masteredCount = questions.filter(q => {
      const p = state.progress[q.id];
      if (!p || p.status === 'new') return false;
      const total = p.correct + p.wrong;
      if (total === 0) return false;
      return (p.correct / total) >= 0.9;
    }).length;

    return `
    <div class="chart-bar-row">
      <span class="chart-bar-label" style="color:${color}" data-action="start-subject" data-subject="${subj}">${subjectName(subj)}</span>
      <div class="chart-bar-track" data-action="start-subject" data-subject="${subj}">
        <div class="chart-bar-fill" style="width:${barWidth}%;background:${color}"></div>
      </div>
      <span class="chart-bar-pct" data-action="start-subject" data-subject="${subj}">${label}</span>
      <div class="chart-row-actions">
        ${weakCount > 0 ? `<button class="chart-row-btn btn-weak" data-action="start-subject" data-subject="${subj}" data-entry="weak">易错${weakCount}</button>` : ''}
        ${masteredCount > 0 ? `<button class="chart-row-btn btn-mastered" data-action="start-subject" data-subject="${subj}" data-entry="mastered">熟练${masteredCount}</button>` : ''}
      </div>
    </div>`;
  }).join('');

  return `
  <div class="home-header-strip">
    <div class="home-header-top">
      <span class="home-header-date-badge">${formatDateKeyLabel(getLocalDateKey(new Date()))}</span>
      <span class="home-header-days"><span class="home-header-days-dot"></span>累计 ${totalDays} 天</span>
    </div>
    <div class="home-header-body">
      <div class="home-header-left">
        <div class="home-header-greeting">${getTimeGreeting()}</div>
        ${practicedToday ? '<div class="home-header-sub">坚持就是胜利</div>' : ''}
      </div>
      <div class="home-header-right">
        <div class="home-header-today-label">${practicedToday ? '今日已完成' : '今日练习'}</div>
        <div class="home-header-today-stat">${today ? today.questionsCount : 0}<span class="home-header-today-unit"> 题</span></div>
      </div>
    </div>
    <div class="home-header-divider"></div>
  </div>
  <div class="chart-bar-list">${rows}</div>`;
}

// SETTINGS VIEW
async function renderSettings() {
  const container = document.getElementById('settings-content');
  container.innerHTML = `
    <div class="settings-card">
      ${state.account ? `
      <div class="settings-row clickable-row" data-action="edit-account" style="align-items:center;gap:10px;padding:8px 0">
        <img src="${(state.account.avatar || '')}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0">
        <div style="flex:1;min-width:0">
          <div class="settings-label" style="margin:0">${state.account.name}</div>
          <div class="settings-hint" style="margin:0;font-size:0.75rem">${state.meta.startDate ? '第 ' + getCurrentDay() + ' / 100 天' : '未开始'}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="secondary-btn" data-action="export-account-qr" style="padding:4px 8px;font-size:0.75rem">导出</button>
          <button class="secondary-btn" data-action="import-account-qr" style="padding:4px 8px;font-size:0.75rem">接入</button>
        </div>
      </div>
      ` : '<div class="settings-hint" style="padding:8px 0">未设置账号</div>'}
      <div class="settings-row" style="padding:8px 0">
        <div class="settings-label" style="margin:0">易错阈值</div>
        <div class="settings-stepper">
          <button class="stepper-btn" data-action="thresh-minus">−</button>
          <span class="stepper-val" id="thresh-val">${Math.round(state.settings.weakThreshold * 100)}%</span>
          <button class="stepper-btn" data-action="thresh-plus">+</button>
        </div>
      </div>
      <div class="settings-row" style="padding:8px 0">
        <div class="settings-label" style="margin:0">主题配色</div>
        <div class="theme-picker">
          <button class="theme-picker-btn${state.settings.theme === 'auto' ? ' active' : ''}" data-action="set-theme" data-value="auto">自动</button>
          <button class="theme-picker-btn${state.settings.theme === 'morning' ? ' active' : ''}" data-action="set-theme" data-value="morning">早晨</button>
          <button class="theme-picker-btn${state.settings.theme === 'afternoon' ? ' active' : ''}" data-action="set-theme" data-value="afternoon">下午</button>
          <button class="theme-picker-btn${state.settings.theme === 'evening' ? ' active' : ''}" data-action="set-theme" data-value="evening">傍晚</button>
          <button class="theme-picker-btn${state.settings.theme === 'night' ? ' active' : ''}" data-action="set-theme" data-value="night">深夜</button>
        </div>
      </div>
    </div>

    <div class="settings-card">
      <div class="settings-section-title">学段</div>
      <div style="display:flex;gap:6px;margin-bottom:10px">
        ${['primary','junior','senior'].map(s => `
          <button class="secondary-btn section-data-btn${state.settings.section === s ? ' active' : ''}"
            data-action="choose-section" data-section="${s}"
            style="flex:1;padding:7px 4px;font-size:0.75rem;${state.settings.section === s ? 'background:#4CAF50;color:white;border-color:#4CAF50' : ''}">
            ${s === 'junior' ? '初中' : s === 'primary' ? '小学' : '高中'}
          </button>`).join('')}
      </div>
      <div id="qb-stats" class="settings-hint" style="font-size:0.8rem;padding:4px 0 8px">加载中...</div>
      <div style="display:flex;gap:6px">
        <button class="secondary-btn" data-action="upgrade-questions" id="upgrade-btn" style="flex:1;padding:8px;font-size:0.8rem">同步题库</button>
        <button class="secondary-btn" data-action="clear-qb-cache" style="flex:1;padding:8px;font-size:0.8rem">清缓存</button>
        <button class="danger-btn" data-action="clear-all-data" style="flex:1;padding:8px;font-size:0.8rem">清除</button>
      </div>
    </div>

    <div class="settings-card" style="padding:10px 14px">
      <button class="donate-btn" data-action="show-support-modal" style="width:100%;padding:10px;background:linear-gradient(135deg,#6bcb77,#4a9f5a);color:white;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer">
        支持百日闯
      </button>
    </div>

    <div id="supporters-content" style="padding:4px 0 8px;text-align:center">
      <div class="settings-hint">加载中...</div>
    </div>

    <div style="text-align:center;padding:10px 0 4px;display:flex;flex-direction:column;align-items:center;gap:6px">
      <button class="secondary-btn" data-action="check-app-update" id="check-app-update-btn" style="padding:4px 14px;font-size:0.75rem">检查更新</button>
      <div class="settings-version">百日闯 v${state.settings.appVersion || '9.1.2'}</div>
    </div>
  `;

  // Show QB stats
  const stats = Object.entries(state.questionBank).map(([subj, qs]) => {
    const mastered = qs.filter(q => (state.progress[q.id] || {}).status === 'mastered').length;
    return `${subjectName(subj)}: ${qs.length}题 / ${mastered}已掌握`;
  }).join('；');
  const el = document.getElementById('qb-stats');
  if (el) el.textContent = stats || '无题目';

  // Load supporters
  loadSupporters();
}

async function loadSupporters() {
  const container = document.getElementById('supporters-content');
  if (!container) return;
  const cacheKey = 'supporters_cache';
  const cacheTimeKey = 'supporters_cache_time';
  const now = Date.now();
  const cacheTTL = 24 * 60 * 60 * 1000; // 24h

  try {
    const cached = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheTimeKey);
    if (cached && cacheTime && now - parseInt(cacheTime) < cacheTTL) {
      renderSupporters(JSON.parse(cached));
      return;
    }
    const resp = await fetch(`${SUPPORTERS_URL}?_=${now}`, { cache: 'no-store' });
    if (!resp.ok) throw new Error('fetch failed');
    const data = await resp.json();
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(cacheTimeKey, String(now));
    renderSupporters(data);
  } catch {
    // silent fail — show nothing
  }
}

function renderSupporters(data) {
  const container = document.getElementById('supporters-content');
  if (!container || !data?.sponsors?.length) {
    if (container) container.innerHTML = '<div class="settings-hint">暂无赞助者</div>';
    return;
  }
  const list = data.sponsors.map(s => {
    const name = escapeHTML(s.name || '匿名');
    const amount = s.amount ? `赞助 ¥${s.amount}` : '';
    const note = s.note ? `<div style="font-size:12px;color:#888;margin-top:2px">${escapeHTML(s.note)}</div>` : '';
    return `<div style="padding:8px 0;border-bottom:1px solid #f0f0f0">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:32px;height:32px;border-radius:50%;background:#e8f5e9;color:#2e7d32;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${name.slice(0,1)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500">${name}</div>
          ${note}
        </div>
        ${amount ? `<div style="font-size:12px;color:#2e7d32;flex-shrink:0">${amount}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  container.innerHTML = list;
}

function escapeHTML(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function upgradeQuestionBank() {
  const btn = document.getElementById('upgrade-btn');
  if (btn) { btn.disabled = true; btn.textContent = '加载中...'; }

  try {
    state.remoteVersions = await checkForAppUpdate();
    const merged = await fetchQuestionPack({ force: true });

    // Merge with locally cached progress (preserve user's progress data)
    const cached = await get(K.QB_CACHE);
    Object.keys(merged).forEach(subj => {
      if (cached && cached[subj]) {
        // Deduplicate by id, keeping newer (from merged) if both exist
        const mergedIds = new Set(merged[subj].map(q => q.id));
        merged[subj] = [
          ...merged[subj],
          ...cached[subj].filter(q => !mergedIds.has(q.id))
        ];
      }
    });

    state.questionBank = merged;
    state.settings.lastQuestionBankUpdate = todayKey();
    if (state.remoteVersions?.questionBankVersion) {
      state.settings.questionBankVersion = state.remoteVersions.questionBankVersion;
    }
    await set(K.QB_CACHE, merged);
    await set(K.SETTINGS, state.settings);

    const total = Object.values(merged).reduce((s, a) => s + a.length, 0);
    showToast('题库已更新！共 ' + total + ' 题');
    renderSettings();
  } catch(e) {
    showToast('更新失败，请稍后重试');
    console.error(e);
  }

  if (btn) { btn.disabled = false; btn.textContent = '检查更新'; }
}

// ============================================================
// CHECKIN SYSTEM
// ============================================================
async function ensureTodayCheckin() {
  const today = todayKey();
  if (!state.daily[today]) {
    state.daily[today] = { practiced: 0, questionsCount: 0, correct: 0, accuracy: 0, score: 0, bySubject: {} };
    // First checkin of the day
    const streak = calcStreak();
    await set(K.DAILY, state.daily);
    // Show checkin modal only for home entry
    if (state.view === 'home') showCheckinModal();
  }
}

async function showCheckinModal() {
  const streak = calcStreak();
  const totalDays = Object.keys(state.daily).length;
  const weekDays = getWeekDays();
  const weekCount = weekDays.filter(d => state.daily[d]).length;

  document.getElementById('modal-streak').textContent = streak;
  document.getElementById('modal-total').textContent = totalDays;
  document.getElementById('modal-week').textContent = weekCount;
  document.getElementById('checkin-modal').style.display = 'flex';
}

function calcStreak() {
  if (Object.keys(state.daily).length === 0) return 0;
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = getLocalDateKey(d);
    if (state.daily[key]) streak++;
    else if (i > 0) break; // allow today to not be practiced yet
  }
  return streak;
}

// ============================================================
// EVENT HANDLER
// ============================================================
async function handleClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;

  const action = t.dataset.action;

  switch (action) {
    case 'nav':
      navigate('#/' + t.dataset.view);
      break;

    case 'set-practice-mode':
      state.entry = t.dataset.mode === 'standard' ? null : t.dataset.mode;
      renderHome();
      break;

    case 'start-subject':
      state.subject = t.dataset.subject;
      const entry = t.dataset.entry || 'standard';
      state.entry = entry === 'standard' ? null : entry;
      navigate('#/practice/' + t.dataset.subject + (state.entry ? '?entry=' + state.entry : ''));
      break;

    case 'start-assessment':
      state.subject = 'all';
      state.entry = 'assessment';
      navigate('#/practice/all?entry=assessment');
      break;

    case 'answer': {
      const idx = parseInt(t.dataset.choice, 10);
      const q = state.sessionQuestions[state.sessionIndex];
      const hasOpAudio = ['chinese', 'english', 'math'].includes(q?.subject) && q?.optionAudio;
      const isSubmitted = state.selectedChoice?.submitted === true;
      // 点选项文字播音频（仅未提交时）
      if (hasOpAudio && t.dataset.opaudio && !isSubmitted) {
        playOpAudio(t.dataset.opaudio);
        return;
      }
      // 选答案（不提交）
      state.selectedChoice = { idx, submitted: isSubmitted };
      renderQuestion();
      break;
    }

    case 'submit':
      handleSubmit();
      break;

    case 'next-question':
      nextQuestion();
      break;

    case 'listen':
      speakQuestion();
      break;

    case 'speak-lang':
      speakVariant(t.dataset.lang);
      break;

    case 'fill-submit':
      {
        const inp = document.getElementById('fill-answer-input');
        if (inp) handleFillAnswer(inp.value.trim());
      }
      break;

    case 'dictation-submit':
      handleDictationSubmit();
      break;

    case 'dictation-next':
      nextQuestion();
      break;

    case 'pd-submit':
      handlePDSubmit();
      break;

    case 'pd-next':
      {
        const q = state.sessionQuestions[state.sessionIndex];
        const maxSub = (q.questions || []).length;
        state.pdIndex = (state.pdIndex || 0) + 1;
        if (state.pdIndex >= maxSub) {
          state.pdIndex = 0;
          nextQuestion();
        } else {
          renderQuestion();
        }
      }
      break;

    case 'back-home':
      state.entry = null;
      navigate('#/home');
      break;

    case 'thresh-minus':
      state.settings.weakThreshold = Math.max(0.1, state.settings.weakThreshold - 0.05);
      saveSettingsAndUpdate();
      break;

    case 'thresh-plus':
      state.settings.weakThreshold = Math.min(0.95, state.settings.weakThreshold + 0.05);
      saveSettingsAndUpdate();
      break;

    case 'set-theme':
      state.settings.theme = e.target.dataset.value || null;
      saveSettingsAndUpdate();
      applyTheme(state.settings.theme);
      break;

    case 'upgrade-questions':
      upgradeQuestionBank();
      break;

    case 'dismiss-pwa':
      document.getElementById('pwa-install-banner').style.display = 'none';
      break;

    case 'show-donate-modal':
      document.getElementById('donate-modal').style.display = 'flex';
      break;

    case 'show-support-modal':
      document.getElementById('support-modal').style.display = 'flex';
      break;

    case 'close-support-modal':
      document.getElementById('support-modal').style.display = 'none';
      break;

    case 'close-donate-modal':
      document.getElementById('donate-modal').style.display = 'none';
      break;

    case 'close-checkin-modal':
      document.getElementById('checkin-modal').style.display = 'none';
      break;

    case 'install-pwa':
      if (window.deferredPWA) window.deferredPWA.prompt();
      break;

    case 'open-avatar-choice':
      openAvatarChoiceModal();
      break;

    case 'avatar-use-camera':
      document.getElementById('avatar-camera-input').capture = 'environment';
      document.getElementById('avatar-camera-input').accept = 'image/*';
      document.getElementById('avatar-camera-input').click();
      break;

    case 'avatar-use-upload':
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          const preview = document.getElementById('avatar-preview');
          if (preview) preview.src = ev.target.result;
          document.getElementById('avatar-choice-modal').style.display = 'none';
        };
        reader.readAsDataURL(file);
      };
      inp.click();
      break;

    case 'avatar-use-emoji':
      showAvatarEmojiGrid();
      break;

    case 'edit-account':
      showAccountEditModal();
      break;

    case 'account-setup-confirm':
      await confirmAccountSetup();
      break;

    case 'export-account-qr':
      await exportAccountQR();
      break;

    case 'import-account-qr':
      await openQRImport();
      break;

    case 'close-qr-export':
      document.getElementById('qr-export-modal').style.display = 'none';
      break;

    case 'close-qr-import':
      closeQRImport();
      break;

    case 'completion-confirm':
      document.getElementById('completion-modal').style.display = 'none';
      break;

    case 'clear-qb-cache':
      await del(K.QB_CACHE);
      state.questionBank = createEmptyQuestionBank();
      alert('已清除题库缓存，下次进入时将重新下载');
      break;

    case 'check-app-update':
      doManualAppUpdateCheck();
      break;

    case 'clear-all-data':
      if (!confirm('确定要清除所有数据吗？这会删除所有进度和打卡记录。')) return;
      clearAllData();
      break;

    case 'select-section':
    case 'open-section-switcher':
      showSectionSetupModal();
      break;

    case 'choose-section':
      await chooseSection(t.dataset.section);
      break;
  }
}

async function saveSettingsAndUpdate() {
  await set(K.SETTINGS, state.settings);
  const el = document.getElementById('thresh-val');
  if (el) el.textContent = Math.round(state.settings.weakThreshold * 100) + '%';
  // Re-classify all progress with new threshold, then refresh badges
  await reclassifyAllProgress();
  renderSubjectBadges();
}

// Re-run classification for all questions against current threshold
async function reclassifyAllProgress() {
  const threshold = state.settings.weakThreshold;
  const thresholdPct = threshold * 100;
  Object.values(state.progress).forEach(rec => {
    const total = rec.correct + rec.wrong;
    const acc = total > 0 ? rec.correct / total : 0;
    if (rec.correct >= 3) {
      rec.status = 'mastered';
    } else if (rec.wrong >= 2 || (total > 0 && acc * 100 < thresholdPct)) {
      rec.status = 'weak';
    } else if (rec.correct > 0 || rec.wrong > 0) {
      rec.status = 'new';
    }
  });
  await set(K.PROGRESS, state.progress);
}

async function clearAllData() {
  await clear();
  state.progress = {};
  state.daily = {};
  state.sessions = [];
  state.meta = {};
  state.settings = { weakThreshold: 0.6, lastQuestionBankUpdate: null, appVersion: 1, audioVersion: '', questionBankVersion: '' };

  // Reload question bank from GitHub, then refresh UI (no full page reload)
  await upgradeQuestionBank();
  renderHome();
  showToast('数据已清除，题库已重新加载');
}

// ============================================================
// UTILITIES
// ============================================================
function todayKey() {
  return getLocalDateKey();
}

function dateLabel(iso) {
  return formatDateKeyLabel(iso);
}

function getWeekDays() {
  return listRecentDateKeys(7).reverse();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function subjectName(subj) {
  return { math:'数学', chinese:'语文', english:'英语', physics:'物理', chemistry:'化学',
    biology:'生物', history:'历史', geography:'地理', politics:'道法' }[subj] || subj;
}

function showToast(msg, duration) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, duration || 2500);
}

// ============================================================
// ACCOUNT SYSTEM
// ============================================================
function openAvatarChoiceModal() {
  const modal = document.getElementById('avatar-choice-modal');
  if (!modal) return;
  document.getElementById('avatar-emoji-grid').style.display = 'none';
  modal.style.display = 'flex';
}

function showAvatarEmojiGrid() {
  const grid = document.getElementById('avatar-emoji-grid');
  if (!grid) return;
  if (grid.children.length === 0) {
    const emojis = ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'];
    grid.innerHTML = emojis.map(e =>
      `<button class="emoji-btn" data-emoji="${e}" style="font-size:1.4rem;padding:4px;background:none;border:none;cursor:pointer;border-radius:6px">${e}</button>`
    ).join('');
    grid.querySelectorAll('.emoji-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const emojiSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23ddd'/%3E%3Ctext x='50' y='68' text-anchor='middle' font-size='56'%3E${encodeURIComponent(btn.dataset.emoji)}%3C/text%3E%3C/svg%3E`;
        const preview = document.getElementById('avatar-preview');
        if (preview) preview.src = emojiSvg;
        if (state.account) {
          state.account.avatar = emojiSvg;
          await set(K.ACCOUNT, state.account);
        }
        document.getElementById('avatar-choice-modal').style.display = 'none';
      });
    });
  }
  grid.style.display = 'flex';
}

function showAccountSetupModal() {
  const modal = document.getElementById('account-setup-modal');
  if (!modal) return;
  modal.dataset.mode = 'create';
  document.getElementById('account-setup-emoji').textContent = 'Hi';
  document.getElementById('account-setup-title').textContent = '欢迎使用百日闯';
  document.getElementById('account-setup-sub').textContent = '创建一个专属身份，换设备扫码即可恢复';
  document.getElementById('account-setup-confirm-btn').textContent = '开启百日计划';
  const nameInput = document.getElementById('account-name-input');
  if (nameInput) nameInput.value = '';
  const avatarPreview = document.getElementById('avatar-preview');
  if (avatarPreview) {
    avatarPreview.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23ddd'/%3E%3Ctext x='50' y='65' text-anchor='middle' font-size='50'%3E👤%3C/text%3E%3C/svg%3E";
  }
  modal.style.display = 'flex';
}

function showAccountEditModal() {
  const modal = document.getElementById('account-setup-modal');
  if (!modal || !state.account) return;
  modal.dataset.mode = 'edit';
  document.getElementById('account-setup-emoji').textContent = '编辑';
  document.getElementById('account-setup-title').textContent = '修改资料';
  document.getElementById('account-setup-sub').textContent = '';
  document.getElementById('account-setup-confirm-btn').textContent = '保存';
  const nameInput = document.getElementById('account-name-input');
  if (nameInput) nameInput.value = state.account.name || '';
  const avatarPreview = document.getElementById('avatar-preview');
  if (avatarPreview) avatarPreview.src = state.account.avatar || '';
  modal.style.display = 'flex';
}

async function confirmAccountSetup() {
  const name = (document.getElementById('account-name-input')?.value || '').trim();
  if (!name) { showToast('请输入名字'); return; }
  const avatar = document.getElementById('avatar-preview')?.src || '';
  const modal = document.getElementById('account-setup-modal');
  const isEdit = modal?.dataset.mode === 'edit';
  if (isEdit && state.account) {
    state.account.name = name;
    state.account.avatar = avatar;
    await set(K.ACCOUNT, state.account);
    showToast('资料已保存');
    renderSettings();
    // Update header
    const ha = document.getElementById('header-account-avatar');
    const hn = document.getElementById('header-account-name');
    if (ha) ha.src = avatar;
    if (hn) hn.textContent = name;
  } else {
    state.account = { name, avatar, createdAt: Date.now() };
    await set(K.ACCOUNT, state.account);
    showToast('欢迎，' + name + '！');
    renderHome();
  }
  modal.style.display = 'none';
}

// CDN fallback for qrcode (jsdelivr may fail in some networks)
async function loadQRCode() {
  if (typeof QRCode !== 'undefined') return;
  try {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  } catch {
    // fallback: try unpkg
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/qrcode@1.5.1/build/qrcode.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
}

async function exportAccountQR() {
  if (!state.account) { showToast('请先创建账户'); return; }
  await loadQRCode();
  if (typeof QRCode === 'undefined') { showToast('二维码库加载失败，请检查网络'); return; }
  const data = {
    account: state.account,
    sessions: state.sessions,
    daily: state.daily,
    meta: state.meta,
    progress: state.progress,
  };
  const json = JSON.stringify(data);
  const compressed = LZString.compressToBase64(json);
  // Create modal first if not exists
  let modal = document.getElementById('qr-export-modal');
  if (!modal) modal = createQRExportModal();
  const qrEl = document.getElementById('qr-export-canvas');
  if (!qrEl) { showToast('QR容器不存在'); return; }
  try {
    await QRCode.toCanvas(qrEl, compressed, { width: 280, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
    modal.style.display = 'flex';
  } catch(e) {
    showToast('生成二维码失败');
    console.error(e);
  }
}

function createQRExportModal() {
  const div = document.createElement('div');
  div.id = 'qr-export-modal';
  div.className = 'modal-overlay';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="modal-card float-card" style="top:20px;max-width:360px;text-align:center">
      <div class="modal-toolbar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span class="modal-title">导出账户数据</span>
        <button class="modal-close-btn" data-action="close-qr-export">×</button>
      </div>
      <p style="font-size:13px;color:#666;margin-bottom:12px">用新设备扫码接入，可恢复全部学习记录</p>
      <canvas id="qr-export-canvas" style="display:block;margin:0 auto;max-width:100%"></canvas>
      <p style="font-size:12px;color:#999;margin-top:10px">请保存此二维码</p>
    </div>`;
  document.body.appendChild(div);
  // Also need to handle the close button action
  div.querySelector('[data-action="close-qr-export"]')?.addEventListener('click', () => {
    div.style.display = 'none';
  });
  return div;
}

let qrReader = null;

async function openQRImport() {
  const modal = document.getElementById('qr-import-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  const tip = document.getElementById('qr-import-tip');
  const err = document.getElementById('qr-import-error');
  if (tip) tip.style.display = 'block';
  if (err) { err.style.display = 'none'; err.textContent = ''; }

  // Wait for camera
  try {
    qrReader = new Html5Qrcode('qr-reader');
    await qrReader.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 220 },
      onQRRead,
      () => {} // ignore scan failures
    );
  } catch(e) {
    if (err) { err.textContent = '无法访问摄像头，请确认权限已开启'; err.style.display = 'block'; }
  }
}

async function onQRRead(decodedText) {
  if (!qrReader) return;
  try {
    await qrReader.stop();
  } catch(e) {}
  qrReader = null;

  let raw;
  try {
    raw = LZString.decompressFromBase64(decodedText);
    if (!raw) throw new Error('decompress failed');
  } catch(e) {
    const el = document.getElementById('qr-import-error');
    if (el) { el.textContent = '无效的二维码，请确认是百日闯导出的'; el.style.display = 'block'; }
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch(e) {
    const el = document.getElementById('qr-import-error');
    if (el) { el.textContent = '数据解析失败'; el.style.display = 'block'; }
    return;
  }

  if (!data.account || !data.account.name) {
    const el = document.getElementById('qr-import-error');
    if (el) { el.textContent = '无效的账户数据'; el.style.display = 'block'; }
    return;
  }

  // Import
  if (data.account) {
    state.account = data.account;
    await set(K.ACCOUNT, state.account);
  }
  if (data.sessions) {
    state.sessions = data.sessions;
    await set(K.SESSIONS, state.sessions);
  }
  if (data.daily) {
    state.daily = data.daily;
    await set(K.DAILY, state.daily);
  }
  if (data.meta) {
    state.meta = data.meta;
    await set(K.META, state.meta);
  }
  if (data.progress) {
    state.progress = data.progress;
    await set(K.PROGRESS, state.progress);
  }

  document.getElementById('qr-import-modal').style.display = 'none';
  showToast('恢复成功！' + (data.account.name || '') + '，欢迎回来');
  renderHome();
}

function closeQRImport() {
  if (qrReader) { qrReader.stop().catch(() => {}); qrReader = null; }
  const modal = document.getElementById('qr-import-modal');
  if (modal) modal.style.display = 'none';
}

// ============================================================
// 100-DAY SYSTEM
// ============================================================
function getCurrentDay() {
  if (!state.meta.startDate) return 0;
  const start = new Date(state.meta.startDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((today - start) / 86400000);
  return Math.max(0, diff);
}

async function checkCompletion100() {
  if (state.meta.completed100Days) return;
  const day = getCurrentDay();
  if (day >= 100) {
    await showCompletionModal();
    state.meta.completed100Days = true;
    await set(K.META, state.meta);
  }
}

async function showCompletionModal() {
  const day1 = state.meta.day1AvgAcc;
  const lastSession = state.sessions[state.sessions.length - 1];
  const day100 = lastSession
    ? Math.round(Object.values(lastSession.bySubject || {}).reduce((s, sd) => {
        const total = (sd.correct || 0) + (sd.wrong || 0);
        return s + (total > 0 ? Math.round((sd.correct || 0) / total * 100) : 0);
      }, 0) / Math.max(1, Object.keys(lastSession.bySubject || {}).length))
    : null;

  const gain = day1 !== null && day100 !== null ? day100 - day1 : null;

  document.getElementById('cmp-day1').textContent = day1 !== null ? day1 + '%' : '--';
  document.getElementById('cmp-day100').textContent = day100 !== null ? day100 + '%' : '--';

  const gainEl = document.getElementById('cmp-gain');
  if (gain !== null && gainEl) {
    const sign = gain >= 0 ? '+' : '';
    gainEl.textContent = `总体提升 ${sign}${gain}%`;
    gainEl.style.color = gain >= 0 ? '#4CAF50' : '#e53935';
  }

  // Per-subject comparison
  const subjEl = document.getElementById('cmp-subjects');
  if (subjEl && state.meta.day1SubjectAcc && lastSession) {
    const rows = getSubjects(state.settings.section).map(s => {
      const d1 = state.meta.day1SubjectAcc[s];
      const ds = lastSession.bySubject ? (lastSession.bySubject[s] || {}) : {};
      const total = (ds.correct || 0) + (ds.wrong || 0);
      const d100 = total > 0 ? Math.round((ds.correct || 0) / total * 100) : null;
      if (d1 === null && d100 === null) return null;
      const diff = (d1 !== null && d100 !== null) ? (d100 - d1) : null;
      const sign = diff !== null ? (diff >= 0 ? '+' : '') : '';
      const color = diff !== null ? (diff >= 0 ? '#4CAF50' : '#e53935') : '#999';
      return `<div class="cmp-subj-row">
        <span class="cmp-subj-name">${subjectName(s)}</span>
        <span>${d1 !== null ? d1 + '%' : '--'} → ${d100 !== null ? d100 + '%' : '--'}</span>
        <span style="color:${color}">${diff !== null ? sign + diff + '%' : ''}</span>
      </div>`;
    }).filter(Boolean).join('');
    subjEl.innerHTML = rows;
  }

  document.getElementById('completion-modal').style.display = 'flex';
}

// ============================================================
// SECTION SWITCHER (Settings + First Launch)
// ============================================================

function showSectionSetupModal() {
  document.getElementById('section-setup-modal').style.display = 'flex';
}

function openSectionSwitcherModal() {
  // Same modal, just show it
  showSectionSetupModal();
}

async function chooseSection(section) {
  state.settings.section = section;
  await set(K.SETTINGS, state.settings);
  document.getElementById('section-setup-modal').style.display = 'none';

  // Reload question bank for the new section
  try {
    const grouped = await fetchQuestionPack({ section, force: true });
    state.questionBank = grouped;
    await set(K.QB_CACHE, grouped);
  } catch (e) {
    console.warn('[QB] 学段切换后题库加载失败:', e);
    state.questionBank = createEmptyQuestionBank();
  }

  // Refresh UI
  if (state.view === 'home') renderHome();
  if (state.view === 'settings') renderSettings();
  // Also refresh subject badges if on practice view
  renderSubjectBadges();
  showToast('已切换到' + (section === 'junior' ? '初中' : section === 'primary' ? '小学' : '高中'));
}

function updateSectionDisplay() {
  // Update any section indicator in the header if needed
}

// ============================================================
// PWA install prompt
// ============================================================
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window.deferredPWA = e;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'flex';
});

// PWA install — direct onclick handler (guaranteed clickable)
function installPWADirect() {
  if (window.deferredPWA) {
    window.deferredPWA.prompt();
    window.deferredPWA.userChoice.then(choice => {
      if (choice.outcome === 'accepted') {
        console.log('PWA installed');
      }
      window.deferredPWA = null;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'none';
    });
  }
}

// ============================================================
// BOOT
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
