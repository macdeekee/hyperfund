import { ATTRIBUTION_WEIGHTS } from '../config/assumptions';
import type { AttributionFactor, CapitalAllocationMetrics, CurrentMetrics, GrowthMetrics } from '../models/snapshot';

export function calculateAttribution({
  metrics,
  growth,
  capitalAllocation
}: {
  metrics: CurrentMetrics;
  growth: GrowthMetrics;
  capitalAllocation: CapitalAllocationMetrics;
}): AttributionFactor[] {
  const stablecoinLiquidity = ratio(metrics.stablecoinMarketCap, metrics.marketCap);
  const revenueMultiple = ratio(metrics.marketCap, metrics.annualizedRevenue);
  const activity = ratio(metrics.perpVolume24h, metrics.marketCap);

  return [
    factor({
      id: 'stablecoinLiquidity',
      label: 'Stablecoin Liquidity Score',
      rawValue: stablecoinLiquidity,
      rawFormat: 'percent',
      normalizedScore: scoreByTarget(stablecoinLiquidity, 0.35),
      weight: ATTRIBUTION_WEIGHTS.stablecoinLiquidity,
      methodology: 'stablecoin market cap / network market cap'
    }),
    factor({
      id: 'buybackYield',
      label: 'Buyback Yield Score',
      rawValue: capitalAllocation.buybackYield,
      rawFormat: 'percent',
      normalizedScore: scoreByTarget(capitalAllocation.buybackYield, 0.05),
      weight: ATTRIBUTION_WEIGHTS.buybackYield,
      methodology: 'annual buybacks / network market cap'
    }),
    factor({
      id: 'revenueMultiple',
      label: 'Revenue Multiple Score',
      rawValue: revenueMultiple,
      rawFormat: 'multiple',
      normalizedScore: scoreRevenueMultiple(revenueMultiple),
      weight: ATTRIBUTION_WEIGHTS.revenueMultiple,
      methodology: 'network market cap / annualized revenue; lower is better'
    }),
    factor({
      id: 'activity',
      label: 'Activity Score',
      rawValue: activity,
      rawFormat: 'percent',
      normalizedScore: scoreByTarget(activity, 0.25),
      weight: ATTRIBUTION_WEIGHTS.activity,
      methodology: '24h perp volume / network market cap'
    }),
    factor({
      id: 'growth',
      label: 'Growth Score',
      rawValue: growth.revenue30dGrowth,
      rawFormat: 'percent',
      normalizedScore: scoreGrowth(growth.revenue30dGrowth),
      weight: ATTRIBUTION_WEIGHTS.growth,
      methodology: '30d annualized revenue growth when sufficient history exists'
    })
  ];
}

function factor(input: Omit<AttributionFactor, 'contribution'>): AttributionFactor {
  return {
    ...input,
    contribution: isFiniteNumber(input.normalizedScore) ? input.normalizedScore * input.weight : null
  };
}

function scoreByTarget(value: number | null, target: number) {
  if (!isFiniteNumber(value) || target <= 0) return null;
  return clamp((value / target) * 100);
}

function scoreRevenueMultiple(value: number | null) {
  if (!isFiniteNumber(value) || value <= 0) return null;
  if (value <= 10) return 100;
  if (value >= 40) return 20;
  return clamp(100 - ((value - 10) / 30) * 80);
}

function scoreGrowth(value: number | null) {
  if (!isFiniteNumber(value)) return null;
  return clamp(50 + value * 200);
}

function ratio(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (!isPositive(numerator) || !isPositive(denominator)) return null;
  return numerator / denominator;
}

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
