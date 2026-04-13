function pad(value) {
  return String(value).padStart(2, '0');
}

export function getLocalDateKey(date = new Date()) {
  const local = new Date(date);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

export function getDateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function shiftDate(date, offsetDays) {
  const shifted = new Date(date);
  shifted.setHours(12, 0, 0, 0);
  shifted.setDate(shifted.getDate() + offsetDays);
  return shifted;
}

export function listRecentDateKeys(days, endDate = new Date()) {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    keys.push(getLocalDateKey(shiftDate(endDate, -i)));
  }
  return keys;
}

export function formatDateKeyLabel(key) {
  const date = getDateFromKey(key);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatDateKeyShort(key) {
  const date = getDateFromKey(key);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
