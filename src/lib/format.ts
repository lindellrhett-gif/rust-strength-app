/** Compact number formatting for stat tiles. */
export function compact(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  return Math.round(n).toLocaleString();
}

/** e.g. 152.5 -> "152.5", 150 -> "150" */
export function trimWeight(n: number): string {
  return Number(n.toFixed(1)).toString();
}
