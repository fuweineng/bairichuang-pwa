// Checkin Module
// Uses idb-keyval for IndexedDB storage

const CHECKIN_HISTORY_KEY = 'checkin_history';

// Format: { 'YYYY-MM-DD': true }

async function checkin() {
  const today = new Date().toISOString().split('T')[0];
  const history = await getCheckinHistory();
  
  if (history[today]) {
    return { success: false, message: '今日已打卡', streak: await getCheckinStreak() };
  }

  history[today] = true;
  await set(CHECKIN_HISTORY_KEY, history);
  
  return { success: true, message: '打卡成功', streak: await getCheckinStreak() };
}

async function getCheckinHistory() {
  const history = await get(CHECKIN_HISTORY_KEY);
  return history || {};
}

async function getCheckinStreak() {
  const history = await getCheckinHistory();
  const dates = Object.keys(history).sort().reverse();
  
  if (dates.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (const dateStr of dates) {
    const checkDate = new Date(dateStr);
    checkDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((currentDate - checkDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0 || diffDays === 1) {
      streak++;
      currentDate = checkDate;
    } else {
      break;
    }
  }

  return streak;
}

async function getCheckinHistoryList() {
  const history = await getCheckinHistory();
  return Object.entries(history)
    .map(([date, checked]) => ({ date, checked }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export {
  checkin,
  getCheckinStreak,
  getCheckinHistory,
  getCheckinHistoryList
};
