// App Module
// Main entry point for 百日闯 PWA

import { checkin, getCheckinStreak, getCheckinHistoryList } from './checkin.js';
import { initializeQuestionBank, loadQuestions, getQuestionsBySubject, saveProgress, getProgress, addWrongQuestion, getWrongQuestions, removeWrongQuestion, clearWrongQuestions, recordKnowledgeTag, getKnowledgeMastery, getSettings, saveSetting, clearAllData } from './question_bank.js';

// State
let currentView = 'index';
let currentSubject = null;

// Practice session state
let sessionQuestions = [];
let sessionIndex = 0;
let sessionScore = { correct: 0, wrong: 0 };
let sessionSubject = null;

// Initialize app
async function init() {
  console.log('百日闯 PWA 初始化中...');

  // Check PWA install status
  checkPWAInstall();

  // Initialize question bank
  await initializeQuestionBank();

  // Setup routing
  setupRouting();

  // Bind events
  bindEvents();

  // Load initial data
  await refreshUI();

  console.log('百日闯 PWA 初始化完成');
}

// Check PWA installation
function checkPWAInstall() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('Service Worker registered:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    console.log('PWA install prompt deferred');
  });
}

// Simple hash-based routing
function setupRouting() {
  window.addEventListener('hashchange', () => {
    const route = window.location.hash || '#/index';
    navigate(route);
  });

  // Initial route
  const initialRoute = window.location.hash || '#/index';
  navigate(initialRoute);
}

function navigate(route) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  // Show target view
  if (route === '#/practice') {
    document.getElementById('practice-view').classList.add('active');
    currentView = 'practice';
  } else if (route === '#/progress') {
    document.getElementById('progress-view').classList.add('active');
    currentView = 'progress';
    loadProgressView();
  } else if (route === '#/wrong') {
    document.getElementById('wrong-view').classList.add('active');
    currentView = 'wrong';
    loadWrongView();
  } else if (route === '#/mastery') {
    document.getElementById('mastery-view').classList.add('active');
    currentView = 'mastery';
    loadMasteryView('math', 'tag');
  } else if (route === '#/settings') {
    document.getElementById('settings-view').classList.add('active');
    currentView = 'settings';
    loadSettingsView();
  } else {
    document.getElementById('home-view').classList.add('active');
    currentView = 'index';
  }
}

// Bind UI events
function bindEvents() {
  // Checkin button
  const checkinBtn = document.getElementById('checkin-btn');
  if (checkinBtn) {
    checkinBtn.addEventListener('click', async () => {
      const result = await checkin();
      await refreshUI();
      if (result.success) {
        showCheckinSuccessModal(result.streak);
      } else {
        showToast(result.message);
      }
    });
  }

  // Route buttons
  document.querySelectorAll('[data-route]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = btn.dataset.route;
    });
  });

  // Subject buttons
  document.querySelectorAll('.subject-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const subject = btn.dataset.subject;
      await startPracticeSession(subject);
    });
  });

  // Mastery subject tabs
  document.querySelectorAll('.mastery-subject-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      loadMasteryView(btn.dataset.subject, currentMasteryType);
    });
  });

  // Mastery type tabs
  document.querySelectorAll('.mastery-type-tabs .type-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      loadMasteryView(currentMasterySubject, btn.dataset.type);
    });
  });

  // PWA install button
  const pwaBtn = document.getElementById('pwa-install-btn');
  if (pwaBtn) pwaBtn.addEventListener('click', installPWA);
}

