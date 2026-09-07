/** Local calendar-date helpers (device timezone) as `YYYY-MM-DD` strings. */

export function toLocalDateString(input: string | number | Date = new Date()): string {
  const d = new Date(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayLocal(): string {
  return toLocalDateString(new Date());
}

/** Human label like "Sep 3, 2026". */
export function formatDate(input: string | number | Date): string {
  return new Date(input).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(input: string | number | Date): string {
  return new Date(input).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
