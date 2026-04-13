// Checkin Module v2
// Daily score-based checkin system
// Score per day = (practiceCount + 1) * accuracy%
// 100-day total score = sum of daily scores (max 100)

const CHECKIN_DAILY_KEY = 'checkin_daily';      // { 'YYYY-MM-DD': { score, practiced, questionsCount, accuracy } }
const CHECKIN_META_KEY  = 'checkin_meta';       // { firstCheckinDate }

// Call this when a practice session ends to record the session
export async function recordDailySession(sessionQuestions, sessionScore) {
  const today = new Date().toISOString().split('T')[0];
  const daily = await getDailyRecord() || {};
  const existing = daily[today] || { practiced: 0, questionsCount: 0, correct: 0 };

  const addedQuestions = sessionQuestions.length;
  const addedCorrect = sessionScore.correct;
  const newTotalQuestions = existing.questionsCount + addedQuestions;
  const newCorrect = existing.correct + addedCorrect;
  const accuracy = newTotalQuestions > 0 ? newCorrect / newTotalQuestions : 0;
  const score = Math.round((newTotalQuestions + 1) * accuracy);

  daily[today] = { score, practiced: existing.practiced + 1, questionsCount: newTotalQuestions, accuracy };
  await set(CHECKIN_DAILY_KEY, daily);
  return daily[today];
}

// Get all daily records
export async function getDailyRecord() {
  return await get(CHECKIN_DAILY_KEY) || {};
}

// Get last N days of records
export async function getRecentDailyRecords(days = 14) {
  const daily = await getDailyRecord();
  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    result.push({ date: dateStr, label, ...(daily[dateStr] || { score: 0, practiced: 0, questionsCount: 0, accuracy: 0 }) });
  }
  return result;
}

// Total score across all days (capped at 100)
export async function getTotalScore() {
  const daily = await getDailyRecord();
  return Object.values(daily).reduce((sum, d) => sum + (d.score || 0), 0);
}

// Current streak: consecutive days with score > 0 ending today/yesterday
export async function getCheckinStreak() {
  const daily = await getDailyRecord();
  const dates = Object.keys(daily).filter(d => daily[d].score > 0).sort().reverse();
  if (dates.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  let currentDate = new Date(today);

  for (const dateStr of dates) {
    const checkDate = new Date(dateStr);
    checkDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((currentDate - checkDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0 || diffDays === 1) {
      streak++;
      currentDate = checkDate;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// Get checkin meta
export async function getCheckinMeta() {
  return await get(CHECKIN_META_KEY) || {};
}

// Legacy: for compatibility
export async function checkin() {
  const today = new Date().toISOString().split('T')[0];
  const daily = await getDailyRecord();
  if (daily[today]) {
    return { success: false, message: '今日已打卡', streak: await getCheckinStreak() };
  }
  if (Object.keys(daily).length === 0) {
    const meta = await getCheckinMeta() || {};
    meta.firstCheckinDate = today;
    await set(CHECKIN_META_KEY, meta);
  }
  // Score 0 for manual checkin without practice
  daily[today] = { score: 0, practiced: 0, questionsCount: 0, accuracy: 0 };
  await set(CHECKIN_DAILY_KEY, daily);
  return { success: true, message: '打卡成功', streak: await getCheckinStreak() };
}

export async function getCheckinHistory() {
  const daily = await getDailyRecord();
  // Return as { date: true } for compatibility
  const result = {};
  for (const date of Object.keys(daily)) {
    if (daily[date].practiced > 0) result[date] = true;
  }
  return result;
}

export async function getCheckinHistoryList() {
  const daily = await getDailyRecord();
  return Object.keys(daily)
    .filter(d => daily[d].practiced > 0)
    .sort()
    .reverse()
    .map(d => ({ date: d, ...daily[d] }));
}
