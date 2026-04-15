// Question Bank Module — per-subject lazy loading
// Uses idb-keyval for IndexedDB storage

const SUBJECTS = ['math', 'english', 'chinese', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics'];

// New per-subject keys
const QB_INDEX_KEY = 'qb_index';
const QB_MIGRATION_KEY = 'qb_migration';
const QUESTION_PROGRESS_KEY = 'question_progress';
const WRONG_QUESTIONS_KEY = 'wrong_questions';
const KNOWLEDGE_PROGRESS_KEY = 'knowledge_progress';
const SETTINGS_KEY = 'settings';
const FEEDBACK_PENDING_KEY = 'feedback_pending';

function qbKey(subject) { return `qb_${subject}`; }

// In-memory cache — only loaded subjects kept here
let questionBank = {};

// ==================== Migration ====================

async function migrateFromLegacy() {
  const legacy = await get('question_bank');       // question_bank.js legacy key
  const legacyCache = await get('question_bank_cache'); // app.js legacy key
  const source = legacy || legacyCache;
  if (!source || typeof source !== 'object') return;

  for (const subj of SUBJECTS) {
    if (Array.isArray(source[subj]) && source[subj].length > 0) {
      await set(qbKey(subj), source[subj]);
      questionBank[subj] = source[subj];
    }
  }
  await del('question_bank');
  await del('question_bank_cache');
  await set(QB_MIGRATION_KEY, { legacy: false, migratedAt: Date.now() });
  console.log('[QB] 迁移完成：旧格式 → 分学科格式');
}

// ==================== Lazy Load ====================

// Ensure a single subject is loaded into memory + IDB
async function ensureSubjectLoaded(subject) {
  if (questionBank[subject]?.length > 0) return questionBank[subject];

  // Try IDB
  const cached = await get(qbKey(subject));
  if (cached?.length > 0) {
    questionBank[subject] = cached;
    return cached;
  }

  // Lazy load from network
  try {
    const resp = await fetch(`questions/${subject}.json`);
    if (resp.ok) {
      const data = await resp.json();
      await set(qbKey(subject), data);
      questionBank[subject] = data;
      return data;
    }
  } catch (e) {
    console.warn(`[QB] Failed to load ${subject}:`, e);
  }
  return [];
}

// ==================== Init ====================

async function initializeQuestionBank() {
  // 1. Migration check
  const migrated = await get(QB_MIGRATION_KEY);
  if (!migrated) {
    await migrateFromLegacy();
  }

  // 2. Fetch index
  let remoteIndex = null;
  try {
    const resp = await fetch(`questions/index.json?_=${Date.now()}`);
    if (resp.ok) remoteIndex = await resp.json();
  } catch (e) {
    console.warn('[QB] Failed to fetch index.json:', e);
  }

  // 3. Per-subject version check — load only if version changed or no local data
  const needsUpdate = [];
  const cachedIndex = await get(QB_INDEX_KEY);

  for (const subj of SUBJECTS) {
    const remoteVersion = remoteIndex?.subjects?.[subj]?.version;
    const cachedVersion = cachedIndex?.subjects?.[subj]?.version;
    const localData = await get(qbKey(subj));

    if (!localData || localData.length === 0 || remoteVersion !== cachedVersion) {
      needsUpdate.push(subj);
    }
  }

  // 4. Parallel load of missing/outdated subjects
  await Promise.all(needsUpdate.map(async (subj) => {
    try {
      const resp = await fetch(`questions/${subj}.json`);
      if (resp.ok) {
        const data = await resp.json();
        await set(qbKey(subj), data);
        questionBank[subj] = data;
        console.log(`[QB] Loaded ${subj}: ${data.length} questions`);
      }
    } catch (e) {
      console.warn(`[QB] Failed to load ${subj}:`, e);
    }
  }));

  // 5. Save index snapshot
  if (remoteIndex) {
    await set(QB_INDEX_KEY, remoteIndex);
  }
}

// ==================== Public API ====================

// Load questions — if subject provided, lazy load it;
// if no subject, load ALL subjects (for updateEntryCardCounts)
async function loadQuestions(subject) {
  if (subject === undefined) {
    // Full load path — used by updateEntryCardCounts
    await Promise.all(SUBJECTS.map(s => ensureSubjectLoaded(s)));
    return Object.values(questionBank).flat();
  }
  return await ensureSubjectLoaded(subject);
}

async function getQuestion(id) {
  for (const subj of SUBJECTS) {
    if (questionBank[subj]?.length > 0) {
      const q = questionBank[subj].find(q => q.id === id);
      if (q) return q;
    }
  }
  return null;
}

async function getQuestionsBySubject(subject) {
  return await ensureSubjectLoaded(subject);
}

async function getQuestionsByTag(subject, tag) {
  const questions = await ensureSubjectLoaded(subject);
  if (!tag) return questions;
  return questions.filter(q => q.knowledgeTags?.includes(tag));
}

// ==================== Progress ====================

async function saveProgress(questionId, answer, isCorrect) {
  const today = new Date().toISOString().split('T')[0];
  const progress = await get(QUESTION_PROGRESS_KEY) || {};
  progress[questionId] = { answer, isCorrect, date: today, timestamp: Date.now() };
  await set(QUESTION_PROGRESS_KEY, progress);
  return progress;
}

async function getProgress() {
  return await get(QUESTION_PROGRESS_KEY) || {};
}

// ==================== Wrong Questions ====================

async function addWrongQuestion(question, userAnswer) {
  const wrongList = await getWrongQuestions();
  if (wrongList.some(w => w.question.id === question.id)) return wrongList;
  wrongList.push({ question, userAnswer, timestamp: Date.now() });
  await set(WRONG_QUESTIONS_KEY, wrongList);
  return wrongList;
}

async function getWrongQuestions() {
  return (await get(WRONG_QUESTIONS_KEY)) || [];
}

async function removeWrongQuestion(questionId) {
  const wrongList = await getWrongQuestions();
  const filtered = wrongList.filter(w => w.question.id !== questionId);
  await set(WRONG_QUESTIONS_KEY, filtered);
  return filtered;
}

async function clearWrongQuestions() {
  await set(WRONG_QUESTIONS_KEY, []);
}

// ==================== Knowledge Mastery ====================

async function recordKnowledgeTag(question, isCorrect) {
  const today = new Date().toISOString().split('T')[0];
  const kp = await get(KNOWLEDGE_PROGRESS_KEY) || [];
  const tags = question.knowledgeTags || [];
  for (const tag of tags) {
    const key = `${question.subject}::${tag}`;
    const existing = kp.findIndex(r => r.key === key && r.date === today);
    if (existing >= 0) {
      kp[existing].total++;
      if (isCorrect) kp[existing].correct++;
    } else {
      kp.push({ key, subject: question.subject, tag, date: today, total: 1, correct: isCorrect ? 1 : 0 });
    }
  }
  await set(KNOWLEDGE_PROGRESS_KEY, kp);
  return kp;
}

async function getKnowledgeMastery(subject, days = 100) {
  const kp = await get(KNOWLEDGE_PROGRESS_KEY) || [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const filtered = kp.filter(r => r.subject === subject && r.date >= cutoffStr);
  const byTag = {};
  for (const record of filtered) {
    if (!byTag[record.tag]) byTag[record.tag] = [];
    byTag[record.tag].push(record);
  }
  const result = {};
  for (const [tag, records] of Object.entries(byTag)) {
    records.sort((a, b) => a.date.localeCompare(b.date));
    let total = 0, correct = 0;
    const series = records.map(r => {
      total += r.total;
      correct += r.correct;
      return { date: r.date, accuracy: Math.round((correct / total) * 100) };
    });
    result[tag] = series;
  }
  return result;
}

// ==================== Settings ====================

const DEFAULT_SETTINGS = { dailyGoal: 10, difficultyFilter: null };

async function getSettings() {
  return Object.assign({}, DEFAULT_SETTINGS, (await get(SETTINGS_KEY)) || {});
}

async function saveSetting(key, value) {
  const settings = await getSettings();
  settings[key] = value;
  await set(SETTINGS_KEY, settings);
  return settings;
}

async function clearAllData() {
  await clear(QUESTION_PROGRESS_KEY);
  await clear(WRONG_QUESTIONS_KEY);
  await clear(KNOWLEDGE_PROGRESS_KEY);
  await clear(SETTINGS_KEY);
  // Also clear all qb_ keys
  for (const subj of SUBJECTS) {
    await clear(qbKey(subj));
  }
  await clear(QB_INDEX_KEY);
  await clear(QB_MIGRATION_KEY);
  questionBank = {};
}

// ==================== Feedback ====================

const TELEGRAM_BOT_TOKEN = window.__ENV?.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = window.__ENV?.TELEGRAM_CHAT_ID || '';

async function sendFeedback(text) {
  const entry = { id: 'fb_' + Date.now(), text: text.trim(), timestamp: Date.now(), date: new Date().toISOString(), status: 'pending' };
  const pending = await get(FEEDBACK_PENDING_KEY) || [];
  pending.unshift(entry);
  await set(FEEDBACK_PENDING_KEY, pending.slice(0, 100));
  return { saved: true, id: entry.id };
}

async function getPendingFeedbacks() {
  return ((await get(FEEDBACK_PENDING_KEY)) || []).filter(f => f.status === 'pending');
}

async function getApprovedFeedbacks() {
  return ((await get(FEEDBACK_PENDING_KEY)) || []).filter(f => f.status === 'approved');
}

async function approveFeedback(id) {
  const pending = await get(FEEDBACK_PENDING_KEY) || [];
  const fb = pending.find(f => f.id === id);
  if (!fb) return { error: 'not found' };
  fb.status = 'approved';
  await set(FEEDBACK_PENDING_KEY, pending);
  try {
    const msg = `💬 反馈（已审批）\n\n${fb.text}\n\n📅 ${fb.date}`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg }) });
    const data = await resp.json();
    return { ok: data.ok, approved: true };
  } catch (e) {
    return { ok: false, approved: true, offline: true };
  }
}

