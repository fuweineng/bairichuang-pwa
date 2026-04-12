// App Module
// Main entry point for 百日闯 PWA

import { checkin, getCheckinStreak, getCheckinHistoryList } from './checkin.js';
import { initializeQuestionBank, loadQuestions, getQuestionsBySubject, saveProgress } from './question_bank.js';

// State
let currentView = 'index';
let currentSubject = null;

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
      currentSubject = subject;
      
      document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      await loadPracticeQuestions(subject);
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

// Load practice questions for a subject
async function loadPracticeQuestions(subject) {
  const container = document.getElementById('question-container');
  if (!container) return;

  container.innerHTML = '<p class="placeholder">加载中...</p>';

  try {
    const questions = await getQuestionsBySubject(subject);
    if (questions.length === 0) {
      container.innerHTML = '<p class="placeholder">暂无题目</p>';
      return;
    }

    // Show first question as demo
    const q = questions[0];
    let html = `
      <div class="question">
        <p class="question-type">${getQuestionTypeName(q.type)} - ${getDifficultyName(q.difficulty)}</p>
        <p class="question-text">${q.question}</p>
    `;

    if (q.type === 'choice' && q.options) {
      html += '<div class="options">';
      q.options.forEach((opt, i) => {
        html += `<button class="option-btn" data-index="${i}">${opt}</button>`;
      });
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // Bind option events
    container.querySelectorAll('.option-btn').forEach(optBtn => {
      optBtn.addEventListener('click', async () => {
        const selectedIndex = parseInt(optBtn.dataset.index);
        const isCorrect = q.answer === q.options[selectedIndex];
        await saveProgress(q.id, q.options[selectedIndex], isCorrect);
        
        container.querySelectorAll('.option-btn').forEach(b => {
          b.disabled = true;
          if (q.options.indexOf(q.answer) === parseInt(b.dataset.index)) {
            b.classList.add('correct');
          } else if (parseInt(b.dataset.index) === selectedIndex && !isCorrect) {
            b.classList.add('wrong');
          }
        });
      });
    });

  } catch (e) {
    container.innerHTML = '<p class="placeholder">加载失败</p>';
    console.error(e);
  }
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
