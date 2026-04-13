// App Module
// Main entry point for 百日闯 PWA

import { checkin, getCheckinStreak, getCheckinHistoryList } from './checkin.js';
import { initializeQuestionBank, loadQuestions, getQuestionsBySubject, saveProgress, addWrongQuestion, getWrongQuestions, removeWrongQuestion, clearWrongQuestions } from './question_bank.js';

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
        alert(`打卡成功！已连续打卡 ${result.streak} 天`);
      } else {
        alert(result.message);
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
}

// Start a new practice session
async function startPracticeSession(subject) {
  const questions = await getQuestionsBySubject(subject);
  if (questions.length === 0) return;

  // Shuffle and pick up to 10
  const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, 10);
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
  }

  container.innerHTML = html;

  // Bind option click
  container.querySelectorAll('.option-btn').forEach(optBtn => {
    optBtn.addEventListener('click', () => handleAnswer(optBtn, q));
  });
}

// Handle answer selection
async function handleAnswer(optBtn, q) {
  const selectedIndex = parseInt(optBtn.dataset.index);
  const isCorrect = q.answer === q.options[selectedIndex];

  await saveProgress(q.id, q.options[selectedIndex], isCorrect);

  if (!isCorrect) {
    await addWrongQuestion(q, q.options[selectedIndex]);
    sessionScore.wrong++;
  } else {
    sessionScore.correct++;
  }

  // Show correct/wrong feedback
  const container = document.getElementById('question-container');
  container.querySelectorAll('.option-btn').forEach(b => {
    b.disabled = true;
    const idx = parseInt(b.dataset.index);
    if (idx === q.options.indexOf(q.answer)) b.classList.add('correct');
    else if (idx === selectedIndex && !isCorrect) b.classList.add('wrong');
  });

  // Show next button
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
