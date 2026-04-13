// App Module
// Main entry point for 百日闯 PWA

import { checkin, getCheckinStreak, getCheckinHistoryList, getCheckinMeta, recordDailySession, getDailyRecord, getRecentDailyRecords, getTotalScore } from './checkin.js';
import { initializeQuestionBank, loadQuestions, getQuestionsBySubject, saveProgress, getProgress, addWrongQuestion, getWrongQuestions, removeWrongQuestion, clearWrongQuestions, recordKnowledgeTag, getKnowledgeMastery, getSettings, saveSetting, clearAllData, sendFeedback, getPendingFeedbacks, approveFeedback, rejectFeedback, getFeedbackStats } from './question_bank.js';

// State
let currentView = 'index';
let currentSubject = null;

// Practice session state
let sessionQuestions = [];
let sessionIndex = 0;
let sessionScore = { correct: 0, wrong: 0 };
let sessionSubject = null;
let practiceEntry = 'new'; // 'new' | 'weak' | 'mastered'
window.practiceEntry = 'new'; // expose for HTML event delegation
let _sessionStartQuestions = 0; // questions answered before this session
let _sessionStartCorrect = 0;     // correct answers before this session
let _sessionTotalQuestions = 0;   // total questions answered today before this session

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
  window.navigate = navigate;
  window.nav = navigate; // alias
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
  // Expose startSubject for HTML onclick (must be before any routing)
  window._startSubject = function(subject) {
    startPracticeSession(subject);
  };

  // Mastery subject tabs
  document.querySelectorAll('.mastery-subject-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mastery-subject-tabs .tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      loadMasteryView(btn.dataset.subject, currentMasteryType);
    });
  });

  // Mastery type tabs
  document.querySelectorAll('.mastery-type-tabs .type-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mastery-type-tabs .type-tab').forEach(b => b.classList.toggle('active', b === btn));
      loadMasteryView(currentMasterySubject, btn.dataset.type);
    });
  });

  // PWA install button
  const pwaBtn = document.getElementById('pwa-install-btn');
  if (pwaBtn) pwaBtn.addEventListener('click', installPWA);

  // Feedback button
  const feedbackBtn = document.getElementById('feedback-btn');
  if (feedbackBtn) {
    feedbackBtn.addEventListener('click', () => {
      document.getElementById('feedback-modal').style.display = 'flex';
      document.getElementById('feedback-text').value = '';
      document.getElementById('feedback-status').textContent = '';
      document.getElementById('feedback-text').focus();
    });
  }

  // Feedback close
  document.getElementById('feedback-close').addEventListener('click', () => {
    document.getElementById('feedback-modal').style.display = 'none';
  });

  // Feedback submit
  document.getElementById('feedback-submit').addEventListener('click', async () => {
    const text = document.getElementById('feedback-text').value.trim();
    if (!text) {
      document.getElementById('feedback-status').textContent = '请输入内容';
      return;
    }
    const btn = document.getElementById('feedback-submit');
    btn.disabled = true;
    btn.textContent = '提交中...';
    document.getElementById('feedback-status').textContent = '';
    const result = await sendFeedback(text);
    btn.disabled = false;
    btn.textContent = '提交反馈';
    if (result.saved) {
      document.getElementById('feedback-status').style.color = '#4CAF50';
      document.getElementById('feedback-status').textContent = '已提交，等待审批 ✓';
      document.getElementById('feedback-text').value = '';
      setTimeout(() => document.getElementById('feedback-modal').style.display = 'none', 1500);
    } else {
      document.getElementById('feedback-status').textContent = '提交失败，请重试';
    }
  });

  // Checkin modal close
  document.getElementById('checkin-modal-close').addEventListener('click', () => {
    document.getElementById('checkin-modal').style.display = 'none';
  });

  // Header settings button
  document.getElementById('header-settings-btn').addEventListener('click', () => {
    window.location.hash = '#/settings';
  });

  // Expose HTML onclick handlers
  window.startEntry = function(entry) {
    startPracticeSession(entry);
  };
  window.showView = function(view) {
    navigate('#/' + view);
  };
}

// ==================== Entry Card Counts ====================

async function updateEntryCardCounts(settings) {
  const allQuestions = await loadQuestions();
  const progress = await getProgress() || {};
  const masteredThreshold = settings.masteredThreshold ?? 50; // %

  // Classify questions
  const newIds = new Set();
  const weakIds = []; // {id, wrongRate}
  const masteredIds = [];

  for (const q of allQuestions) {
    const rec = progress[q.id];
    if (!rec || (rec.total === 0)) {
      newIds.add(q.id);
    } else {
      const wrongRate = rec.wrong / rec.total * 100;
      if (wrongRate > masteredThreshold) {
        weakIds.push({ id: q.id, wrongRate });
      } else {
        masteredIds.push({ id: q.id, wrongRate });
      }
    }
  }

  // Sort weak by wrong rate desc, mastered by wrong rate asc
  weakIds.sort((a, b) => b.wrongRate - a.wrongRate);
  masteredIds.sort((a, b) => a.wrongRate - b.wrongRate);

  // Update DOM
  const newCount = document.getElementById('entry-new-count');
  const weakCount = document.getElementById('entry-weak-count');
  const masteredCount = document.getElementById('entry-mastered-count');

  if (newCount) {
    newCount.textContent = `${newIds.size}题`;
    newCount.classList.toggle('empty', newIds.size === 0);
  }

  if (weakCount) {
    weakCount.textContent = `${weakIds.length}题`;
    weakCount.classList.toggle('empty', weakIds.length === 0);
  }

  if (masteredCount) {
    masteredCount.textContent = `${masteredIds.length}题`;
    masteredCount.classList.toggle('empty', masteredIds.length === 0);
  }
}

