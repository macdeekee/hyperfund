import type { CurrentMetrics, GrowthMetrics, ResearchSignal } from '../models/snapshot';

export function buildSignalSet({
  growth,
  revenueYield,
  currentMetrics
}: {
  growth: GrowthMetrics;
  revenueYield: number | null;
  currentMetrics: CurrentMetrics;
}): ResearchSignal[] {
  const signals: ResearchSignal[] = [];

  if (isGreater(growth.revenue30dGrowth, 0.15)) {
    signals.push(bullish('Revenue accelerating', `30d revenue growth is ${formatPercent(growth.revenue30dGrowth)}`));
  }
  if (isGreater(growth.buyback30dGrowth, 0.1)) {
    signals.push(bullish('Buyback velocity increasing', `30d buyback growth is ${formatPercent(growth.buyback30dGrowth)}`));
  }
  if (isGreater(growth.stablecoin30dGrowth, 0.05)) {
    signals.push(bullish('Stablecoin base expanding', `30d stablecoin growth is ${formatPercent(growth.stablecoin30dGrowth)}`));
  }
  if (isGreater(revenueYield, 0.05)) {
    signals.push(bullish('Revenue yield above benchmark', `Revenue yield is ${formatPercent(revenueYield)}`));
  }

  if (isLess(growth.revenue30dGrowth, 0)) {
    signals.push(warning('Revenue decelerating', `30d revenue growth is ${formatPercent(growth.revenue30dGrowth)}`));
  }
  if (isLess(growth.buyback30dGrowth, 0)) {
    signals.push(warning('Buybacks declining', `30d buyback growth is ${formatPercent(growth.buyback30dGrowth)}`));
  }
  if (isLess(growth.stablecoin30dGrowth, 0)) {
    signals.push(warning('Stablecoin base contracting', `30d stablecoin growth is ${formatPercent(growth.stablecoin30dGrowth)}`));
  }
  if (isLess(growth.openInterest30dGrowth, 0)) {
    signals.push(warning('Open interest declining', `30d open interest growth is ${formatPercent(growth.openInterest30dGrowth)}`));
  }

  const revenueMultiple =
    isPositive(currentMetrics.marketCap) && isPositive(currentMetrics.annualizedRevenue)
      ? currentMetrics.marketCap / currentMetrics.annualizedRevenue
      : null;
  if (isGreater(revenueMultiple, 25)) {
    signals.push(warning('Revenue multiple elevated', `${revenueMultiple?.toFixed(1)}x revenue multiple`));
  }

  if (!signals.length) {
    signals.push({
      severity: 'warning',
      label: 'Insufficient trend history',
      detail: 'More daily snapshots are needed for stronger research signals.'
    });
  }

  return signals;
}

function bullish(label: string, detail: string): ResearchSignal {
  return { severity: 'bullish', label, detail };
}

function warning(label: string, detail: string): ResearchSignal {
  return { severity: 'warning', label, detail };
}

function isGreater(value: number | null, threshold: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > threshold;
}

function isLess(value: number | null, threshold: number) {
  return typeof value === 'number' && Number.isFinite(value) && value < threshold;
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function formatPercent(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}
