// Question Bank Module
// Uses idb-keyval for IndexedDB storage

const QUESTION_STORE_KEY = 'question_bank';
const QUESTION_PROGRESS_KEY = 'question_progress';
const WRONG_QUESTIONS_KEY = 'wrong_questions';
const KNOWLEDGE_PROGRESS_KEY = 'knowledge_progress';
const SETTINGS_KEY = 'settings';
const FEEDBACK_KEY = 'feedback';

// Question structure:
// {
//   id: string,
//   type: 'choice' | 'fill' | 'short_answer' | 'reading' | 'dictation' | 'expression',
//   subject: 'math' | 'english' | 'chinese' | 'science' | 'history' | 'geography' | 'politics',
//   difficulty: 1 | 2 | 3,
//   grade: number,
//   knowledgeTags: string[],
//   question: string,
//   options?: string[],
//   answer: string | string[],
//   explanation?: string
// }

let questionBank = {
  math: [],
  english: [],
  chinese: [],
  science: [],
  history: [],
  geography: [],
  politics: []
};

// Load questions from IndexedDB or bundled JSON
async function loadQuestions(subject) {
  // If no subject, return ALL questions as flat array (used by updateEntryCardCounts)
  if (subject === undefined) {
    if (questionBank && Object.keys(questionBank).length > 0) {
      return Object.values(questionBank).flat();
    }
    // Fallback: load from IDB and flatten
    const stored = await get(QUESTION_STORE_KEY);
    if (stored) { questionBank = stored; return Object.values(stored).flat(); }
    return [];
  }

  // Load from IndexedDB
  const stored = await get(QUESTION_STORE_KEY);
  if (stored && stored[subject] && stored[subject].length > 0) {
    questionBank[subject] = stored[subject];
    return questionBank[subject];
  }
  // Return already-loaded subject from memory
  if (questionBank[subject] && questionBank[subject].length > 0) {
    return questionBank[subject];
  }
  return [];
}

// Get a specific question by ID
async function getQuestion(id) {
  for (const subject of Object.keys(questionBank)) {
    const question = questionBank[subject].find(q => q.id === id);
    if (question) return question;
  }
  return null;
}

// Get questions by subject
async function getQuestionsBySubject(subject) {
  if (questionBank[subject] && questionBank[subject].length > 0) {
    return questionBank[subject];
  }
  return await loadQuestions(subject);
}

// Get questions by subject and knowledge tag
async function getQuestionsByTag(subject, tag) {
  const questions = await getQuestionsBySubject(subject);
  if (!tag) return questions;
  return questions.filter(q => q.knowledgeTags.includes(tag));
}

// Save progress (answered questions)
async function saveProgress(questionId, answer, isCorrect) {
  const today = new Date().toISOString().split('T')[0];
  const progress = await get(QUESTION_PROGRESS_KEY) || {};
  progress[questionId] = {
    answer,
    isCorrect,
    date: today,
    timestamp: Date.now()
  };
  await set(QUESTION_PROGRESS_KEY, progress);
  return progress;
}

// Get all progress
async function getProgress() {
  return await get(QUESTION_PROGRESS_KEY) || {};
}

// ==================== Wrong Questions ====================

// Add a wrong question to the collection
async function addWrongQuestion(question, userAnswer) {
  const wrongList = await getWrongQuestions();
  // Avoid duplicates
  if (wrongList.some(w => w.question.id === question.id)) {
    return wrongList;
  }
  wrongList.push({
    question,
    userAnswer,
    timestamp: Date.now()
  });
  await set(WRONG_QUESTIONS_KEY, wrongList);
  return wrongList;
}

// Get all wrong questions
async function getWrongQuestions() {
  return (await get(WRONG_QUESTIONS_KEY)) || [];
}

// Remove a question from wrong list (when answered correctly in review)
async function removeWrongQuestion(questionId) {
  const wrongList = await getWrongQuestions();
  const filtered = wrongList.filter(w => w.question.id !== questionId);
  await set(WRONG_QUESTIONS_KEY, filtered);
  return filtered;
}

// Clear all wrong questions
async function clearWrongQuestions() {
  await set(WRONG_QUESTIONS_KEY, []);
}

// ==================== Knowledge Mastery Tracking ====================

// Record knowledge tag practice result
// Called after each answer
async function recordKnowledgeTag(question, isCorrect) {
  const today = new Date().toISOString().split('T')[0];
  const kp = await get(KNOWLEDGE_PROGRESS_KEY) || [];

  const tags = question.knowledgeTags || [];
  for (const tag of tags) {
    const key = `${question.subject}::${tag}`;
    // Find existing entry for today
    const existing = kp.findIndex(r => r.key === key && r.date === today);
    if (existing >= 0) {
      kp[existing].total++;
      if (isCorrect) kp[existing].correct++;
    } else {
      kp.push({
        key,
        subject: question.subject,
        tag,
        date: today,
        total: 1,
        correct: isCorrect ? 1 : 0
      });
    }
  }

  await set(KNOWLEDGE_PROGRESS_KEY, kp);
  return kp;
}