// Refresh UI data
async function refreshUI() {
  const settings = await getSettings();
  const streak = await getCheckinStreak();
  const totalScore = await getTotalScore();

  // Update streak card
  const streakCount = document.getElementById('streak-count');
  const streakSub = document.getElementById('streak-sub');
  if (streakCount) streakCount.textContent = streak;
  if (streakSub) {
    streakSub.textContent = streak === 0 ? '开始你的百日计划' : `已累计 ${totalScore} 分`;
  }

  // Update 3 entry card counts
  await updateEntryCardCounts(settings);
}

// Get today's baseline for score calculation
async function getTodaySessionBaseline() {
  const daily = await getDailyRecord();
  const today = getLocalDateKey();
  const todayRec = daily[today];
  return {
    questionsCount: todayRec ? todayRec.questionsCount : 0,
    correct: todayRec ? todayRec.correct : 0,
  };
}

// Start a new practice session
async function startPracticeSession(subject) {
  // Record baseline before this session for score calculation
  const todayBefore = await getTodaySessionBaseline();
  _sessionStartQuestions = todayBefore.questionsCount;
  _sessionStartCorrect = todayBefore.correct;

  // Auto-checkin when starting practice
  const result = await checkin();
  if (result.success) {
    showToast(`🎉 开始练习！连续${result.streak}天`);
  } else {
    showToast('继续加油！');
  }

  const questions = await getQuestionsBySubject(subject);
  if (questions.length === 0) return;

  const settings = await getSettings();
  const progress = await getProgress() || {};
  const threshold = settings.masteredThreshold ?? 50;
  const difficulty = settings.difficultyFilter ?? null;

  // Build filtered & sorted list by entry type
  let filtered = [];

  if (practiceEntry === 'new') {
    // Never practiced: no progress record, or total=0
    filtered = questions.filter(q => {
      const rec = progress[q.id];
      return !rec || rec.total === 0;
    });
    // Difficulty filter still applies
    if (difficulty) filtered = filtered.filter(q => q.difficulty === difficulty);
  } else if (practiceEntry === 'weak') {
    // Practiced AND wrongRate > threshold
    filtered = questions.filter(q => {
      const rec = progress[q.id];
      if (!rec || rec.total === 0) return false;
      return (rec.wrong / rec.total * 100) > threshold;
    }).map(q => {
      const rec = progress[q.id];
      return { ...q, _wrongRate: rec.wrong / rec.total * 100 };
    });
    if (difficulty) filtered = filtered.filter(q => q.difficulty === difficulty);
    // Sort: highest wrong rate first
    filtered.sort((a, b) => b._wrongRate - a._wrongRate);
  } else if (practiceEntry === 'mastered') {
    // Practiced AND wrongRate <= threshold
    filtered = questions.filter(q => {
      const rec = progress[q.id];
      if (!rec || rec.total === 0) return false;
      return (rec.wrong / rec.total * 100) <= threshold;
    }).map(q => {
      const rec = progress[q.id];
      return { ...q, _wrongRate: rec.wrong / rec.total * 100 };
    });
    if (difficulty) filtered = filtered.filter(q => q.difficulty === difficulty);
    // Sort: lowest wrong rate first (most mastered)
    filtered.sort((a, b) => a._wrongRate - b._wrongRate);
  }

  // Show entry info bar
  const infoBar = document.getElementById('practice-entry-info');
  const infoLabel = document.getElementById('practice-entry-label');
  const infoCount = document.getElementById('practice-entry-count');
  const viewTitle = document.getElementById('practice-view-title');
  if (infoBar) {
    infoBar.style.display = 'flex';
    infoBar.className = 'practice-entry-info ' + practiceEntry;
    if (infoLabel) {
      const labels = { new: '🆕 全新题目', weak: '🔴 易错汇总', mastered: '✅ 熟练掌握' };
      infoLabel.textContent = labels[practiceEntry] || '';
    }
    if (infoCount) infoCount.textContent = `${filtered.length}题可选`;
    const titles = { new: '全新题目', weak: '易错汇总', mastered: '熟练掌握' };
    if (viewTitle) viewTitle.textContent = titles[practiceEntry] || '选择科目';
  }

  // Shuffle and pick up to dailyGoal
  const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, settings.dailyGoal || 10);
  sessionQuestions = shuffled;
  sessionIndex = 0;
  sessionScore = { correct: 0, wrong: 0 };
  sessionSubject = subject;

  // Highlight active subject button
  document.querySelectorAll('.subject-grid-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.subject === subject);
  });

  renderCurrentQuestion();
}

