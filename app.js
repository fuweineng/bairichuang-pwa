// 百日闯 PWA — 重构版

import { get, set, clear } from './js/idb-keyval.mjs';
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
  sessionStartQCount: 0,
  sessionStartCorrect: 0,

  // Persistent data (in-memory cache, synced to IndexedDB)
  questionBank: {},
  progress: {},
  daily: {},
  meta: {},
  settings: { weakThreshold: 0.6, lastQuestionBankUpdate: null, appVersion: 1, audioVersion: '', questionBankVersion: '' },
  remoteVersions: null,
};

// ============================================================
// KEYS
// ============================================================
const K = {
  PROGRESS: 'question_progress',
  DAILY: 'checkin_daily',
  META: 'checkin_meta',
  SETTINGS: 'settings',
  QB_CACHE: 'question_bank_cache',
};

const VERSION_URL = 'version.json';
const QUESTION_PACK_URL = 'questions/question_bank_v2.json';
const SUBJECTS = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics'];

function createEmptyQuestionBank() {
  return { math: [], english: [], chinese: [], physics: [], chemistry: [], biology: [], history: [], geography: [], politics: [] };
}

function groupQuestionsBySubject(questions = []) {
  const grouped = createEmptyQuestionBank();
  questions.forEach(question => {
    if (grouped[question.subject]) {
      grouped[question.subject].push(question);
    }
  });
  return grouped;
}

async function fetchQuestionPack({ force = false } = {}) {
  const requestUrl = force ? `${QUESTION_PACK_URL}?_=${Date.now()}` : QUESTION_PACK_URL;
  const response = await fetch(requestUrl, force ? { cache: 'no-store' } : undefined);
  if (!response.ok) {
    throw new Error(`题库加载失败: ${response.status}`);
  }
  return groupQuestionsBySubject(await response.json());
}

function hasQuestionPackUpdate() {
  const remoteVersion = state.remoteVersions?.questionBankVersion;
  if (!remoteVersion) return false;
  return remoteVersion !== (state.settings.questionBankVersion || '');
}

