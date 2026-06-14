export function usd(value: number | null | undefined, options: Intl.NumberFormatOptions = {}) {
  if (!isNumber(value)) return 'n/a';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(value) >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 100_000 ? 1 : 2,
    ...options
  }).format(value);
}

export function number(value: number | null | undefined, options: Intl.NumberFormatOptions = {}) {
  if (!isNumber(value)) return 'n/a';

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    ...options
  }).format(value);
}

export function pct(value: number | null | undefined, options: Intl.NumberFormatOptions = {}) {
  if (!isNumber(value)) return 'n/a';

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
    ...options
  }).format(value);
}

export function signedPct(value: number | null | undefined) {
  if (!isNumber(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${pct(value)}`;
}

export function compactDate(value: string | Date | null | undefined) {
  if (!value) return 'n/a';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
}

export function dateTime(value: string | Date | null | undefined) {
  if (!value) return 'n/a';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export function valueClass(value: number | null | undefined) {
  if (!isNumber(value)) return 'muted';
  if (value > 0.05) return 'positive';
  if (value < -0.05) return 'negative';
  return 'neutral';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