// Refresh UI data
async function refreshUI() {
  // Update streak count
  const streakCount = document.getElementById('streak-count');
  if (streakCount) {
    const streak = await getCheckinStreak();
    streakCount.textContent = streak;
  }

  // Update checkin button state
  const checkinBtn = document.getElementById('checkin-btn');
  if (checkinBtn) {
    const today = new Date().toISOString().split('T')[0];
    const history = await getCheckinHistoryList();
    const checkedToday = history.some(h => h.date === today);
    checkinBtn.disabled = checkedToday;
    checkinBtn.textContent = checkedToday ? '今日已打卡' : '今日打卡';
  }

  // Update today stats
  const today = new Date().toISOString().split('T')[0];
  const history = await getCheckinHistoryList();
  const checkedToday = history.some(h => h.date === today);

  // Checkin icon
  const checkinIcon = document.getElementById('today-checkin-icon');
  const checkinText = document.getElementById('today-checkin-text');
  if (checkinIcon) {
    checkinIcon.textContent = checkedToday ? '✓' : '○';
    checkinIcon.classList.toggle('checked', checkedToday);
  }
  if (checkinText) {
    checkinText.textContent = checkedToday ? '已打卡' : '未打卡';
  }

  // Practice count & accuracy from progress
  const progress = await getProgress();
  const todayProgress = Object.entries(progress)
    .filter(([qid, record]) => record.date === today)
    .map(([qid, record]) => record);

  const practiceCount = todayProgress.length;
  const correctCount = todayProgress.filter(p => p.correct).length;
  const accuracy = practiceCount > 0 ? Math.round((correctCount / practiceCount) * 100) : null;

  const countEl = document.getElementById('today-practice-count');
  const accuracyEl = document.getElementById('today-accuracy');
  if (countEl) countEl.textContent = practiceCount;
  if (accuracyEl) accuracyEl.textContent = accuracy !== null ? `${accuracy}%` : '--%';

  // Update daily goal progress
  const settings = await getSettings();
  const dailyGoal = settings.dailyGoal || 10;
  const progressText = document.getElementById('goal-progress-text');
  const goalFill = document.getElementById('goal-fill');
  if (progressText) progressText.textContent = `${practiceCount}/${dailyGoal}`;
  if (goalFill) goalFill.style.width = `${Math.min((practiceCount / dailyGoal) * 100, 100)}%`;

  // Update wrong badge
  const wrongList = await getWrongQuestions();
  const badge = document.getElementById('wrong-badge');
  if (badge) {
    if (wrongList.length > 0) {
      badge.textContent = wrongList.length;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  }
}

// Start a new practice session
async function startPracticeSession(subject) {
  const questions = await getQuestionsBySubject(subject);
  if (questions.length === 0) return;

  // Filter by difficulty from settings
  const settings = await getSettings();
  const filtered = settings.difficultyFilter
    ? questions.filter(q => q.difficulty === settings.difficultyFilter)
    : questions;

  // Shuffle and pick up to 10
  const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, 10);
  sessionQuestions = shuffled;
  sessionIndex = 0;
  sessionScore = { correct: 0, wrong: 0 };
  sessionSubject = subject;

  // Highlight active subject button
  document.querySelectorAll('.subject-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.subject === subject);
  });

  renderCurrentQuestion();
}

// Render the current question in the session
function renderCurrentQuestion() {
  const container = document.getElementById('question-container');
  if (!container || sessionIndex >= sessionQuestions.length) {
    renderSessionResult();
    return;
  }

  const q = sessionQuestions[sessionIndex];
  const total = sessionQuestions.length;
  const num = sessionIndex + 1;

  let html = `
    <div class="session-progress">
      <span>第 ${num}/${total} 题</span>
      <span class="score-hint">
        <span class="green">✓${sessionScore.correct}</span> /
        <span class="red">✗${sessionScore.wrong}</span>
      </span>
    </div>
    <div class="question">
      <p class="question-type">${getQuestionTypeName(q.type)} · ${getDifficultyName(q.difficulty)}</p>
      <p class="question-text">${q.question}</p>
    </div>
  `;

  if (q.type === 'choice' && q.options) {
    html += '<div class="options">';
    q.options.forEach((opt, i) => {
      html += `<button class="option-btn" data-index="${i}">${opt}</button>`;
    });
    html += '</div>';
  } else if (q.type === 'fill') {
    html += `
      <div class="fill-area">
        <input type="text" class="fill-input" placeholder="请输入答案..." autocomplete="off" />
        <button class="primary-btn fill-submit-btn">提交答案</button>
      </div>
    `;
  }

  container.innerHTML = html;

  // Bind events
  if (q.type === 'choice' && q.options) {
    container.querySelectorAll('.option-btn').forEach(optBtn => {
      optBtn.addEventListener('click', () => handleAnswer(optBtn, q));
    });
  } else if (q.type === 'fill') {
    const submitBtn = container.querySelector('.fill-submit-btn');
    const input = container.querySelector('.fill-input');
    if (submitBtn) submitBtn.addEventListener('click', () => handleFillSubmit(q));
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') handleFillSubmit(q); });
  }
}

