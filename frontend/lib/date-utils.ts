/**
 * Date formatting utilities
 * All timestamps from the API are UTC — these helpers convert to local time.
 */

/**
 * Format a UTC timestamp to local date + time
 * e.g. "Jun 27, 2026, 8:39 AM"
 */
export function formatDateTime(utcString: string | null | undefined): string {
  if (!utcString) return '—';
  return new Date(utcString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a UTC timestamp to local date only
 * e.g. "Jun 27, 2026"
 */
export function formatDate(utcString: string | null | undefined): string {
  if (!utcString) return '—';
  return new Date(utcString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a UTC timestamp to local time only
 * e.g. "8:39 AM"
 */
export function formatTime(utcString: string | null | undefined): string {
  if (!utcString) return '—';
  return new Date(utcString).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Relative time — "2 hours ago", "3 days ago"
 */
export function formatRelative(utcString: string | null | undefined): string {
  if (!utcString) return '—';
  const diff = Date.now() - new Date(utcString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24)   return `${hours}h ago`;
  if (days < 7)     return `${days}d ago`;
  return formatDate(utcString);
}
