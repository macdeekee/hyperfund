import type {
  CapitalAllocationMetrics,
  ConfidenceResult,
  CurrentMetrics,
  FairValueResult,
  GrowthMetrics,
  InvestmentThesis
} from '../models/snapshot';

export function buildInvestmentThesis({
  metrics,
  growth,
  capitalAllocation,
  fairValue,
  confidence
}: {
  metrics: CurrentMetrics;
  growth: GrowthMetrics;
  capitalAllocation: CapitalAllocationMetrics;
  fairValue: FairValueResult;
  confidence: ConfidenceResult;
}): InvestmentThesis {
  const bull: string[] = [];
  const bear: string[] = [];
  const base: string[] = [];

  if (isGreater(growth.revenue30dGrowth, 0.15)) bull.push(`Revenue growth is accelerating at ${formatPct(growth.revenue30dGrowth)} over 30 days.`);
  if (isGreater(capitalAllocation.buybackYield, 0.05)) bull.push(`Buyback yield is above 5% at ${formatPct(capitalAllocation.buybackYield)}.`);
  if (isGreater(growth.stablecoin30dGrowth, 0.05)) bull.push(`Stablecoin base is expanding at ${formatPct(growth.stablecoin30dGrowth)} over 30 days.`);
  if (isGreater(capitalAllocation.revenueYield, 0.05)) bull.push(`Revenue yield is above 5% at ${formatPct(capitalAllocation.revenueYield)}.`);

  if (isLess(growth.revenue30dGrowth, 0)) bear.push(`Revenue growth is negative at ${formatPct(growth.revenue30dGrowth)} over 30 days.`);
  if (isLess(growth.buyback30dGrowth, 0)) bear.push(`Buybacks are declining at ${formatPct(growth.buyback30dGrowth)} over 30 days.`);
  if (isLess(growth.stablecoin30dGrowth, 0)) bear.push(`Stablecoin market cap is contracting at ${formatPct(growth.stablecoin30dGrowth)} over 30 days.`);
  if (isLess(growth.volume30dGrowth, 0)) bear.push(`Perp volume is declining at ${formatPct(growth.volume30dGrowth)} over 30 days.`);

  const revenueMultiple =
    isPositive(metrics.marketCap) && isPositive(metrics.annualizedRevenue)
      ? metrics.marketCap / metrics.annualizedRevenue
      : null;
  if (isFiniteNumber(revenueMultiple)) base.push(`Current valuation is ${revenueMultiple.toFixed(1)}x annualized revenue.`);
  if (isFiniteNumber(fairValue.composite.discount)) {
    base.push(`Composite model shows ${fairValue.composite.discount >= 0 ? 'a discount' : 'a premium'} of ${formatPct(Math.abs(fairValue.composite.discount))}.`);
  }
  base.push(`${confidence.label} confidence based on ${confidence.observationCount} stored observations.`);

  if (!bull.length) bull.push('No confirmed bull-case growth or capital-return triggers are available from current measurable data.');
  if (!bear.length) bear.push('No confirmed bear-case contraction triggers are available from current measurable data.');

  return { bull, base, bear };
}

function isGreater(value: number | null, threshold: number) {
  return isFiniteNumber(value) && value > threshold;
}

function isLess(value: number | null, threshold: number) {
  return isFiniteNumber(value) && value < threshold;
}

function formatPct(value: number | null) {
  if (!isFiniteNumber(value)) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