// Render the current question in the session
function renderCurrentQuestion() {
  // Remove previous keyboard listener
  document.removeEventListener('keydown', handleQuestionKey);

  const container = document.getElementById('question-container');
  if (!container || sessionIndex >= sessionQuestions.length) {
    renderSessionResult();
    return;
  }

  // Add keyboard shortcut listener
  document.addEventListener('keydown', handleQuestionKey);

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
    ${q.type === 'choice' ? '<div class="keyboard-hint"><span class="key-hint-item"><span class="key-cap">1-4</span> 选</span><span class="key-hint-item"><span class="key-cap">空格</span> 下一题</span></div>' : ''}
    <div class="question">
      <p class="question-type">${getQuestionTypeName(q.type)} · ${getDifficultyName(q.difficulty)}</p>
      <p class="question-text">${q.question}</p>
      ${q.image ? `<img class="question-image" src="${q.image}" alt="题目配图" loading="lazy" />` : ''}
    </div>
  `;

  if (q.type === 'choice' && q.options) {
    html += '<div class="options">';
    q.options.forEach((opt, i) => {
      html += `<button class="option-btn" data-index="${i}">${opt}</button>`;
    });
    html += '</div>';
  } else if (q.type === 'fill') {
    const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
    const blankCount = answers.length;

    if (blankCount === 1) {
      // Single blank — original layout
      html += `
        <div class="fill-area">
          <div class="fill-input-row">
            <input type="text" class="fill-input" data-blank="0" placeholder="请输入答案..." autocomplete="off" />
            <button class="primary-btn fill-submit-btn">提交</button>
          </div>
        </div>
      `;
    } else {
      // Multi-blank — one input per blank
      const markedQuestion = q.question.replace(/_____/g, () => {
        const idx = q._blankIndex = (q._blankIndex || 0);
        q._blankIndex++;
        return `<span class="blank-marker">[空${idx + 1}]</span>`;
      });
      q._blankIndex = 0; // reset for display

      html += `<p class="question-text fill-multi-text">${markedQuestion}</p>`;
      html += `<div class="fill-blanks-area">`;
      answers.forEach((_, i) => {
        html += `
          <div class="fill-blank-row">
            <label class="fill-blank-label">空${i + 1}</label>
            <input type="text" class="fill-input fill-multi-input" data-blank="${i}" autocomplete="off" />
          </div>
        `;
      });
      html += `</div><div class="fill-multi-submit-row"><button class="primary-btn fill-submit-btn">提交全部</button></div>`;
    }
  } else if (q.type === 'short_answer') {
    // Short answer: textarea input
    html += `
      <textarea class="short-answer-input" placeholder="请输入你的答案..." rows="4" style="width:100%;margin-top:12px;padding:12px;font-size:0.9rem;border:2px solid #ddd;border-radius:10px;resize:none;outline:none;font-family:inherit;box-sizing:border-box;transition:border-color 0.2s" onfocus="this.style.borderColor='#4CAF50'" onblur="this.style.borderColor='#ddd'"></textarea>
      <div class="fill-feedback" style="display:none"></div>
      <button class="primary-btn fill-submit-btn" style="margin-top:10px">提交答案</button>
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
  } else if (q.type === 'short_answer') {
    // Short answer: textarea input
    const submitBtn = container.querySelector('.fill-submit-btn');
    if (submitBtn) submitBtn.addEventListener('click', () => handleShortAnswerSubmit(q));
    const textarea = container.querySelector('.short-answer-input');
    if (textarea) textarea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.ctrlKey) handleShortAnswerSubmit(q);
    });
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
  const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
  const blankCount = answers.length;

  if (blankCount === 1) {
    // Single blank
    const input = container.querySelector('.fill-input[data-blank="0"]');
    if (!input) return;
    const userAnswer = input.value.trim();
    if (!userAnswer) return;

    const isCorrect = userAnswer === answers[0] || userAnswer === answers[0].replace(/[\s　]+/g, '').trim();
    await processAnswer(q, userAnswer, isCorrect, () => {
      input.disabled = true;
      const submitBtn = container.querySelector('.fill-submit-btn');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.style.display = 'none'; }
      const fillArea = container.querySelector('.fill-area');
      if (fillArea) {
        const feedback = document.createElement('div');
        feedback.className = `fill-feedback ${isCorrect ? 'correct' : 'wrong'}`;
        feedback.textContent = isCorrect ? '✓ 正确！' : `✗ 正确答案：${q.answer}`;
        fillArea.appendChild(feedback);
      }
      addNextButton(container, q);
    });
  } else {
    // Multi-blank — check all inputs
    const inputs = container.querySelectorAll('.fill-multi-input');
    const userAnswers = [];
    let allEmpty = true;
    inputs.forEach(input => {
      const val = input.value.trim();
      userAnswers.push(val);
      if (val) allEmpty = false;
    });
    if (allEmpty) return;

    let correctCount = 0;
    userAnswers.forEach((ua, i) => {
      if (ua === answers[i] || ua === answers[i].replace(/[\s　]+/g, '').trim()) {
        correctCount++;
      }
    });
    const allCorrect = correctCount === blankCount;

    await processAnswer(q, userAnswers.join(' | '), allCorrect, () => {
      // Mark each input correct/wrong
      inputs.forEach((input, i) => {
        input.disabled = true;
        const ua = input.value.trim();
        const ac = ua === answers[i] || ua === answers[i].replace(/[\s　]+/g, '').trim();
        input.classList.add(ac ? 'fill-correct-border' : 'fill-wrong-border');
      });

      // Show summary feedback
      const blanksArea = container.querySelector('.fill-blanks-area');
      if (blanksArea) {
        const feedback = document.createElement('div');
        feedback.className = `fill-feedback ${allCorrect ? 'correct' : 'wrong'}`;
        if (allCorrect) {
          feedback.textContent = `✓ 全部正确！`;
        } else {
          const wrongBlanks = userAnswers.map((ua, i) => ua !== answers[i] ? i + 1 : null).filter(x => x).join('、');
          feedback.textContent = `✗ 第 ${wrongBlanks} 空填写错误，正确答案：${answers.join(' | ')}`;
        }
        blanksArea.appendChild(feedback);
      }

      const submitBtn = container.querySelector('.fill-submit-btn');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.style.display = 'none'; }
      addNextButton(container, q);
    });
  }
}

