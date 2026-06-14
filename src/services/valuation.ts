import { DEFAULT_AQA_REVENUE_MULTIPLE } from '../config/assumptions';
import { EXCHANGE_COMPARABLES, REVENUE_YIELD_BENCHMARKS } from '../config/benchmarks';
import type { AQAScenario, AQAImpact, CurrentMetrics, ExchangeComparable } from '../models/snapshot';

export function calculateRevenueYield(annualRevenue: number | null, marketCap: number | null) {
  if (!isPositive(annualRevenue) || !isPositive(marketCap)) return null;
  return annualRevenue / marketCap;
}

export function compareRevenueYield(metrics: CurrentMetrics) {
  return {
    hyperliquid: calculateRevenueYield(metrics.annualizedRevenue, metrics.marketCap),
    comparisons: REVENUE_YIELD_BENCHMARKS
  };
}

export function buildExchangeComparables(metrics: CurrentMetrics): ExchangeComparable[] {
  const hyperliquidRevenueYield = calculateRevenueYield(metrics.annualizedRevenue, metrics.marketCap);
  const hyperliquidMultiple =
    isPositive(metrics.marketCap) && isPositive(metrics.annualizedRevenue)
      ? metrics.marketCap / metrics.annualizedRevenue
      : null;
  const hyperliquidBuybackYield =
    isPositive(metrics.annualizedBuybacks) && isPositive(metrics.marketCap)
      ? metrics.annualizedBuybacks / metrics.marketCap
      : null;

  return [
    {
      name: 'Hyperliquid',
      revenueYield: hyperliquidRevenueYield,
      valuationMultiple: hyperliquidMultiple,
      growthRate: null,
      buybackYield: hyperliquidBuybackYield
    },
    ...EXCHANGE_COMPARABLES
  ];
}

export function calculateAQAImpact(
  metrics: CurrentMetrics,
  scenarios: AQAScenario[],
  selectedRevenueMultiple = DEFAULT_AQA_REVENUE_MULTIPLE
): AQAImpact[] {
  return scenarios.map(scenario => {
    const newRevenue = isPositive(metrics.annualizedRevenue)
      ? metrics.annualizedRevenue + scenario.additionalRevenue
      : null;
    const impliedMarketCap = isPositive(newRevenue) ? newRevenue * selectedRevenueMultiple : null;
    const impliedHypePrice =
      isPositive(impliedMarketCap) && isPositive(metrics.circulatingSupply)
        ? impliedMarketCap / metrics.circulatingSupply
        : null;

    return {
      name: scenario.name,
      additionalRevenue: scenario.additionalRevenue,
      newRevenue,
      impliedMarketCap,
      impliedHypePrice
    };
  });
}

export function inferCirculatingSupply(price: number | null, marketCap: number | null, fallback: number) {
  if (isPositive(price) && isPositive(marketCap)) {
    return marketCap / price;
  }

  return fallback;
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
