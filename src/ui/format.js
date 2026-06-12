import chalk from 'chalk';

export function formatUsd(value, options = {}) {
  if (!isFiniteNumber(value)) {
    return chalk.dim('n/a');
  }

  const compact = options.compact ?? Math.abs(value) >= 100_000;
  const digits = options.digits ?? (Math.abs(value) < 100 ? 2 : 0);

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: digits,
    minimumFractionDigits: options.minimumFractionDigits ?? 0
  }).format(value);
}

export function formatNumber(value, options = {}) {
  if (!isFiniteNumber(value)) {
    return chalk.dim('n/a');
  }

  return new Intl.NumberFormat('en-US', {
    notation: options.compact ? 'compact' : 'standard',
    maximumFractionDigits: options.digits ?? 1
  }).format(value);
}

export function formatPercent(value, options = {}) {
  if (!isFiniteNumber(value)) {
    return chalk.dim('n/a');
  }

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: options.digits ?? 1,
    minimumFractionDigits: options.minimumFractionDigits ?? 0
  }).format(value);
}

export function colorTrend(value, text = formatPercent(value)) {
  if (!isFiniteNumber(value)) {
    return chalk.dim('n/a');
  }

  if (value > 0) {
    return chalk.green(`+${text.replace(/^\+/, '')}`);
  }

  if (value < 0) {
    return chalk.red(text);
  }

  return chalk.dim(text);
}

export function formatDateTime(value) {
  if (!value) {
    return 'n/a';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