// Short answer submission
async function handleShortAnswerSubmit(q) {
  const container = document.getElementById('question-container');
  const textarea = container.querySelector('.short-answer-input');
  const feedback = container.querySelector('.fill-feedback');
  if (!textarea || !feedback) return;

  const userAnswer = textarea.value.trim();
  if (!userAnswer) return;

  const expected = q.answer.toLowerCase();
  const given = userAnswer.toLowerCase();
  const isCorrect = given.includes(expected) || expected.split(' ').filter(w => w.length > 2).every(w => given.includes(w));

  await processAnswer(q, userAnswer, isCorrect, () => {
    textarea.disabled = true;
    feedback.style.display = 'block';
    feedback.className = `fill-feedback ${isCorrect ? 'correct' : 'wrong'}`;
    if (isCorrect) {
      feedback.textContent = '✓ 回答正确！';
    } else {
      feedback.textContent = `参考：${q.answer}`;
    }
    const submitBtn = container.querySelector('.fill-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.display = 'none'; }
    addNextButton(container, q);
  });
}

// Show next/finish button for non-choice questions
function addNextButton(container, q) {
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

// Keyboard shortcut handler
function handleQuestionKey(e) {
  // Only handle when practice view is active
  if (currentView !== 'practice') return;
  const container = document.getElementById('question-container');
  if (!container) return;

  const q = sessionQuestions[sessionIndex];
  if (!q) return;

  if (q.type === 'choice' && q.options) {
    // 1-4 keys select option
    const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
    if (e.key in keyMap) {
      const idx = keyMap[e.key];
      const btns = container.querySelectorAll('.option-btn');
      if (btns[idx] && !btns[idx].disabled) {
        handleAnswer(btns[idx], q);
      }
      return;
    }
  }

  // Space or ArrowRight -> next (if answered)
  if (e.key === ' ' || e.key === 'ArrowRight') {
    e.preventDefault();
    const nextBtn = container.querySelector('.primary-btn');
    if (nextBtn) nextBtn.click();
  }
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

  // Record this session for daily score
  recordDailySession(sessionQuestions, sessionScore).then(daily => {
    const todayScore = daily ? daily.score : 0;
    // Update today's score display if visible
    const todayScoreEl = document.getElementById('streak-today-score');
    if (todayScoreEl) todayScoreEl.textContent = `今日得分: ${todayScore}`;
    const todayDot = document.getElementById('streak-today-dot');
    if (todayDot) { todayDot.textContent = '●'; todayDot.style.color = '#4CAF50'; }
    // Update 100-day total
    getTotalScore().then(totalScore => {
      const earnedEl = document.getElementById('hundred-days-earned');
      if (earnedEl) earnedEl.textContent = Math.min(totalScore, 100);
    });
  });

  container.innerHTML = `
    <div class="result-box">
      <p class="result-emoji">${emoji}</p>
      <p class="result-summary">${msg}</p>
      <div class="result-stats-row">
        <div class="result-stat">
          <span class="result-stat-num green">${correct}</span>
          <span class="result-stat-label">答对</span>
        </div>
        <div class="result-stat">
          <span class="result-stat-num red">${wrong}</span>
          <span class="result-stat-label">答错</span>
        </div>
        <div class="result-stat">
          <span class="result-stat-num">${pct}%</span>
          <span class="result-stat-label">正确率</span>
        </div>
      </div>
    </div>
    <button class="primary-btn" id="rerun-btn">再练一次</button>
  `;

  // Remove keyboard listener
  document.removeEventListener('keydown', handleQuestionKey);

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
  document.querySelectorAll('.subject-grid-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('question-container').innerHTML = '<p class="placeholder">选择科目开始练习</p>';
}

// Show feedback modal
function showFeedbackModal() {
  const modal = document.getElementById('feedback-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('feedback-text').value = '';
  document.getElementById('feedback-status').textContent = '';
}

// Show checkin success modal
async function showCheckinSuccessModal(streak) {
  const history = await getCheckinHistoryList();
  const total = history.length;

  // Count this week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekCount = history.filter(h => {
    const d = new Date(h.date);
    return d >= weekStart;
  }).length;

  // Update and show the fixed modal in DOM
  document.getElementById('modal-streak').textContent = streak;
  document.getElementById('modal-total').textContent = total;
  document.getElementById('modal-week').textContent = weekCount;
  document.getElementById('checkin-modal').style.display = 'flex';
}

// Show toast message
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 2000);
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

  // Also draw multi-subject comparison chart at top
  await renderMasteryMultiSubject(container, subject);
}