// Handle answer for choice questions
async function handleAnswer(optBtn, q) {
  const selectedIndex = parseInt(optBtn.dataset.index);
  const isCorrect = q.answer === q.options[selectedIndex];
  await processAnswer(q, q.options[selectedIndex], isCorrect, () => {
    const container = document.getElementById('question-container');
    container.querySelectorAll('.option-btn').forEach(b => {
      b.disabled = true;
      const idx = parseInt(b.dataset.index);
      if (idx === q.options.indexOf(q.answer)) b.classList.add('correct');
      else if (idx === selectedIndex && !isCorrect) b.classList.add('wrong');
    });
  });
}

// Handle fill-in-the-blank submission
async function handleFillSubmit(q) {
  const container = document.getElementById('question-container');
  const input = container.querySelector('.fill-input');
  if (!input) return;
  const userAnswer = input.value.trim();
  if (!userAnswer) return;

  // Normalize for comparison
  const isCorrect = userAnswer === q.answer || userAnswer === q.answer.replace(/[\\s　]+/g, '').trim();
  await processAnswer(q, userAnswer, isCorrect, () => {
    input.disabled = true;
    const submitBtn = container.querySelector('.fill-submit-btn');
    if (submitBtn) submitBtn.disabled = true;
    // Show correct answer
    const answerHint = document.createElement('p');
    answerHint.className = isCorrect ? 'fill-correct' : 'fill-wrong';
    answerHint.textContent = isCorrect ? `✓ 正确！` : `✗ 正确答案：${q.answer}`;
    input.parentNode.appendChild(answerHint);
  });
}

// Process answer: save progress, update scores, record knowledge
async function processAnswer(q, userAnswer, isCorrect, onFeedback) {
  await saveProgress(q.id, userAnswer, isCorrect);
  await recordKnowledgeTag(q, isCorrect);

  if (!isCorrect) {
    await addWrongQuestion(q, userAnswer);
    sessionScore.wrong++;
  } else {
    sessionScore.correct++;
  }

  onFeedback();

  // Show next button
  const container = document.getElementById('question-container');
  const isLast = sessionIndex >= sessionQuestions.length - 1;
  const nextLabel = isLast ? '查看结果' : '下一题';
  const nextBtn = document.createElement('button');
  nextBtn.className = 'primary-btn';
  nextBtn.style.marginTop = '16px';
  nextBtn.textContent = nextLabel;
  nextBtn.addEventListener('click', () => {
    sessionIndex++;
    renderCurrentQuestion();
  });
  container.appendChild(nextBtn);
}

// Show session result
function renderSessionResult() {
  const container = document.getElementById('question-container');
  const total = sessionQuestions.length;
  const { correct, wrong } = sessionScore;
  const pct = Math.round((correct / total) * 100);

  let emoji = '🎉';
  let msg = '太棒了！';
  if (pct < 60) { emoji = '💪'; msg = '继续加油！'; }
  else if (pct < 80) { emoji = '👍'; msg = '很不错！'; }

  container.innerHTML = `
    <div class="result-box">
      <p class="result-emoji">${emoji}</p>
      <p class="result-msg">${msg}</p>
      <p class="result-score">
        <span class="green">✓ ${correct}</span> /
        <span class="red">✗ ${wrong}</span>
      </p>
      <p class="result-pct">正确率 ${pct}%</p>
    </div>
    <button class="primary-btn" id="rerun-btn">再练一次</button>
  `;

  document.getElementById('rerun-btn').addEventListener('click', () => {
    startPracticeSession(sessionSubject);
  });
}

// Reset practice view to initial state
function resetPracticeView() {
  sessionQuestions = [];
  sessionIndex = 0;
  sessionScore = { correct: 0, wrong: 0 };
  sessionSubject = null;
  document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('question-container').innerHTML = '<p class="placeholder">选择科目开始练习</p>';
}

// Show checkin success modal
async function showCheckinSuccessModal(streak) {
  const history = await getCheckinHistoryList();
  const total = history.length;
  const today = new Date().toISOString().split('T')[0];

  // Count this week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekCount = history.filter(h => {
    const d = new Date(h.date);
    return d >= weekStart;
  }).length;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <p class="modal-emoji">🎉</p>
      <p class="modal-title">打卡成功！</p>
      <p class="modal-streak">连续 <strong>${streak}</strong> 天</p>
      <div class="modal-stats">
        <div class="stat-item">
          <span class="stat-num">${total}</span>
          <span class="stat-label">总打卡天数</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">${weekCount}</span>
          <span class="stat-label">本周打卡</span>
        </div>
      </div>
      <button class="primary-btn" id="modal-close-btn">继续学习</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('modal-close-btn').addEventListener('click', () => {
    modal.remove();
  });
}