// ============================================================
// INIT
// ============================================================
async function init() {
  console.log('百日闯 PWA 初始化中...');

  // Load persisted state
  state.progress = await get(K.PROGRESS) || {};
  state.daily    = await get(K.DAILY)    || {};
  state.meta     = await get(K.META)     || {};
  state.settings = await get(K.SETTINGS) || { weakThreshold: 0.6, lastQuestionBankUpdate: null, appVersion: 1, audioVersion: '', questionBankVersion: '' };

  // Check for app shell and question pack updates
  state.remoteVersions = await checkForAppUpdate();

  // Load question bank: cache first, then refresh from network if cache is stale
  const cached = await get(K.QB_CACHE);
  state.questionBank = cached || createEmptyQuestionBank();
  fetchQuestionPack({ force: true })
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
  document.getElementById('app').addEventListener('click', handleClick);
  window.addEventListener('hashchange', router);

  // Kick off router
  router();

  // Chart subject switcher
  document.getElementById('chart-subject-bar').addEventListener('click', e => {
    const btn = e.target.closest('.subj-btn');
    if (!btn) return;
    const subj = btn.dataset.chartSubj;
    state.chartSubject = subj;
    document.querySelectorAll('.subj-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('home-chart-container').innerHTML = drawChart();
  });

  console.log('百日闯 PWA 初始化完成');
}

// ============================================================
// APP UPDATE
// ============================================================
async function checkForAppUpdate() {
  try {
    const resp = await fetch(`${VERSION_URL}?_=${Date.now()}`, { cache: 'no-store' });
    if (!resp.ok) return null;
    const remote = await resp.json();

    const localVer = state.settings.appVersion || 1;
    if (remote.version && remote.version > localVer) {
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
function renderHome() {
  // Streak
  const streak = calcStreak();
  document.getElementById('streak-count').textContent = streak;
  const sub = document.getElementById('streak-sub');
  sub.textContent = streak === 0 ? '开始你的百日计划' : `已打卡 ${Object.keys(state.daily).length} 天`;

  // Mini chart on home page
  const homeChartEl = document.getElementById('home-chart-container');
  if (homeChartEl) {
    homeChartEl.innerHTML = drawChart();
  }

  const badge = document.getElementById('update-badge');
  if (badge) {
    badge.style.display = hasQuestionPackUpdate() ? 'inline-block' : 'none';
  }

  // Entry card counts
  updateEntryCounts();
  // Per-subject badges on the grid
  renderSubjectBadges();
  renderPracticeModeBar();
}

function updateEntryCounts() {
  const counts = { new: 0, weak: 0, mastered: 0 };
  Object.values(state.questionBank).forEach(questions => {
    questions.forEach(q => {
      const s = (state.progress[q.id] || {}).status || 'new';
      if (s in counts) counts[s]++;
    });
  });
  setCount('entry-new-count', counts.new);
  setCount('entry-weak-count', counts.weak);
  setCount('entry-mastered-count', counts.mastered);
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
  return getQuestionStatus(question) === mode;
}

function countQuestionsForSubject(subject, mode = getPracticeMode()) {
  const questions = state.questionBank[subject] || [];
  return questions.filter(question => questionMatchesMode(question, mode)).length;
}

// Update per-subject counts on the home screen grid
function renderSubjectBadges() {
  const mode = getPracticeMode();

  SUBJECTS.forEach(subj => {
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
    ? SUBJECTS.reduce((sum, subj) => sum + countQuestionsForSubject(subj, mode), 0)
    : countQuestionsForSubject(state.subject, mode);
  const subjectLabel = state.subject === 'all' ? '全科练习' : subjectName(state.subject);

  title.textContent = subjectLabel;
  entryInfo.className = `practice-entry-info ${mode === 'standard' ? '' : mode}`.trim();
  entryInfo.textContent = `${subjectLabel} · ${getPracticeModeLabel(mode)} · ${availableCount}题可练`;
  startSession(state.subject, state.entry);
}

function buildSessionQuestions(subject, mode = getPracticeMode()) {
  if (subject === 'all') {
    const buckets = SUBJECTS.map(subj => shuffle((state.questionBank[subj] || []).filter(question => questionMatchesMode(question, mode))));
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
  return normalizedUser === normalizedAnswer || userAnswer === String(correctAnswer);
}

function appendExplanation(fb, questionLike) {
  if (questionLike?.audio_text) {
    fb.innerHTML += `<p class="explanation"><strong>听力原文：</strong>${questionLike.audio_text.replace(/\n/g, '<br>')}</p>`;
  }
  if (questionLike?.passage) {
    fb.innerHTML += `<p class="explanation"><strong>短文原文：</strong>${questionLike.passage.replace(/\n/g, '<br>')}</p>`;
  }
  if (questionLike?.explanation) {
    fb.innerHTML += `<p class="explanation">${questionLike.explanation}</p>`;
  }
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
  const CDN_BASE = 'https://cdn.jsdelivr.net/gh/fuweineng/bairichuang-pwa@master/audio/';

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
      if (btn) { btn.textContent = '🔊 播放'; btn.disabled = false; }
      return;
    }
    const audioPath = paths[pathIndex++];
    const audio = new Audio(audioPath);
    currentAudio = audio;

    const grid = document.querySelector('.answer-grid');
    if (grid) grid.style.pointerEvents = 'none';
    const btn = document.getElementById('listen-btn');
    if (btn) { btn.textContent = '🔊 播放中...'; btn.disabled = true; }

    audio.onended = () => {
      currentAudio = null;
      if (grid) grid.style.pointerEvents = '';
      if (btn) { btn.textContent = '✅ 已听完'; btn.disabled = false; }
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
  if (btn) { btn.textContent = '🔊 播放中...'; btn.disabled = true; }

  utter.onend = () => {
    if (grid) grid.style.pointerEvents = '';
    if (btn) { btn.textContent = '✅ 已听完'; btn.disabled = false; }
  };
  utter.onerror = () => {
    if (grid) grid.style.pointerEvents = '';
    if (btn) { btn.textContent = '🔊 重试'; btn.disabled = false; }
  };

  state.ttsUtterance = utter;
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
  const diffLabel = ['', '🟢 简单', '🟡 中等', '🔴 困难'][q.difficulty] || '';
  const imageSources = Array.isArray(q.images)
    ? q.images
    : [q.imageUrl || q.image].filter(Boolean);
  const imageBlock = imageSources.length > 0
    ? `<div class="question-image-grid">${imageSources.map(src => `<img class="question-image" src="${src}" alt="题目配图" loading="lazy" />`).join('')}</div>`
    : '';

  // ── LISTENING TYPE: dictation ──────────────────────────────────────
  if (q.type === 'dictation') {
    const listenBtn = `<button class="listen-btn" id="listen-btn" data-action="listen">🔊 听句子</button>`;
    container.innerHTML = `
      <div class="question-meta">
        <span>${typeLabel}</span><span>${diffLabel}</span>
        <span class="question-progress">${idx + 1}/${total}</span>
      </div>
      ${q.hint ? `<div class="question-hint">${q.hint}</div>` : ''}
      ${listenBtn}
      ${imageBlock}
      <div class="question-text">请填写你听到的关键词：</div>
      <div class="fill-area">
        <div class="fill-input-row">
          <input type="text" class="fill-input" id="fill-answer-input"
            placeholder="输入答案后按回车或点击提交" autocomplete="off" />
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
    const listenBtn = `<button class="listen-btn" id="listen-btn" data-action="listen">🔊 听短文</button>`;
    container.innerHTML = `
      <div class="question-meta">
        <span>${typeLabel}</span><span>${diffLabel}</span>
        <span class="question-progress">${idx + 1}/${total}</span>
        <span class="sub-progress">小题 ${subIdx + 1}/${subQs.length}</span>
      </div>
      ${listenBtn}
      ${q.hint ? `<div class="question-hint">${q.hint}</div>` : ''}
      ${imageBlock}
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
    ? `<button class="listen-btn" id="listen-btn" data-action="listen">🔊 播放音频</button>`
    : '';

  // ── 判断题型 ──────────────────────────────────────────────────────────
  // choice 类型: q.options 数组；listening 类型: q.choices 数组
  const hasOptions = q.options && q.options.length > 0;         // choice 用 options
  const hasChoices = q.choices && q.choices.length > 0;         // listening 用 choices
  const isChoice = hasOptions && q.type === 'choice';
  const isListeningType = hasChoices && q.type === 'listening';
  const isFillOrShort = !hasOptions && !hasChoices && (q.type === 'fill' || q.type === 'short_answer' || q.type === 'expression');

  // 选项按钮 (choice 用 options 文字；listening 用 choices[{label,text}])
  const opts = isChoice
    ? q.options.map((opt, i) =>
        `<button class="answer-btn" data-action="answer" data-choice="${i}">${opt}</button>`
      ).join('')
    : isListeningType
    ? q.choices.map((c, i) =>
        `<button class="answer-btn" data-action="answer" data-choice="${i}">${c.label}. ${c.text}</button>`
      ).join('')
    : '';

  const inputArea = isFillOrShort
    ? `<div class="fill-area">
         <div class="fill-input-row">
           <input type="text" class="fill-input" id="fill-answer-input" placeholder="${q.type === 'short_answer' ? '写出答案...' : '填写答案...'}" autocomplete="off" onkeydown="if(event.key==='Enter')document.getElementById('fill-answer-input') && document.getElementById('fill-answer-input').closest('.fill-area').querySelector('[data-action]').click()" />
           <button class="fill-submit-btn primary-btn" data-action="fill-submit">提交</button>
         </div>
       </div>`
    : '';

  container.innerHTML = `
    <div class="question-meta">
      <span>${typeLabel}</span><span>${diffLabel}</span>
      <span class="question-progress">${idx + 1}/${total}</span>
    </div>
    ${listenBtn}
    ${q.hint ? `<div class="question-hint">${q.hint}</div>` : ''}
    ${imageBlock}
    <div class="question-text">${q.question}</div>
    ${opts ? `<div class="answer-grid">${opts}</div>` : ''}
    ${inputArea}
    <div id="answer-feedback" style="display:none;margin-top:12px"></div>
  `;

  if (isFillOrShort) {
    const inp = document.getElementById('fill-answer-input');
    if (inp) inp.focus();
  }

  if (isListening) {
    state.ttsUtterance = null;
  }
}

async function handleAnswer(choiceIdx) {
  const q = state.sessionQuestions[state.sessionIndex];

  // 判断答案：choice 用 q.options[idx] === q.answer；listening 用 q.choices[idx].label === q.answer
  let isCorrect = false;
  if (q.type === 'choice' && q.options) {
    isCorrect = q.options[choiceIdx] === String(q.answer) ||
      (Array.isArray(q.answer) && q.answer.includes(String(choiceIdx)));
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
    if (q.type === 'listening' && q.choices) {
      const found = q.choices.find(c => c.label === q.answer);
      if (found) correctLabel = `${q.answer}. ${found.text}`;
    }
    if (isCorrect) {
      fb.innerHTML = `<span class="fb-correct">✅ 正确！</span>`;
    } else {
      fb.innerHTML = `<span class="fb-wrong">❌ 错误！正确答案是：${correctLabel}</span>`;
    }
    appendExplanation(fb, q);
    fb.innerHTML += `<button class="primary-btn" data-action="next-question" style="margin-top:10px">下一题 →</button>`;
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
    if (isCorrect) {
      fb.innerHTML = `<span class="fb-correct">✅ 正确！</span>`;
    } else {
      fb.innerHTML = `<span class="fb-wrong">❌ 错误！正确答案是：${formatAnswerForDisplay(q.answer)}</span>`;
    }
    appendExplanation(fb, q);
    fb.innerHTML += `<button class="primary-btn" data-action="dictation-next" style="margin-top:10px">下一题 →</button>`;
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
    if (isCorrect) {
      fb.innerHTML = `<span class="fb-correct">✅ 正确！</span>`;
    } else {
      fb.innerHTML = `<span class="fb-wrong">❌ 错误！正确答案是：${formatAnswerForDisplay(sq.answer)}</span>`;
    }
    appendExplanation(fb, { ...sq, passage: q.passage });
    fb.innerHTML += `<button class="primary-btn" data-action="pd-next" style="margin-top:10px">${
      subIdx + 1 >= (q.questions || []).length ? '短文结束 →' : '下一题 →'
    }</button>`;
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
    if (isCorrect) {
      fb.innerHTML = `<span class="fb-correct">✅ 正确！</span>`;
    } else {
      fb.innerHTML = `<span class="fb-wrong">❌ 错误！正确答案是：${formatAnswerForDisplay(correctAns)}</span>`;
    }
    appendExplanation(fb, q);
    fb.innerHTML += `<button class="primary-btn" data-action="next-question" style="margin-top:10px">下一题 →</button>`;
  }
}

async function nextQuestion() {
  state.sessionIndex++;
  state.pdIndex = 0;
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

  const streak = calcStreak();

  container.innerHTML = `
    <div class="session-end">
      <p class="placeholder">本轮完成！</p>
      <div class="session-score">
        <span class="big-num">${correct}/${total}</span>
        <span>正确率 ${sessionAcc}%</span>
      </div>
      <div class="session-daily">
        <p>今日累计: ${state.daily[today].questionsCount}题 | 得分: ${state.daily[today].score}</p>
        <p>连续 ${streak} 天</p>
      </div>
      <button class="primary-btn" data-action="back-home" style="margin-top:16px">返回首页</button>
    </div>
  `;
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

// SVG Chart — last 30 days, multi-line
function drawChart() {
  const W = 340, H = 120, PAD = 20;
  const days = 30;
  const dates = listRecentDateKeys(days);

  const subj = state.chartSubject || 'all';
  const lineColors = {
    all: '#4CAF50', chinese: '#E91E63', math: '#2196F3',
    english: '#FF9800', physics: '#9C27B0', chemistry: '#E91E63', biology: '#009688',
    history: '#795548', geography: '#607D8B', politics: '#F44336'
  };
  const typeColors = {
    choice: '#4CAF50',
    fill: '#2196F3',
    short_answer: '#FF9800',
    listening: '#8b5cf6',
    dictation: '#ec4899',
    passage_dictation: '#14b8a6',
  };

  let lines = []; // [{label, color, values}]

  if (subj === 'all') {
    // One line per subject
    const subjects = ['chinese','math','english','physics','chemistry','biology','history','geography','politics'];
    subjects.forEach(s => {
      const vals = dates.map(d => {
        const byS = (state.daily[d] || {}).bySubject || {};
        const sdata = byS[s] || {};
        const total = sdata.correct + sdata.wrong;
        return total > 0 ? Math.round(sdata.correct / total * 100) : 0;
      });
      if (vals.some(v => v > 0)) {
        lines.push({ label: subjectName(s), color: lineColors[s] || '#999', values: vals });
      }
    });
  } else {
    // One line per type for selected subject
    ['choice','fill','short_answer','listening','dictation','passage_dictation'].forEach(t => {
      const vals = dates.map(d => {
        const byS = (state.daily[d] || {}).bySubject || {};
        const sdata = byS[subj] || {};
        const byT = sdata.byType || {};
        const tdata = byT[t] || {};
        const total = tdata.correct + tdata.wrong;
        return total > 0 ? Math.round(tdata.correct / total * 100) : 0;
      });
      if (vals.some(v => v > 0)) {
        const labelMap = {
          choice: '选择题',
          fill: '填空题',
          short_answer: '简答题',
          listening: '听力选择',
          dictation: '听写填空',
          passage_dictation: '短文听写',
        };
        lines.push({ label: labelMap[t] || t, color: typeColors[t] || '#999', values: vals });
      }
    });
  }

  if (lines.length === 0) {
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" class="chart-svg"><text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#ccc" font-size="12">暂无数据</text></svg>`;
  }

  const allVals = lines.flatMap(l => l.values);
  const maxS = Math.max(10, ...allVals.filter(v => v > 0));
  const xStep = (W - PAD * 2) / (days - 1);
  const yScale = (H - PAD * 2) / maxS;

  // X labels
  const xLabels = [0, 7, 14, 21, 29].map(i => {
    if (!dates[i]) return '';
    return `<text x="${PAD + i*xStep}" y="${H-4}" class="chart-xlabel">${formatDateKeyShort(dates[i])}</text>`;
  }).join('');

  // Y labels
  const yLabels = [0, Math.round(maxS/2), maxS].map(s => {
    const y = H - PAD - s * yScale;
    return `<text x="${PAD-4}" y="${y+4}" class="chart-ylabel" text-anchor="end">${s}</text>`;
  }).join('');

  const svgLines = lines.map(line => {
    const pts = line.values.map((s, i) => [
      PAD + i * xStep,
      s > 0 ? H - PAD - s * yScale : H - PAD
    ]);
    const ptsStr = pts.map((p, i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    return `<polyline points="${ptsStr}" fill="none" stroke="${line.color}" stroke-width="1.8" stroke-opacity="0.85"/>`;
  }).join('');

  // Legend
  const legendItems = lines.map(l =>
    `<span style="display:inline-flex;align-items:center;gap:3px;margin-right:8px;font-size:10px;color:${l.color}">
       <span style="display:inline-block;width:16px;height:2px;background:${l.color}"></span>${l.label}
     </span>`
  ).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" class="chart-svg">
    ${xLabels}${yLabels}
    ${svgLines}
    <text x="${PAD}" y="${PAD-4}" font-size="9" fill="#999">%</text>
  </svg>
  <div class="chart-legend">${legendItems}</div>`;
}

// SETTINGS VIEW
async function renderSettings() {
  const container = document.getElementById('settings-content');
  const lastUpdate = state.settings.lastQuestionBankUpdate
    ? dateLabel(state.settings.lastQuestionBankUpdate)
    : '从未更新';
  const localPackVersion = state.settings.questionBankVersion || '未记录';
  const remotePackVersion = state.remoteVersions?.questionBankVersion || '未知';

  container.innerHTML = `
    <div class="settings-card">
      <div class="settings-row">
        <span class="settings-label">易错阈值</span>
        <div class="settings-stepper">
          <button class="stepper-btn" data-action="thresh-minus">−</button>
          <span class="stepper-val" id="thresh-val">${Math.round(state.settings.weakThreshold * 100)}%</span>
          <button class="stepper-btn" data-action="thresh-plus">+</button>
        </div>
      </div>
      <div class="settings-hint">正确率低于此值的题目进入"易错汇总"</div>
    </div>
    <div class="settings-card">
      <div class="settings-row">
        <span class="settings-label">题库版本</span>
        <span class="settings-val">${localPackVersion}</span>
      </div>
      <div class="settings-hint">最近同步：${lastUpdate}</div>
      <div class="settings-hint">远端版本：${remotePackVersion}</div>
      <button class="primary-btn" data-action="upgrade-questions" id="upgrade-btn" style="margin-top:10px">检查更新</button>
    </div>
    <div class="settings-card">
      <div class="settings-row">
        <span class="settings-label">题库统计</span>
      </div>
      <div class="settings-hint" id="qb-stats">加载中...</div>
    </div>
    <div class="settings-card">
      <button class="danger-btn" data-action="clear-all-data">清除所有数据</button>
    </div>
  `;

  // Show QB stats
  const stats = Object.entries(state.questionBank).map(([subj, qs]) => {
    const mastered = qs.filter(q => (state.progress[q.id] || {}).status === 'mastered').length;
    return `${subjectName(subj)}: ${qs.length}题 / ${mastered}已掌握`;
  }).join('；');
  const el = document.getElementById('qb-stats');
  if (el) el.textContent = stats || '无题目';
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
    if (streak === 0 && !state.meta.firstCheckinDate) {
      state.meta.firstCheckinDate = today;
      await set(K.META, state.meta);
    }
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
  const days = Object.keys(state.daily).sort().reverse();
  if (days.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const key = getLocalDateKey(shiftDate(today, -i));
    if (state.daily[key]) streak++;
    else if (i > 0) break; // allow today to not be practiced yet
  }
  return streak;
}

// ============================================================
// EVENT HANDLER
// ============================================================
function handleClick(e) {
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
      navigate('#/practice/' + t.dataset.subject + (state.entry ? '?entry=' + state.entry : ''));
      break;

    case 'answer':
      handleAnswer(parseInt(t.dataset.choice, 10));
      break;

    case 'next-question':
      nextQuestion();
      break;

    case 'listen':
      speakQuestion();
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
      updateEntryCounts();
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

    case 'upgrade-questions':
      upgradeQuestionBank();
      break;

    case 'dismiss-pwa':
      document.getElementById('pwa-install-banner').style.display = 'none';
      break;

    case 'close-checkin-modal':
      document.getElementById('checkin-modal').style.display = 'none';
      break;

    case 'install-pwa':
      if (window.deferredPWA) window.deferredPWA.prompt();
      break;

    case 'clear-all-data':
      if (!confirm('确定要清除所有数据吗？这会删除所有进度和打卡记录。')) return;
      clearAllData();
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
// PWA install prompt
// ============================================================
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window.deferredPWA = e;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'flex';
});

// ============================================================
// BOOT
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
