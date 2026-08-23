import { getLocalDateKey, listRecentDateKeys, formatDateKeyLabel, formatDateKeyShort, shiftDate } from './date-utils.mjs';

export function todayKey() {
  return getLocalDateKey();
}
export function dateLabel(iso) {
  return formatDateKeyLabel(iso);
}
export function getWeekDays() {
  return listRecentDateKeys(7).reverse();
}
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function subjectName(subj) {
  return { math:'数学', chinese:'语文', english:'英语', physics:'物理', chemistry:'化学',
    biology:'生物', history:'历史', geography:'地理', politics:'道法' }[subj] || subj;
}
export function showToast(msg, duration) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, duration || 2500);
}
export function escapeHTML(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
export function compareVersion(a, b) {
  const parse = v => {
    const core = String(v || '0.0.0').split('-')[0];
    const parts = core.split('.').map(Number);
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
  };
  const va = parse(a), vb = parse(b);
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  if (va.patch !== vb.patch) return va.patch - vb.patch;
  return 0;
}
export function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$+([^$\n]+)\$+/g, '$1')
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+[\u4e00-\u9fa5a-zA-Z0-9].*/gm, m => m.replace(/^#{1,6}\s+/, ''))
    .replace(/\*\*\s*([^*]+?)\s*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_(?![*])([^_]+)_(?![*_])/g, '$1')
    .replace(/^[-*+]\s+(?=[^\n])/gm, '· ')
    .replace(/^\d+\.\s+(?=[^\n])/gm, '· ')
    .replace(/^---\s*$/gm, '')
    .replace(/---/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
export function normalizeAnswerText(value) {
  return String(value)
    .replace(/^"(.*)"$/, '$1')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[，、；;]/g, ',')
    .trim();
}
export function splitAnswerParts(value) {
  return normalizeAnswerText(value)
    .split(/[,\n/|]+/)
    .map(part => part.trim())
    .filter(Boolean);
}
export function formatAnswerForDisplay(answer) {
  return Array.isArray(answer) ? answer.join('，') : answer;
}
export function isAnswerMatch(userAnswer, correctAnswer, question = null) {
  const normalizedUser = normalizeAnswerText(userAnswer);
  if (question?.acceptAnswers?.length) {
    return question.acceptAnswers.some(answer => isAnswerMatch(userAnswer, answer));
  }
  if (Array.isArray(correctAnswer)) {
    const expected = correctAnswer.map(item => normalizeAnswerText(item));
    const joinCandidates = [
      expected.join(','),
      expected.join(' '),
      expected.join('/'),
    ];
    if (joinCandidates.includes(normalizedUser)) return true;
    const userParts = splitAnswerParts(userAnswer);
    if (userParts.length === expected.length && userParts.every((part, index) => part === expected[index])) {
      return true;
    }
    return expected.every(part => normalizedUser.includes(part));
  }
  if (question?.keywords?.length) {
    return question.keywords.every(keyword => normalizedUser.includes(normalizeAnswerText(keyword)));
  }
  const normalizedAnswer = normalizeAnswerText(correctAnswer);
  return normalizedUser === normalizedAnswer
    || normalizedUser === normalizedAnswer.replace(/\s+/g, '')
    || userAnswer === String(correctAnswer)
    || normalizedUser.startsWith(normalizedAnswer.replace(/\s+/g, ''));
}
export { getLocalDateKey, formatDateKeyLabel };