// Show toast message
function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ==================== Knowledge Mastery View ====================

const MASTERY_COLORS = [
  '#4CAF50','#2196F3','#FF9800','#9C27B0',
  '#E91E63','#00BCD4','#795548','#607D8B',
  '#8BC34A','#3F51B5','#FF5722','#009688'
];

let currentMasterySubject = 'math';
let currentMasteryType = 'tag';

async function loadMasteryView(subject, type) {
  currentMasterySubject = subject;
  currentMasteryType = type;

  const container = document.getElementById('mastery-content');
  if (!container) return;

  // Update tab states
  document.querySelectorAll('.mastery-subject-tabs .tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.subject === subject);
  });
  document.querySelectorAll('.mastery-type-tabs .type-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });

  container.innerHTML = '<p class="placeholder">加载中...</p>';

  if (type === 'tag') {
    await renderMasteryByTag(container, subject);
  } else {
    await renderMasteryByType(container, subject);
  }
}

async function renderMasteryByTag(container, subject) {
  const data = await getKnowledgeMastery(subject, 100);
  const entries = Object.entries(data);

  if (entries.length === 0) {
    container.innerHTML = '<p class="mastery-empty">暂无练习数据<br/>开始练习后这里会显示知识掌握曲线</p>';
    return;
  }

  let html = `<p class="mastery-hint" style="font-size:0.8rem;color:#999;margin-bottom:12px">累计正确率趋势（最近100天）</p>`;

  entries.slice(0, 8).forEach(([tag, series], idx) => {
    const color = MASTERY_COLORS[idx % MASTERY_COLORS.length];
    const lastPct = series.length > 0 ? series[series.length - 1].accuracy : 0;
    const level = lastPct >= 80 ? 'high' : lastPct >= 50 ? 'mid' : 'low';
    html += `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:0.85rem">${tag}</span>
          <span style="font-size:0.85rem;font-weight:bold;color:${lastPct>=80?'#4CAF50':lastPct>=50?'#ff9800':'#e53935'}">${lastPct}%</span>
        </div>
        <canvas class="mastery-canvas" data-tag="${tag}" data-series='${JSON.stringify(series)}' data-color="${color}" height="80" style="width:100%;display:block"></canvas>
      </div>
    `;
  });

  container.innerHTML = html;

  // Draw all canvases
  container.querySelectorAll('.mastery-canvas').forEach(canvas => {
    drawLineChart(canvas, JSON.parse(canvas.dataset.series), canvas.dataset.color);
  });
}