async function renderMasteryMultiSubject(container, subject) {
  const subjects = ['math', 'english', 'chinese', 'science', 'biology', 'history', 'geography', 'politics'];
  const subjectNames = { math: '数学', english: '英语', chinese: '语文', science: '科学', biology: '生物', history: '历史', geography: '地理', politics: '道法' };

  const allSeries = {};
  for (const subj of subjects) {
    const data = await getKnowledgeMastery(subj, 30);
    const dailyMap = {};
    for (const tagData of Object.values(data)) {
      for (const d of tagData) {
        if (!dailyMap[d.date]) dailyMap[d.date] = { total: 0, correct: 0 };
        dailyMap[d.date].total += d.total;
        dailyMap[d.date].correct += d.correct;
      }
    }
    const days = Object.keys(dailyMap).sort().slice(-14);
    const series = days.map(date => ({
      date,
      accuracy: dailyMap[date].total > 0
        ? Math.round((dailyMap[date].correct / dailyMap[date].total) * 100)
        : null
    }));
    if (series.length > 0) allSeries[subj] = series;
  }

  const activeSubjects = subjects.filter(s => allSeries[s]);
  if (activeSubjects.length < 2) return; // need at least 2 subjects for comparison

  // Create multi-subject canvas
  const multiDiv = document.createElement('div');
  multiDiv.style.marginBottom = '20px';
  multiDiv.innerHTML = `
    <p style="font-size:0.8rem;color:#999;margin-bottom:10px">各科对比（近14天）</p>
    <canvas id="multi-subject-canvas" height="140" style="width:100%;display:block"></canvas>
  `;
  container.insertBefore(multiDiv, container.firstChild);

  const canvas = document.getElementById('multi-subject-canvas');
  drawMultiSubjectChart(canvas, allSeries, subjects, subjectNames);
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

// ==================== 100-Day Progress Card ====================

async function renderHundredDayCard() {
  const records = await getRecentDailyRecords(14);
  const today = new Date().toISOString().split('T')[0];
  const todayRec = records[records.length - 1];
  const totalScore = await getTotalScore();
  const streak = await getCheckinStreak();

  // Streak card
  const streakEl = document.getElementById('streak-count');
  const streakSubEl = document.getElementById('streak-sub');
  const todayScoreEl = document.getElementById('streak-today-score');
  const todayDotEl = document.getElementById('streak-today-dot');
  if (streakEl) streakEl.textContent = streak;
  if (streakSubEl) {
    if (streak === 0) {
      streakSubEl.textContent = '开始你的百日计划';
    } else {
      streakSubEl.textContent = '已累计 ' + totalScore + ' 分';
    }
  }
  if (todayScoreEl) {
    todayScoreEl.textContent = todayRec.score > 0 ? `今日得分: ${todayRec.score}` : '今日还未开始';
  }
  if (todayDotEl) {
    todayDotEl.textContent = todayRec.score > 0 ? '●' : '○';
    todayDotEl.style.color = todayRec.score > 0 ? '#4CAF50' : '#ccc';
  }

  // 100-day progress bar
  const earnedEl = document.getElementById('hundred-days-earned');
  const barFill = document.getElementById('hundred-bar-fill');
  const dotsContainer = document.getElementById('hundred-day-dots');
  if (earnedEl) earnedEl.textContent = Math.min(totalScore, 100);
  if (barFill) barFill.style.width = Math.min(totalScore, 100) + '%';

  // Draw sparkline
  const canvas = document.getElementById('sparkline-canvas');
  if (canvas) drawSparkline(canvas, records);

  // 100-day dots: show last 30 days of scores (green if >0)
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    const allDaily = await getDailyRecord();
    const dates = Object.keys(allDaily).sort().slice(-30);
    dates.forEach(d => {
      const dot = document.createElement('div');
      dot.className = 'hundred-dot' + (allDaily[d].score > 0 ? ' scored' : '');
      dotsContainer.appendChild(dot);
    });
  }
}

