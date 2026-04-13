// 百日闯 PWA — 重构版
// Single-file, no module, no import

'use strict';

// ============================================================
// STATE
// ============================================================
const state = {
  // Routing
  view: 'home',
  subject: null,
  entry: null,
  ttsUtterance: null,

  // Practice session
  sessionQuestions: [],
  sessionIndex: 0,
  sessionScore: { correct: 0, wrong: 0 },
  sessionStartTime: null,
  sessionStartQCount: 0,
  sessionStartCorrect: 0,

  // Persistent data (in-memory cache, synced to IndexedDB)
  questionBank: {},
  progress: {},
  daily: {},
  meta: {},
  settings: { weakThreshold: 0.6, lastQuestionBankUpdate: null },
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

// ============================================================
// INIT
// ============================================================
async function init() {
  console.log('百日闯 PWA 初始化中...');

  // Load persisted state
  state.progress = await get(K.PROGRESS) || {};
  state.daily    = await get(K.DAILY)    || {};
  state.meta     = await get(K.META)     || {};
  state.settings  = await get(K.SETTINGS) || { weakThreshold: 0.6, lastQuestionBankUpdate: null };

  // Load question bank: cache first, fallback to per-subject JS files via dynamic import
  const cached = await get(K.QB_CACHE);
  if (cached) {
    state.questionBank = cached;
  } else {
    // Parallel import of all subject files
    const [math, english, chinese, science, biology, history, geography, politics] = await Promise.all([
      import('./questions/math.js'),
      import('./questions/english.js'),
      import('./questions/chinese.js'),
      import('./questions/science.js'),
      import('./questions/biology.js'),
      import('./questions/history.js'),
      import('./questions/geography.js'),
      import('./questions/politics.js'),
    ]);
    state.questionBank = {
      math:      math.default || [],
      english:   english.default || [],
      chinese:   chinese.default || [],
      science:   science.default || [],
      biology:   biology.default || [],
      history:   history.default || [],
      geography: geography.default || [],
      politics:  politics.default || [],
    };
  }

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

  console.log('百日闯 PWA 初始化完成');
}

// ============================================================
// ROUTER
// ============================================================
function router() {
  const hash = location.hash || '#/home';
  const [path, query] = hash.slice(2).split('?');
  const segs = path.split('/');
  const view = segs[0] || 'home';

  // Parse entry from query ?entry=new
  const entryParam = query ? new URLSearchParams(query).get('entry') : null;

  state.view    = view;
  state.subject = segs[1] || null;
  // entry: if view is 'practice' with entry in query, use that; otherwise derive from subject
  state.entry = entryParam || (view === 'practice' ? getEntryFromSubject(state.subject) : null);

  renderAll();
}

function getEntryFromSubject(subject) {
  if (!subject) return null;
  if (['new','weak','mastered'].includes(subject)) return subject;
  return null;
}

function navigate(hash) {
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

  // Entry card counts
  updateEntryCounts();
  // Per-subject badges on the grid
  renderSubjectBadges();
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

// Update per-subject weak/mastered badges on the home screen grid
function renderSubjectBadges() {
  const entry = state.entry || 'new';
  const threshold = state.settings.weakThreshold;
  const thresholdPct = threshold * 100;

  ['math','english','chinese','science','biology','history','geography','politics'].forEach(subj => {
    const questions = state.questionBank[subj] || [];
    const badge = document.getElementById('badge-' + subj);
    if (!badge) return;

    let count = 0;
    questions.forEach(q => {
      const rec = state.progress[q.id];
      if (!rec) return;
      if (entry === 'weak') {
        // Wrong count >= 2 or accuracy below threshold
        const total = rec.correct + rec.wrong;
        const acc = total > 0 ? rec.correct / total : 0;
        if (rec.wrong >= 2 || acc * 100 < thresholdPct) count++;
      } else if (entry === 'mastered') {
        if (rec.status === 'mastered') count++;
      }
    });

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'inline-block';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  });
}

function setCount(id, n) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = n + '题';
  el.classList.toggle('empty', n === 0);
}

// PRACTICE
function renderPractice() {
  const container = document.getElementById('question-container');

  // Show entry info if we came from an entry card
  const entryInfo = document.getElementById('practice-entry-info');
  const entryLabel = document.getElementById('practice-entry-label');
  const entryCount = document.getElementById('practice-entry-count');
  const title = document.getElementById('practice-view-title');

  if (state.subject && ['new','weak','mastered'].includes(state.subject)) {
    // Showing subject selection for this entry type
    const labels = { new: '🆕 全新题目', weak: '🔴 易错汇总', mastered: '✅ 熟练掌握' };
    const total = countByEntry(state.subject);
    entryLabel.textContent = labels[state.subject] || '';
    entryCount.textContent = total + '题可选';
    entryInfo.style.display = 'flex';
    title.textContent = '选择科目';
    container.innerHTML = '<p class="placeholder">选择科目开始练习</p>';
  } else if (state.subject) {
    // Actual subject selected — start session
    entryInfo.style.display = 'none';
    title.textContent = subjectName(state.subject);
    startSession(state.subject, state.entry);
  } else {
    entryInfo.style.display = 'none';
    title.textContent = '选择科目';
    container.innerHTML = '<p class="placeholder">选择科目开始练习</p>';
  }
}

function countByEntry(entry) {
  let total = 0;
  Object.entries(state.questionBank).forEach(([subj, questions]) => {
    questions.forEach(q => {
      const s = (state.progress[q.id] || {}).status || 'new';
      if (s === entry) total++;
    });
  });
  return total;
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
  state.sessionIndex = 0;

  // Get questions for this subject+entry
  const all = state.questionBank[subject] || [];
  let filtered;
  if (entry && ['new','weak','mastered'].includes(entry)) {
    filtered = all.filter(q => {
      const s = (state.progress[q.id] || {}).status || 'new';
      return s === entry;
    });
  } else {
    filtered = all;
  }

  // Shuffle
  filtered = shuffle(filtered.slice(0, 20)); // max 20 per session

  if (filtered.length === 0) {
    document.getElementById('question-container').innerHTML =
      '<p class="placeholder">这个分类还没有题目</p>';
    return;
  }

  state.sessionQuestions = filtered;
  state.subject = subject;
  state.entry = entry || 'new';

  // Auto-checkin on first session of the day
  await ensureTodayCheckin();

  renderQuestion();
}

function speakQuestion() {
  if (!('speechSynthesis' in window)) return;
  const q = state.sessionQuestions[state.sessionIndex];
  if (!q) return;

  // Cancel any ongoing speech first, then wait a tick for browser to release audio
  speechSynthesis.cancel();
  setTimeout(() => {
    const lang = q.tts || 'en-US';

    // Pick the right text to read based on question type
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
    utter.rate = 0.75;  // Slightly slower for clarity
    utter.pitch = 1;
    utter.volume = 1;

    // Disable options while speaking
    const grid = document.querySelector('.answer-grid');
    if (grid) grid.style.pointerEvents = 'none';

    const btn = document.getElementById('listen-btn');
    if (btn) {
      btn.textContent = '🔊 播放中...';
      btn.disabled = true;
    }

    utter.onend = () => {
      if (grid) grid.style.pointerEvents = '';
      if (btn) {
        btn.textContent = '✅ 已听完';
        btn.disabled = false;
      }
    };

    utter.onerror = () => {
      if (grid) grid.style.pointerEvents = '';
      if (btn) {
        btn.textContent = '🔊 重试';
        btn.disabled = false;
      }
    };

    state.ttsUtterance = utter;
    speechSynthesis.speak(utter);
  }, 50); // 50ms pause lets browser fully release audio lock before new utterance
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

  // ── LISTENING TYPE: dictation ──────────────────────────────────────
  if (q.type === 'dictation') {
    const listenBtn = 'speechSynthesis' in window
      ? `<button class="listen-btn" id="listen-btn" data-action="listen">🔊 听句子</button>`
      : '';
    container.innerHTML = `
      <div class="question-meta">
        <span>${typeLabel}</span><span>${diffLabel}</span>
        <span class="question-progress">${idx + 1}/${total}</span>
      </div>
      ${q.hint ? `<div class="question-hint">${q.hint}</div>` : ''}
      ${listenBtn}
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
    const listenBtn = 'speechSynthesis' in window
      ? `<button class="listen-btn" id="listen-btn" data-action="listen">🔊 听短文</button>`
      : '';
    container.innerHTML = `
      <div class="question-meta">
        <span>${typeLabel}</span><span>${diffLabel}</span>
        <span class="question-progress">${idx + 1}/${total}</span>
        <span class="sub-progress">小题 ${subIdx + 1}/${subQs.length}</span>
      </div>
      ${listenBtn}
      <div class="passage-block">${q.passage || ''}</div>
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
  const isListening = (q.tts || q.type === 'listening') && q.audio_text;
  const listenBtn = isListening && 'speechSynthesis' in window
    ? `<button class="listen-btn" id="listen-btn" data-action="listen">🔊 听对话/短文</button>`
    : '';

  const isChoice = q.type === 'choice' && q.options && q.options.length > 0;
  const isFillOrShort = (!q.options || q.options.length === 0) && (q.type === 'fill' || q.type === 'short_answer' || q.type === 'expression');

  const opts = isChoice ? q.options.map((opt, i) =>
    `<button class="answer-btn" data-action="answer" data-choice="${i}">${opt}</button>`
  ).join('') : '';

  const optsDisabled = isListening ? '' : '';

  const inputArea = isFillOrShort
    ? `<div class="fill-area">
         <div class="fill-input-row">
           <input type="text" class="fill-input" id="fill-answer-input" placeholder="${q.type === 'short_answer' ? '写出答案...' : '填写答案...'}" autocomplete="off" />
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
    <div class="question-text">${q.question}</div>
    ${opts ? `<div class="answer-grid">${opts}</div>` : ''}
    ${inputArea}
    <div id="answer-feedback" style="display:none;margin-top:12px"></div>
  `;

  if (isFillOrShort) {
    const inp = document.getElementById('fill-answer-input');
    if (inp) inp.focus();
  }

  if (isListening && 'speechSynthesis' in window) {
    state.ttsUtterance = null;
  }
}

async function handleAnswer(choiceIdx) {
  const q = state.sessionQuestions[state.sessionIndex];
  // Only for choice questions
  const isCorrect = (q.type === 'choice' && q.options && q.options[choiceIdx] === String(q.answer)) ||
    (q.type === 'choice' && Array.isArray(q.answer) && q.answer.includes(String(choiceIdx)));

  // Update session score
  if (isCorrect) state.sessionScore.correct++;
  else state.sessionScore.wrong++;

  // Update progress
  await recordAnswer(q.id, isCorrect);

  // Show feedback
  const fb = document.getElementById('answer-feedback');
  if (fb) {
    fb.style.display = 'block';
    if (isCorrect) {
      fb.innerHTML = `<span class="fb-correct">✅ 正确！</span>`;
      if (q.explanation) fb.innerHTML += `<p class="explanation">${q.explanation}</p>`;
    } else {
      const correctAns = q.answer;
      fb.innerHTML = `<span class="fb-wrong">❌ 错误！正确答案是：${correctAns}</span>`;
      if (q.explanation) fb.innerHTML += `<p class="explanation">${q.explanation}</p>`;
    }
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
  const norm = userAnswer.toLowerCase().replace(/\s+/g, ' ').trim();
  let correctAns = q.answer;
  if (typeof correctAns === 'string' && correctAns.startsWith('"') && correctAns.endsWith('"')) {
    correctAns = correctAns.slice(1, -1);
  }
  const normCorrect = typeof correctAns === 'string'
    ? correctAns.toLowerCase().replace(/\s+/g, ' ').trim()
    : String(correctAns);
  const isCorrect = norm === normCorrect || userAnswer === String(correctAns);

  if (isCorrect) state.sessionScore.correct++;
  else state.sessionScore.wrong++;

  await recordAnswer(q.id, isCorrect);

  const fb = document.getElementById('answer-feedback');
  if (fb) {
    fb.style.display = 'block';
    const exp = q.explanation ? `<p class="explanation">${q.explanation}</p>` : '';
    if (isCorrect) {
      fb.innerHTML = `<span class="fb-correct">✅ 正确！</span>${exp}`;
    } else {
      fb.innerHTML = `<span class="fb-wrong">❌ 错误！正确答案是：${q.answer}</span>${exp}`;
    }
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

  const norm = userAnswer.toLowerCase().replace(/\s+/g, ' ').trim();
  let correctAns = sq.answer;
  if (typeof correctAns === 'string' && correctAns.startsWith('"') && correctAns.endsWith('"')) {
    correctAns = correctAns.slice(1, -1);
  }
  const normCorrect = typeof correctAns === 'string'
    ? correctAns.toLowerCase().replace(/\s+/g, ' ').trim()
    : String(correctAns);
  const isCorrect = norm === normCorrect || userAnswer === String(correctAns);

  if (isCorrect) state.sessionScore.correct++;
  else state.sessionScore.wrong++;

  await recordAnswer(q.id + '_sub_' + subIdx, isCorrect);

  const fb = document.getElementById('answer-feedback');
  if (fb) {
    fb.style.display = 'block';
    const exp = sq.explanation ? `<p class="explanation">${sq.explanation}</p>` : '';
    if (isCorrect) {
      fb.innerHTML = `<span class="fb-correct">✅ 正确！</span>${exp}`;
    } else {
      fb.innerHTML = `<span class="fb-wrong">❌ 错误！正确答案是：${sq.answer}</span>${exp}`;
    }
    fb.innerHTML += `<button class="primary-btn" data-action="pd-next" style="margin-top:10px">${
      subIdx + 1 >= (q.questions || []).length ? '短文结束 →' : '下一题 →'
    }</button>`;
  }
}

async function handleFillAnswer(userAnswer) {
  const q = state.sessionQuestions[state.sessionIndex];
  if (!q || !userAnswer) return;

  // Normalize: lowercase, remove extra spaces
  const norm = userAnswer.toLowerCase().replace(/\s+/g, ' ').trim();
  // Try to parse answer as JS value (handles quoted strings like '"sad"')
  let correctAns = q.answer;
  try {
    // If answer looks like a quoted string, unquote it
    if (typeof correctAns === 'string' && correctAns.startsWith('"') && correctAns.endsWith('"')) {
      correctAns = correctAns.slice(1, -1);
    }
  } catch (_) {}

  const normCorrect = typeof correctAns === 'string'
    ? correctAns.toLowerCase().replace(/\s+/g, ' ').trim()
    : String(correctAns);

  // Exact match or number match
  const isCorrect = norm === normCorrect || norm === String(correctAns) || userAnswer === String(correctAns);

  if (isCorrect) state.sessionScore.correct++;
  else state.sessionScore.wrong++;

  await recordAnswer(q.id, isCorrect);

  const fb = document.getElementById('answer-feedback');
  if (fb) {
    fb.style.display = 'block';
    if (isCorrect) {
      fb.innerHTML = `<span class="fb-correct">✅ 正确！</span>`;
      if (q.explanation) fb.innerHTML += `<p class="explanation">${q.explanation}</p>`;
    } else {
      fb.innerHTML = `<span class="fb-wrong">❌ 错误！正确答案是：${correctAns}</span>`;
      if (q.explanation) fb.innerHTML += `<p class="explanation">${q.explanation}</p>`;
    }
    fb.innerHTML += `<button class="primary-btn" data-action="next-question" style="margin-top:10px">下一题 →</button>`;
  }
}

async function nextQuestion() {
  state.sessionIndex++;
  state.pdIndex = 0;
  renderQuestion();
}

async function recordAnswer(questionId, isCorrect) {
  const p = state.progress[questionId] || { status: 'new', correct: 0, wrong: 0, lastPracticed: null };

  if (isCorrect) {
    p.correct++;
    // 3 consecutive correct → mastered
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
  state.progress[questionId] = p;
  await set(K.PROGRESS, state.progress);
}

async function renderSessionEnd() {
  const container = document.getElementById('question-container');
  const { correct, wrong } = state.sessionScore;
  const total = correct + wrong;
  const acc = total > 0 ? Math.round(correct / total * 100) : 0;

  // Record daily session
  const today = todayKey();
  const existing = state.daily[today] || { practiced: 0, questionsCount: 0, correct: 0, accuracy: 0, score: 0 };
  const newQ = existing.questionsCount + total;
  const newC = existing.correct + correct;
  const newAcc = newQ > 0 ? newC / newQ : 0;
  const newScore = Math.round((newQ + 1) * newAcc);
  state.daily[today] = {
    practiced: existing.practiced + 1,
    questionsCount: newQ,
    correct: newC,
    accuracy: newAcc,
    score: newScore,
  };
  await set(K.DAILY, state.daily);

  const streak = calcStreak();

  container.innerHTML = `
    <div class="session-end">
      <p class="placeholder">本轮完成！</p>
      <div class="session-score">
        <span class="big-num">${correct}/${total}</span>
        <span>正确率 ${acc}%</span>
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

// SVG Chart — last 30 days
function drawChart() {
  const W = 340, H = 120, PAD = 20;
  const days = 30;
  const today = new Date();
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const scores = dates.map(d => (state.daily[d] || {}).score || 0);
  const maxS = Math.max(10, ...scores);

  const xStep = (W - PAD * 2) / (days - 1);
  const yScale = (H - PAD * 2) / maxS;

  const points = scores.map((s, i) => [
    PAD + i * xStep,
    H - PAD - s * yScale
  ]);

  const polyline = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  // Area fill path
  const area = polyline + ` L${points[points.length-1][0].toFixed(1)},${(H-PAD).toFixed(1)} L${points[0][0].toFixed(1)},${(H-PAD).toFixed(1)} Z`;

  // X axis labels (every 7 days)
  const xLabels = [0, 7, 14, 21, 29].map(i => {
    if (!dates[i]) return '';
    const d = new Date(dates[i]);
    const label = `${d.getMonth()+1}/${d.getDate()}`;
    return `<text x="${PAD + i*xStep}" y="${H-4}" class="chart-xlabel">${label}</text>`;
  }).join('');

  // Y axis labels
  const yLabels = [0, maxS].map(s => {
    const y = H - PAD - s * yScale;
    return `<text x="${PAD-4}" y="${y+4}" class="chart-ylabel" text-anchor="end">${s}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" class="chart-svg">
    ${scores.some(s=>s>0) ? `<path d="${area}" class="chart-area"/>` : ''}
    <polyline points="${points.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" class="chart-line" fill="none"/>
    ${points.filter((_,i) => scores[i] > 0).map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" class="chart-dot"/>`).join('')}
    ${xLabels}
    ${yLabels}
  </svg>`;
}

// SETTINGS VIEW
async function renderSettings() {
  const container = document.getElementById('settings-content');
  const lastUpdate = state.settings.lastQuestionBankUpdate
    ? dateLabel(state.settings.lastQuestionBankUpdate)
    : '从未更新';

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
        <span class="settings-val">${lastUpdate}</span>
      </div>
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
  if (btn) { btn.disabled = true; btn.textContent = '检查中...'; }

  try {
    // Fetch all question JSONs
    const files = [
      'batch_bio.json','batch_chi.json','batch_chi2.json','batch_chi3.json',
      'batch_en.json','batch_en2.json','batch_en3.json','batch_geo.json',
      'batch_hist.json','batch_math2.json','batch_math3.json','batch_pol.json',
      'batch_sc2.json','batch_sci.json'
    ];
    const results = await Promise.allSettled(
      files.map(f => fetch('questions/' + f).then(r => r.json()))
    );

    const merged = {};
    results.forEach(r => {
      if (r.status !== 'fulfilled') return;
      r.value.forEach(q => {
        const s = q.subject;
        if (!merged[s]) merged[s] = [];
        merged[s].push(q);
      });
    });

    // Replace question bank
    state.questionBank = merged;
    state.settings.lastQuestionBankUpdate = todayKey();
    await set(K.QB_CACHE, merged);
    await set(K.SETTINGS, state.settings);

    showToast('题库已更新！共 ' + Object.values(merged).reduce((s, a) => s + a.length, 0) + ' 题');
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
    state.daily[today] = { practiced: 0, questionsCount: 0, correct: 0, accuracy: 0, score: 0 };
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
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
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

    case 'start-entry':
      state.entry = t.dataset.entry;
      navigate('#/practice/' + t.dataset.entry);
      break;

    case 'start-subject':
      state.subject = t.dataset.subject;
      // Keep the entry type from the URL or state
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
  state.settings = { weakThreshold: 0.6, lastQuestionBankUpdate: null };
  location.reload();
}

// ============================================================
// UTILITIES
// ============================================================
function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function dateLabel(iso) {
  const d = new Date(iso);
  return `${d.getMonth()+1}月${d.getDate()}日`;
}

function getWeekDays() {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
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
  return { math:'数学', chinese:'语文', english:'英语', science:'科学',
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
