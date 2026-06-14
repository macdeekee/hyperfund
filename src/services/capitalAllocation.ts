import type { CapitalAllocationMetrics, CurrentMetrics } from '../models/snapshot';

export function calculateCapitalAllocation(metrics: CurrentMetrics): CapitalAllocationMetrics {
  return {
    revenueYield: ratio(metrics.annualizedRevenue, metrics.marketCap),
    buybackYield: ratio(metrics.annualizedBuybacks, metrics.marketCap),
    paybackPeriod: ratio(metrics.marketCap, metrics.annualizedRevenue),
    revenuePerOpenInterest: ratio(metrics.annualizedRevenue, metrics.openInterest),
    revenuePerStablecoinDollar: ratio(metrics.annualizedRevenue, metrics.stablecoinMarketCap)
  };
}

function ratio(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (!isPositive(numerator) || !isPositive(denominator)) return null;
  return numerator / denominator;
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
