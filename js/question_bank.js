// Question Bank Module — per-subject lazy loading with multi-section support
// Uses idb-keyval for IndexedDB storage
// Sections: primary, senior, senior-high

const SECTIONS = ['primary', 'senior', 'senior-high'];
const SECTION_SUBJECTS = {
  'primary': ['math', 'chinese', 'english'],
  'senior': ['math', 'chinese', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics'],
  'senior-high': ['math', 'chinese', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics']
};

// Legacy flat SUBJECTS for backward compatibility during migration
const SUBJECTS = ['math', 'english', 'chinese', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics'];

// New per-section per-subject keys
const QB_INDEX_KEY = 'qb_index';
const QB_MIGRATION_KEY = 'qb_migration';
const QUESTION_PROGRESS_KEY = 'question_progress';
const WRONG_QUESTIONS_KEY = 'wrong_questions';
const KNOWLEDGE_PROGRESS_KEY = 'knowledge_progress';
const SETTINGS_KEY = 'settings';
const FEEDBACK_PENDING_KEY = 'feedback_pending';

function qbKey(section, subject) { return `qb_${section}_${subject}`; }

// In-memory cache — only loaded subjects kept here
// Structure: { '${section}_${subject}': [...] }
let questionBank = {};

// ==================== Migration ====================

async function migrateFromLegacy() {
  const legacy = await get('question_bank');       // question_bank.js legacy key
  const legacyCache = await get('question_bank_cache'); // app.js legacy key
  const source = legacy || legacyCache;
  if (!source || typeof source !== 'object') return;

  // Migrate legacy flat format to senior section (default)
  for (const subj of SUBJECTS) {
    if (Array.isArray(source[subj]) && source[subj].length > 0) {
      const questions = source[subj].map(q => ({ ...q, _section: 'senior', _subject: subj }));
      await set(qbKey('senior', subj), questions);
      questionBank[`senior_${subj}`] = questions;
    }
  }
  await del('question_bank');
  await del('question_bank_cache');
  await set(QB_MIGRATION_KEY, { legacy: false, migratedAt: Date.now() });
  console.log('[QB] 迁移完成：旧格式 → 分学科分学段格式');
}

// ==================== Lazy Load ====================

// Ensure a single subject is loaded into memory + IDB
async function ensureSubjectLoaded(section, subject) {
  const cacheKey = `${section}_${subject}`;
  if (questionBank[cacheKey]?.length > 0) return questionBank[cacheKey];

  // Try IDB
  const cached = await get(qbKey(section, subject));
  if (cached?.length > 0) {
    questionBank[cacheKey] = cached;
    return cached;
  }

  // Lazy load from network
  try {
    const resp = await fetch(`questions/${section}/${subject}.json`);
    if (resp.ok) {
      const data = await resp.json();
      // Attach internal fields
      const enriched = data.map(q => ({ ...q, _section: section, _subject: subject }));
      await set(qbKey(section, subject), enriched);
      questionBank[cacheKey] = enriched;
      return enriched;
    }
  } catch (e) {
    console.warn(`[QB] Failed to load ${section}/${subject}:`, e);
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

  // 2. Fetch per-section index files and check versions
  const needsUpdate = [];
  const sectionIndexCacheKey = 'qb_section_indexes';

  for (const section of SECTIONS) {
    const sectionSubjects = SECTION_SUBJECTS[section] || [];
    let sectionIndex = null;
    try {
      const resp = await fetch(`questions/${section}/index.json?_=${Date.now()}`);
      if (resp.ok) sectionIndex = await resp.json();
    } catch (e) {
      console.warn(`[QB] Failed to fetch ${section}/index.json:`, e);
    }
    const cachedSectionIndex = (await get(sectionIndexCacheKey)) || {};

    for (const subj of sectionSubjects) {
      const remoteVersion = sectionIndex?.subjects?.[subj]?.version;
      const cachedVersion = cachedSectionIndex[section]?.subjects?.[subj]?.version;
      const localData = await get(qbKey(section, subj));

      if (!localData || localData.length === 0 || remoteVersion !== cachedVersion) {
        needsUpdate.push({ section, subject: subj });
      }
    }

    if (sectionIndex) {
      cachedSectionIndex[section] = sectionIndex;
    }
  }
  await set(sectionIndexCacheKey, cachedSectionIndex);

  // 4. Parallel load of missing/outdated subjects
  await Promise.all(needsUpdate.map(async ({ section, subject }) => {
    try {
      const resp = await fetch(`questions/${section}/${subject}.json`);
      if (resp.ok) {
        const data = await resp.json();
        const enriched = data.map(q => ({ ...q, _section: section, _subject: subject }));
        await set(qbKey(section, subject), enriched);
        questionBank[`${section}_${subject}`] = enriched;
        console.log(`[QB] Loaded ${section}/${subject}: ${data.length} questions`);
      }
    } catch (e) {
      console.warn(`[QB] Failed to load ${section}/${subject}:`, e);
    }
  }));

  // 5. Save index snapshot
  if (remoteIndex) {
    await set(QB_INDEX_KEY, remoteIndex);
  }
}

// ==================== Public API ====================

// Load questions — if section and subject provided, load that specific subject;
// if only section provided, load all subjects for that section;
// if no args, load ALL subjects across all sections (for updateEntryCardCounts)
async function loadQuestions(section, subject) {
  if (section === undefined) {
    // Full load path — used by updateEntryCardCounts
    await Promise.all(
      SECTIONS.flatMap(sec =>
        (SECTION_SUBJECTS[sec] || []).map(subj => ensureSubjectLoaded(sec, subj))
      )
    );
    return Object.values(questionBank).flat();
  }

  if (subject === undefined) {
    // Load all subjects for a section
    const sectionSubjects = SECTION_SUBJECTS[section] || [];
    await Promise.all(sectionSubjects.map(subj => ensureSubjectLoaded(section, subj)));
    return Object.values(questionBank).filter((_, key) => key.startsWith(`${section}_`)).flat();
  }

  return await ensureSubjectLoaded(section, subject);
}

async function getQuestion(id) {
  for (const cacheKey of Object.keys(questionBank)) {
    const questions = questionBank[cacheKey];
    if (questions?.length > 0) {
      const q = questions.find(q => q.id === id);
      if (q) return q;
    }
  }
  return null;
}

async function getQuestionsBySubject(section, subject) {
  return await ensureSubjectLoaded(section, subject);
}

async function getQuestionsByTag(section, subject, tag) {
  const questions = await ensureSubjectLoaded(section, subject);
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
    const key = `${question._section || question.subject}::${tag}`;
    const subject = question._subject || question.subject;
    const existing = kp.findIndex(r => r.key === key && r.date === today);
    if (existing >= 0) {
      kp[existing].total++;
      if (isCorrect) kp[existing].correct++;
    } else {
      kp.push({ key, subject, tag, date: today, total: 1, correct: isCorrect ? 1 : 0 });
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
  // Also clear all qb_ keys across all sections
  for (const section of SECTIONS) {
    const sectionSubjects = SECTION_SUBJECTS[section] || [];
    for (const subj of sectionSubjects) {
      await clear(qbKey(section, subj));
    }
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

// ==================== Exports ====================

export {
  SECTIONS,
  SECTION_SUBJECTS,
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