function drawSparkline(canvas, records) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = 110 * dpr;
  const H = 44 * dpr;
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = '110px';
  canvas.style.height = '44px';
  ctx.clearRect(0, 0, 110, 44);

  const scores = records.map(r => r.score);
  const max = Math.max(...scores, 1);
  const min = 0;
  const padL = 2, padR = 2, padT = 4, padB = 4;
  const chartW = 110 - padL - padR;
  const chartH = 44 - padT - padB;

  // Grid lines (subtle)
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 2; i++) {
    const y = padT + (chartH / 2) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();
  }

  // Draw line
  const stepX = chartW / Math.max(scores.length - 1, 1);
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  scores.forEach((s, i) => {
    const x = padL + i * stepX;
    const y = padT + chartH - ((s - min) / (max - min)) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw fill under line
  ctx.lineTo(padL + (scores.length - 1) * stepX, padT + chartH);
  ctx.lineTo(padL, padT + chartH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, 'rgba(76,175,80,0.15)');
  grad.addColorStop(1, 'rgba(76,175,80,0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw dots
  scores.forEach((s, i) => {
    const x = padL + i * stepX;
    const y = padT + chartH - ((s - min) / (max - min)) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = s > 0 ? '#4CAF50' : '#ddd';
    ctx.fill();
  });
}

// ==================== Home Mastery Chart (Multi-Subject) ====================

async function renderHomeMasteryChart() {
  const canvas = document.getElementById('home-mastery-canvas');
  if (!canvas) return;

  const subjects = ['math', 'english', 'chinese', 'science', 'biology', 'history', 'geography', 'politics'];
  const subjectNames = { math: '数学', english: '英语', chinese: '语文', science: '科学', biology: '生物', history: '历史', geography: '地理', politics: '道法' };

  // Collect series data per subject for last 7 days
  const allSeries = {};
  for (const subj of subjects) {
    const data = await getKnowledgeMastery(subj, 7);
    // data is { tag: [{ date, total, correct, accuracy }] }
    // Aggregate into per-day series
    const dailyMap = {};
    for (const tagData of Object.values(data)) {
      for (const d of tagData) {
        if (!dailyMap[d.date]) dailyMap[d.date] = { total: 0, correct: 0 };
        dailyMap[d.date].total += d.total;
        dailyMap[d.date].correct += d.correct;
      }
    }
    const days = Object.keys(dailyMap).sort().slice(-7);
    const series = days.map(date => ({
      date,
      accuracy: dailyMap[date].total > 0
        ? Math.round((dailyMap[date].correct / dailyMap[date].total) * 100)
        : null
    }));
    if (series.length > 0) allSeries[subj] = series;
  }

  const hasData = Object.keys(allSeries).length > 0;

  // Draw chart
  drawMultiSubjectChart(canvas, allSeries, subjects, subjectNames);

  // Render legend
  const legendContainer = document.createElement('div');
  legendContainer.className = 'home-chart-legend';
  let legendIdx = 0;
  for (const subj of subjects) {
    if (!allSeries[subj]) continue;
    const color = MASTERY_COLORS[legendIdx % MASTERY_COLORS.length];
    const last = allSeries[subj][allSeries[subj].length - 1];
    const item = document.createElement('div');
    item.className = 'home-legend-item';
    item.innerHTML = `<span class="home-legend-dot" style="background:${color}"></span>${subjectNames[subj]} ${last ? last.accuracy + '%' : '--'}`;
    legendContainer.appendChild(item);
    legendIdx++;
  }
  // Remove old legend if any
  const oldLegend = canvas.parentElement.querySelector('.home-chart-legend');
  if (oldLegend) oldLegend.remove();
  canvas.parentElement.appendChild(legendContainer);

  // Show hint
  const hint = document.getElementById('home-chart-hint');
  if (hint) hint.textContent = hasData ? '近7日综合正确率' : '开始练习后显示趋势';
}

function drawMultiSubjectChart(canvas, allSeries, subjects, subjectNames) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size
  const containerW = canvas.offsetWidth || 320;
  const W = containerW * 2;
  const H = 120 * 2;
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = containerW + 'px';
  canvas.style.height = '120px';
  ctx.scale(dpr, dpr);

  const padL = 8, padR = 8, padT = 8, padB = 8;
  const chartW = containerW - padL - padR;
  const chartH = 120 - padT - padB;

  ctx.clearRect(0, 0, containerW, 120);

  // Collect all dates across subjects
  const allDates = [];
  for (const subj of subjects) {
    if (allSeries[subj]) {
      for (const d of allSeries[subj]) {
        if (!allDates.includes(d.date)) allDates.push(d.date);
      }
    }
  }
  allDates.sort();
  const last7 = allDates.slice(-7);

  if (last7.length === 0) {
    // Draw empty state
    ctx.fillStyle = '#ccc';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无数据', containerW / 2, 60);
    return;
  }

  // Draw grid lines
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 0.5;
  [0, 50, 100].forEach(pct => {
    const y = padT + chartH * (1 - pct / 100);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();
  });

  // Draw each subject's line
  let colorIdx = 0;
  for (const subj of subjects) {
    const series = allSeries[subj];
    if (!series || series.length === 0) continue;

    const color = MASTERY_COLORS[colorIdx % MASTERY_COLORS.length];
    colorIdx++;

    // Map series to last7 dates
    const points = last7.map(date => {
      const entry = series.find(d => d.date === date);
      return {
        x: padL + (last7.indexOf(date) / Math.max(last7.length - 1, 1)) * chartW,
        y: entry && entry.accuracy !== null
          ? padT + chartH * (1 - entry.accuracy / 100)
          : null
      };
    });

    // Draw line segments where both points exist
    ctx.beginPath();
    let started = false;
    for (const p of points) {
      if (p.y !== null) {
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw dots
    for (const p of points) {
      if (p.y !== null) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }

  // Draw X-axis date labels (max 5)
  const labelCount = Math.min(last7.length, 5);
  ctx.fillStyle = '#aaa';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.floor((i / (labelCount - 1)) * (last7.length - 1));
    const date = last7[idx];
    const x = padL + (idx / Math.max(last7.length - 1, 1)) * chartW;
    const monthDay = date.slice(5); // MM-DD
    ctx.fillText(monthDay, x, padT + chartH + 12);
  }
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

async function loadProfileStats() {
  const progress = await getProgress() || {};
  const total = Object.keys(progress).length;
  let correct = 0;
  let best = 0;
  for (const entry of Object.values(progress)) {
    if (entry.isCorrect) correct++;
  }
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const totalEl = document.getElementById('profile-total');
  const accuracyEl = document.getElementById('profile-accuracy');
  const bestEl = document.getElementById('profile-best');
  if (totalEl) totalEl.textContent = total;
  if (accuracyEl) accuracyEl.textContent = total > 0 ? accuracy + '%' : '--%';
  if (bestEl) bestEl.textContent = total > 0 ? accuracy + '%' : '--%';
}

async function loadSettingsView() {
  const container = document.getElementById('settings-content');
  if (!container) return;

  const settings = await getSettings();
  container.innerHTML = `
    <div class="settings-card">
      <div class="settings-row">
        <span class="settings-label">每日目标</span>
        <div class="settings-stepper">
          <button class="stepper-btn" id="goal-minus">−</button>
          <span class="stepper-val" id="goal-value">${settings.dailyGoal}</span>
          <button class="stepper-btn" id="goal-plus">+</button>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-label">易错阈值</span>
        <div class="settings-stepper">
          <button class="stepper-btn" id="thresh-minus">−</button>
          <span class="stepper-val" id="thresh-value">${settings.masteredThreshold ?? 50}%</span>
          <button class="stepper-btn" id="thresh-plus">+</button>
        </div>
      </div>
      <div class="settings-hint">正确率低于此值的题目进入"易错汇总"</div>
    </div>
    <div class="settings-card">
      <div class="settings-row" style="align-items:center">
        <span class="settings-label">我的昵称</span>
        <input type="text" id="profile-name-input" class="profile-name-input" value="${settings.profileName || ''}" placeholder="设置昵称" maxlength="20" />
      </div>
      <div class="profile-stats-row">
        <div class="profile-stat">
          <span class="profile-stat-num" id="profile-total">0</span>
          <span class="profile-stat-label">累计答题</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-num" id="profile-accuracy">--%</span>
          <span class="profile-stat-label">总正确率</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-num" id="profile-best">--%</span>
          <span class="profile-stat-label">最佳记录</span>
        </div>
      </div>
    </div>
    <button class="settings-action-btn" id="feedback-btn">💬 意见反馈</button>
    <button class="settings-danger-btn" id="clear-all-btn">清除所有数据</button>
    <div class="settings-version">百日闯 v159</div>
  `;

  // Bind events
  document.getElementById('goal-minus').addEventListener('click', async () => {
    const s = await getSettings();
    if (s.dailyGoal > 1) {
      await saveSetting('dailyGoal', s.dailyGoal - 1);
      document.getElementById('goal-value').textContent = s.dailyGoal - 1;
      refreshUI();
    }
  });

  document.getElementById('goal-plus').addEventListener('click', async () => {
    const s = await getSettings();
    if (s.dailyGoal < 50) {
      await saveSetting('dailyGoal', s.dailyGoal + 1);
      document.getElementById('goal-value').textContent = s.dailyGoal + 1;
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

  // Mastered threshold stepper
  document.getElementById('thresh-minus').addEventListener('click', async () => {
    const s = await getSettings();
    const val = s.masteredThreshold ?? 50;
    if (val > 10) {
      await saveSetting('masteredThreshold', val - 5);
      document.getElementById('thresh-value').textContent = (val - 5) + '%';
      refreshUI();
    }
  });

  document.getElementById('thresh-plus').addEventListener('click', async () => {
    const s = await getSettings();
    const val = s.masteredThreshold ?? 50;
    if (val < 90) {
      await saveSetting('masteredThreshold', val + 5);
      document.getElementById('thresh-value').textContent = (val + 5) + '%';
      refreshUI();
    }
  });

  document.getElementById('clear-all-btn').addEventListener('click', async () => {
    if (confirm('确定清除所有数据？此操作不可恢复。')) {
      await clearAllData();
      showToast('数据已清除');
      refreshUI();
    }
  });

  // Profile name save on blur
  const nameInput = document.getElementById('profile-name-input');
  if (nameInput) {
    nameInput.addEventListener('blur', async () => {
      await saveSetting('profileName', nameInput.value.trim());
    });
  }

  // Load profile stats
  loadProfileStats();

  // Feedback button
  document.getElementById('feedback-btn').addEventListener('click', showFeedbackModal);
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

// Load progress view with bar chart
async function loadProgressView() {
  const container = document.getElementById('history-container');
  if (!container) return;

  const history = await getCheckinHistoryList();
  const meta = await getCheckinMeta();
  const checkinDates = new Set(Object.keys(history));

  // Load practice progress and group by date
  const progress = await getProgress() || {};
  const dailyCounts = {};
  for (const entry of Object.values(progress)) {
    if (entry.timestamp) {
      const d = new Date(entry.timestamp).toISOString().split('T')[0];
      dailyCounts[d] = (dailyCounts[d] || 0) + 1;
    }
  }

  // Build last 14 days
  const days = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    const checked = checkinDates.has(dateStr);
    const count = dailyCounts[dateStr] || 0;
    days.push({ date: dateStr, label: dayLabel, checked, count, isToday: i === 0 });
  }

  const totalCheckins = Object.keys(history).length;
  const streak = await getCheckinStreak();

  container.innerHTML = `
    <div class="progress-summary-row">
      <div class="progress-stat">
        <span class="progress-stat-num">${streak}</span>
        <span class="progress-stat-label">连续打卡</span>
      </div>
      <div class="progress-stat">
        <span class="progress-stat-num">${totalCheckins}</span>
        <span class="progress-stat-label">累计打卡</span>
      </div>
      <div class="progress-stat">
        <span class="progress-stat-num">${days.filter(d => d.count > 0).length}</span>
        <span class="progress-stat-label">练习日</span>
      </div>
    </div>
    <div class="chart-label">每日答题量（近14天）</div>
    <canvas id="progress-bar-canvas"></canvas>
    <div class="chart-legend">
      <span class="legend-item"><span class="legend-dot checked"></span>已打卡</span>
      <span class="legend-item"><span class="legend-dot practiced"></span>有练习</span>
    </div>
  `;

  // Draw bar chart
  const canvas = document.getElementById('progress-bar-canvas');
  if (canvas) drawProgressBarChart(canvas, days);
}

function drawProgressBarChart(canvas, days) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const containerW = canvas.offsetWidth || 320;
  const W = containerW * 2;
  const H = 140 * 2;
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = containerW + 'px';
  canvas.style.height = '140px';
  ctx.scale(dpr, dpr);

  const padL = 8, padR = 8, padT = 12, padB = 28;
  const chartW = containerW - padL - padR;
  const chartH = 140 - padT - padB;

  ctx.clearRect(0, 0, containerW, 140);

  const maxCount = Math.max(...days.map(d => d.count), 5);
  const barW = Math.min(16, (chartW / days.length) - 4);
  const gap = (chartW - barW * days.length) / (days.length + 1);

  days.forEach((d, i) => {
    const x = padL + gap + i * (barW + gap);
    const barH = d.count > 0 ? (d.count / maxCount) * chartH : 4;
    const y = padT + chartH - barH;

    // Color: green if checked, orange if practiced but not checked, gray if none
    if (d.checked) {
      ctx.fillStyle = '#4CAF50';
    } else if (d.count > 0) {
      ctx.fillStyle = '#FF9800';
    } else {
      ctx.fillStyle = '#e0e0e0';
    }

    // Rounded top
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
    ctx.fill();

    // Day label below
    ctx.fillStyle = d.isToday ? '#4CAF50' : '#aaa';
    ctx.font = `${9 * dpr}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x + barW / 2, padT + chartH + 14);

    // Count above bar if > 0
    if (d.count > 0) {
      ctx.fillStyle = '#666';
      ctx.font = `bold ${9 * dpr}px sans-serif`;
      ctx.fillText(d.count, x + barW / 2, y - 3);
    }
  });
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
  const names = { math: '数学', english: '英语', chinese: '语文', science: '科学', biology: '生物', history: '历史', geography: '地理', politics: '道法' };
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
