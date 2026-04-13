
export function getDateRange(filter, customStart, customEnd) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (filter === 'this_month') return { start: new Date(y, m, 1), end: new Date(y, m+1, 0) };
  if (filter === 'last_month') return { start: new Date(y, m-1, 1), end: new Date(y, m, 0) };
  if (filter === 'this_quarter') {
    const q = Math.floor(m / 3);
    return { start: new Date(y, q*3, 1), end: new Date(y, q*3+3, 0) };
  }
  if (filter === 'this_year') return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
  if (filter === 'custom' && customStart && customEnd) return { start: new Date(customStart), end: new Date(customEnd) };
  return null;
}

export function filterByDate(entries, filter, customStart, customEnd) {
  const range = getDateRange(filter, customStart, customEnd);
  if (!range) return entries;
  return entries.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d >= range.start && d <= range.end;
  });
}