async function rejectFeedback(id) {
  const pending = await get(FEEDBACK_PENDING_KEY) || [];
  const fb = pending.find(f => f.id === id);
  if (!fb) return { error: 'not found' };
  fb.status = 'rejected';
  await set(FEEDBACK_PENDING_KEY, pending);
  return { rejected: true };
}

async function getFeedbackStats() {
  const pending = await get(FEEDBACK_PENDING_KEY) || [];
  return { pending: pending.filter(f => f.status === 'pending').length, approved: pending.filter(f => f.status === 'approved').length, rejected: pending.filter(f => f.status === 'rejected').length };
}

async function getFeedbackHistory() {
  return (await get(FEEDBACK_PENDING_KEY)) || [];
}

export {
  loadQuestions,
  getQuestion,
  getQuestionsBySubject,
  getQuestionsByTag,
  saveProgress,
  getProgress,
  addWrongQuestion,
  getWrongQuestions,
  removeWrongQuestion,
  clearWrongQuestions,
  initializeQuestionBank,
  recordKnowledgeTag,
  getKnowledgeMastery,
  getSettings,
  saveSetting,
  clearAllData,
  sendFeedback,
  getPendingFeedbacks,
  getApprovedFeedbacks,
  approveFeedback,
  rejectFeedback,
  getFeedbackStats,
  getFeedbackHistory
};
