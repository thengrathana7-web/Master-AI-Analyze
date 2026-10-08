/**
 * Dynamic Timestamp / Date Formatting Helper for Trade Journal
 * 
 * Rules:
 * - Under 24 Hours: display relative time (e.g., 'Just now', '31m ago', '8h 3m ago', '13h 45m ago').
 * - Over 24 Hours: display clean Date string (e.g., '05 Oct 2026' or '05/10/2026').
 */
export function formatTradeTimestamp(timestamp: number | string): string {
  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (!time || isNaN(time)) return 'Just now';

  const diffMs = Date.now() - time;
  const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const oneDayMs = 24 * 60 * 60 * 1000;

  // 1. Under 24 Hours: Relative Time
  if (diffMs < oneDayMs) {
    if (diffMins < 1) return 'Just now';
    if (diffHours < 1) return `${diffMins}m ago`;
    const remMins = diffMins % 60;
    return remMins > 0 ? `${diffHours}h ${remMins}m ago` : `${diffHours}h ago`;
  }

  // 2. Over 24 Hours: Clean Date string (DD MMM YYYY)
  const date = new Date(time);
  const day = date.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}