// Get knowledge mastery data for a subject over last N days
async function getKnowledgeMastery(subject, days = 100) {
  const kp = await get(KNOWLEDGE_PROGRESS_KEY) || [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const filtered = kp.filter(r => r.subject === subject && r.date >= cutoffStr);

  // Group by tag, then compute daily accuracy
  const byTag = {};
  for (const record of filtered) {
    if (!byTag[record.tag]) byTag[record.tag] = [];
    byTag[record.tag].push(record);
  }

  // Build per-tag time series
  const result = {};
  for (const [tag, records] of Object.entries(byTag)) {
    // Sort by date
    records.sort((a, b) => a.date.localeCompare(b.date));
    // Compute cumulative/rolling accuracy
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

// Get type error rates (choice vs fill vs etc)
async function getTypeErrorRates() {
  const kp = await get(KNOWLEDGE_PROGRESS_KEY) || [];
  const typeStats = {}; // type -> { total, correct }
  for (const record of kp) {
    // type comes from key "subject::tag" - we don't store type here
    // Instead we aggregate by question type from wrong questions
  }
  return typeStats;
}

// ==================== Settings ====================

const DEFAULT_SETTINGS = {
  dailyGoal: 10,
  difficultyFilter: null // null = all, 1 = 简单, 2 = 中等, 3 = 困难
};

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
}

// ==================== Feedback ====================

const TELEGRAM_BOT_TOKEN=window.__ENV?.TELEGRAM_BOT_TOKEN||'';
const TELEGRAM_CHAT_ID=window.__ENV?.TELEGRAM_CHAT_ID||'';

const FEEDBACK_PENDING_KEY = 'feedback_pending';

// Submit new feedback — stored locally, waits for approval
async function sendFeedback(text) {
  const entry = {
    id: 'fb_' + Date.now(),
    text: text.trim(),
    timestamp: Date.now(),
    date: new Date().toISOString(),
    status: 'pending'  // pending | approved | rejected
  };

  // Save to pending list
  const pending = await get(FEEDBACK_PENDING_KEY) || [];
  pending.unshift(entry);
  await set(FEEDBACK_PENDING_KEY, pending.slice(0, 100));
  return { saved: true, id: entry.id };
}

// Get all pending feedbacks (for admin review)
async function getPendingFeedbacks() {
  const pending = await get(FEEDBACK_PENDING_KEY) || [];
  return pending.filter(f => f.status === 'pending');
}

// Get all approved feedbacks
async function getApprovedFeedbacks() {
  const pending = await get(FEEDBACK_PENDING_KEY) || [];
  return pending.filter(f => f.status === 'approved');
}

// Approve a feedback — sends to Telegram and marks approved
async function approveFeedback(id) {
  const pending = await get(FEEDBACK_PENDING_KEY) || [];
  const fb = pending.find(f => f.id === id);
  if (!fb) return { error: 'not found' };

  fb.status = 'approved';
  await set(FEEDBACK_PENDING_KEY, pending);

  // Send to Telegram
  try {
    const msg = `💬 反馈（已审批）\n\n${fb.text}\n\n📅 ${fb.date}`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg })
    });
    const data = await resp.json();
    return { ok: data.ok, approved: true };
  } catch (e) {
    return { ok: false, approved: true, offline: true };
  }
}

// Reject a feedback
async function rejectFeedback(id) {
  const pending = await get(FEEDBACK_PENDING_KEY) || [];
  const fb = pending.find(f => f.id === id);
  if (!fb) return { error: 'not found' };
  fb.status = 'rejected';
  await set(FEEDBACK_PENDING_KEY, pending);
  return { rejected: true };
}

// Get feedback stats
async function getFeedbackStats() {
  const pending = await get(FEEDBACK_PENDING_KEY) || [];
  return {
    pending: pending.filter(f => f.status === 'pending').length,
    approved: pending.filter(f => f.status === 'approved').length,
    rejected: pending.filter(f => f.status === 'rejected').length
  };
}

// Legacy — returns approved only
async function getFeedbackHistory() {
  return (await get(FEEDBACK_PENDING_KEY)) || [];
}

// Initialize: load question bank if DB is empty
async function initializeQuestionBank() {
  const stored = await get(QUESTION_STORE_KEY);
  if (!stored) {
    // Load ALL batch files from questions/ directory
    const ALL_BATCH_FILES = [
      'questions/question_bank_v2.json',
      'questions/batch_bio.json',
      'questions/batch_chi.json',
      'questions/batch_chi2.json',
      'questions/batch_chi3.json',
      'questions/batch_en.json',
      'questions/batch_en2.json',
      'questions/batch_en3.json',
      'questions/batch_geo.json',
      'questions/batch_hist.json',
      'questions/batch_math2.json',
      'questions/batch_math3.json',
      'questions/batch_pol.json',
      'questions/batch_sc2.json',
      'questions/batch_sci.json',
    ];
    const grouped = { math: [], english: [], chinese: [], science: [], history: [], geography: [], politics: [] };
    for (const file of ALL_BATCH_FILES) {
      try {
        const response = await fetch(file);
        if (response.ok) {
          const data = await response.json();
          data.forEach(q => {
            if (grouped[q.subject] !== undefined) {
              grouped[q.subject].push(q);
            }
          });
        }
      } catch (e) {
        // Skip missing batch files
      }
    }
    // Fallback: load sample.json if nothing loaded
    const totalQuestions = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);
    if (totalQuestions === 0) {
      try {
        const response = await fetch('sample_questions/sample.json');
        if (response.ok) {
          const data = await response.json();
          data.forEach(q => {
            if (grouped[q.subject]) {
              grouped[q.subject].push(q);
            }
          });
        }
      } catch (e) {
        console.warn('Failed to load sample questions:', e);
      }
    }
    await set(QUESTION_STORE_KEY, grouped);
    questionBank = grouped;
  } else {
    questionBank = stored;
  }
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
  approveFeedback,
  rejectFeedback,
  getFeedbackStats,
  getFeedbackHistory
};