function drawLineChart(canvas, series, color) {
  if (!series || series.length === 0) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.offsetWidth * 2;
  const h = canvas.height * 2;
  canvas.width = w;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w / dpr + 'px';
  canvas.style.height = h / dpr + 'px';
  ctx.scale(dpr, dpr);

  const W = w / dpr;
  const H = h / dpr;
  const padL = 5, padR = 5, padT = 5, padB = 5;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  ctx.clearRect(0, 0, W, H);

  if (series.length === 1) {
    // Draw single dot
    const x = padL + chartW / 2;
    const y = padT + chartH * (1 - series[0].accuracy / 100);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    return;
  }

  // Grid lines
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 0.5;
  [0, 25, 50, 75, 100].forEach(pct => {
    const y = padT + chartH * (1 - pct / 100);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();
  });

  // Polyline
  const points = series.map((d, i) => ({
    x: padL + (i / (series.length - 1)) * chartW,
    y: padT + chartH * (1 - d.accuracy / 100)
  }));

  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Fill
  ctx.lineTo(points[points.length - 1].x, padT + chartH);
  ctx.lineTo(padL, padT + chartH);
  ctx.closePath();
  ctx.fillStyle = color + '22';
  ctx.fill();

  // Dots
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

async function renderMasteryByType(container, subject) {
  const kp = await getKnowledgeMastery(subject, 100);
  // Aggregate by question type from wrong list
  const wrongList = await getWrongQuestions();
  const progress = await getProgress();

  // Count question types from the question bank
  const questions = await getQuestionsBySubject(subject);
  const typeStats = {};
  for (const q of questions) {
    if (!typeStats[q.type]) typeStats[q.type] = { total: 0, correct: 0 };
  }

  // Update from progress records
  for (const [qid, record] of Object.entries(progress)) {
    const q = questions.find(x => x.id === qid);
    if (q) {
      if (!typeStats[q.type]) typeStats[q.type] = { total: 0, correct: 0 };
      typeStats[q.type].total++;
      if (record.isCorrect) typeStats[q.type].correct++;
    }
  }

  const typeNames = { choice: '选择题', fill: '填空题', short_answer: '简答题', reading: '阅读理解', dictation: '听写', expression: '表达题' };

  const entries = Object.entries(typeStats).filter(([, v]) => v.total > 0);
  if (entries.length === 0) {
    container.innerHTML = '<p class="mastery-empty">暂无练习数据</p>';
    return;
  }

  let html = '<div class="type-stat-grid">';
  entries.forEach(([type, stats]) => {
    const pct = Math.round((stats.correct / stats.total) * 100);
    const level = pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low';
    html += `
      <div class="type-stat-card ${level}">
        <div class="type-name">${typeNames[type] || type}</div>
        <div class="type-pct">${pct}%</div>
        <div class="type-total">${stats.total}题 / ${stats.correct}正确</div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ==================== Settings View ====================

async function loadSettingsView() {
  const container = document.getElementById('settings-content');
  if (!container) return;

  const settings = await getSettings();
  container.innerHTML = `
    <div class="settings-group">
      <div class="settings-row">
        <div>
          <div class="settings-label">每日目标</div>
          <div class="settings-desc">每日练习题目数量</div>
        </div>
        <div class="goal-stepper">
          <button class="stepper-btn" id="goal-minus">−</button>
          <span class="goal-value" id="goal-value">${settings.dailyGoal}</span>
          <button class="stepper-btn" id="goal-plus">+</button>
        </div>
      </div>
    </div>
    <div class="settings-group">
      <div class="settings-row">
        <div>
          <div class="settings-label">难度筛选</div>
          <div class="settings-desc">练习时只出指定难度题目</div>
        </div>
        <div class="difficulty-filter" id="diff-filter">
          <button class="diff-pill ${settings.difficultyFilter===null?'active':''}" data-diff="">全部</button>
          <button class="diff-pill ${settings.difficultyFilter===1?'active':''}" data-diff="1">简单</button>
          <button class="diff-pill ${settings.difficultyFilter===2?'active':''}" data-diff="2">中等</button>
          <button class="diff-pill ${settings.difficultyFilter===3?'active':''}" data-diff="3">困难</button>
        </div>
      </div>
    </div>
    <div class="settings-group">
      <button class="danger-btn" id="clear-all-btn">清除所有数据</button>
    </div>
  `;

  // Bind events
  document.getElementById('goal-minus').addEventListener('click', async () => {
    const settings = await getSettings();
    if (settings.dailyGoal > 1) {
      await saveSetting('dailyGoal', settings.dailyGoal - 1);
      document.getElementById('goal-value').textContent = settings.dailyGoal - 1;
      refreshUI();
    }
  });

  document.getElementById('goal-plus').addEventListener('click', async () => {
    const settings = await getSettings();
    if (settings.dailyGoal < 50) {
      await saveSetting('dailyGoal', settings.dailyGoal + 1);
      document.getElementById('goal-value').textContent = settings.dailyGoal + 1;
      refreshUI();
    }
  });

  document.querySelectorAll('#diff-filter .diff-pill').forEach(btn => {
    btn.addEventListener('click', async () => {
      const diff = btn.dataset.diff === '' ? null : parseInt(btn.dataset.diff);
      await saveSetting('difficultyFilter', diff);
      document.querySelectorAll('#diff-filter .diff-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('clear-all-btn').addEventListener('click', async () => {
    if (confirm('确定清除所有数据？包括打卡记录、错题、进度等，此操作不可恢复。')) {
      await clearAllData();
      showToast('数据已清除');
      refreshUI();
    }
  });
}

// ==================== PWA Install Banner ====================

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  setTimeout(() => {
    const banner = document.getElementById('pwa-install-banner');
    if (banner && localStorage.getItem('pwa-banner-dismissed') !== '1') {
      banner.style.display = 'flex';
    }
  }, 3000);
});

function dismissPwaBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem('pwa-banner-dismissed', '1');
}

async function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  dismissPwaBanner();
}

// Load progress view
async function loadProgressView() {
  const container = document.getElementById('history-container');
  if (!container) return;

  const history = await getCheckinHistoryList();

  if (history.length === 0) {
    container.innerHTML = '<p class="placeholder">暂无打卡记录</p>';
    return;
  }

  let html = '';
  history.slice(0, 10).forEach(item => {
    const date = new Date(item.date);
    const dateStr = `${date.getMonth() + 1}月${date.getDate()}日 ${date.getFullYear()}`;
    html += `
      <div class="checkin-item">
        <span>${dateStr}</span>
        <span style="color: #4CAF50;">✓ 已打卡</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Load wrong questions view
async function loadWrongView() {
  const container = document.getElementById('wrong-container');
  if (!container) return;

  const wrongList = await getWrongQuestions();

  if (wrongList.length === 0) {
    container.innerHTML = '<p class="placeholder">太棒了！暂无错题</p>';
    return;
  }

  let html = `<p class="wrong-summary">共 ${wrongList.length} 道错题（点击题目开始复习）</p>`;
  wrongList.forEach((item, idx) => {
    const q = item.question;
    html += `
      <div class="wrong-item" data-index="${idx}">
        <div class="wrong-question clickable" data-index="${idx}">
          <span class="subject-tag">${getSubjectName(q.subject)}</span>
          <p>${q.question}</p>
        </div>
        <div class="wrong-meta">
          <span class="wrong-date">${new Date(item.timestamp).toLocaleDateString('zh-CN')}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Bind click to start review
  container.querySelectorAll('.wrong-question.clickable').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      showWrongReview(idx);
    });
  });
}

// Show review interface for a specific wrong question
let currentWrongIdx = null;

async function showWrongReview(idx) {
  const container = document.getElementById('wrong-container');
  const wrongList = await getWrongQuestions();
  if (idx < 0 || idx >= wrongList.length) return;

  currentWrongIdx = idx;
  const item = wrongList[idx];
  const q = item.question;

  let html = `
    <div class="review-back"><button class="back-btn" id="review-back-btn">← 返回错题集</button></div>
    <div class="question">
      <span class="subject-tag">${getSubjectName(q.subject)}</span>
      <p class="question-text">${q.question}</p>
    </div>
  `;

  if (q.type === 'choice' && q.options) {
    html += '<div class="options">';
    q.options.forEach((opt, i) => {
      html += `<button class="option-btn" data-index="${i}">${opt}</button>`;
    });
    html += '</div>';
  }

  html += `
    <div class="wrong-answer-review" style="display:none;">
      <p class="your-wrong">你的答案: <span class="red">${item.userAnswer}</span></p>
      <p class="correct-wrong">正确答案: <span class="green">${q.answer}</span></p>
      ${q.explanation ? `<p class="explanation">解析: ${q.explanation}</p>` : ''}
    </div>
  `;

  container.innerHTML = html;
  document.getElementById('review-back-btn').addEventListener('click', loadWrongView);

  // Bind option events
  container.querySelectorAll('.option-btn').forEach(optBtn => {
    optBtn.addEventListener('click', async () => {
      const selectedIndex = parseInt(optBtn.dataset.index);
      const isCorrect = q.answer === q.options[selectedIndex];

      container.querySelectorAll('.option-btn').forEach(b => {
        b.disabled = true;
        if (q.options.indexOf(q.answer) === parseInt(b.dataset.index)) {
          b.classList.add('correct');
        } else if (parseInt(b.dataset.index) === selectedIndex && !isCorrect) {
          b.classList.add('wrong');
        }
      });

      const answerReview = container.querySelector('.wrong-answer-review');
      if (answerReview) answerReview.style.display = 'block';

      if (isCorrect) {
        await removeWrongQuestion(q.id);
        const nextBtn = document.createElement('button');
        nextBtn.className = 'primary-btn';
        nextBtn.style.marginTop = '15px';
        nextBtn.textContent = '已掌握！返回错题集';
        nextBtn.onclick = () => loadWrongView();
        container.appendChild(nextBtn);
      }
    });
  });
}

function getSubjectName(subject) {
  const names = { math: '数学', english: '英语', chinese: '语文', science: '科学', history: '历史', geography: '地理', politics: '道法' };
  return names[subject] || subject;
}

// Helper functions
function getQuestionTypeName(type) {
  const types = {
    choice: '选择题',
    fill: '填空题',
    reading: '阅读理解',
    dictation: '听力/默写',
    expression: '表达题'
  };
  return types[type] || type;
}

function getDifficultyName(difficulty) {
  const levels = { 1: '简单', 2: '中等', 3: '困难' };
  return levels[difficulty] || '未知';
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
