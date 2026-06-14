import { FAIR_VALUE_DEFAULTS, RETIREMENT_ASSUMPTIONS } from '../config/assumptions';
import type { CurrentMetrics, RetirementEngine, RetirementProjectionPoint } from '../models/snapshot';

export function calculateRetirementEngine(metrics: CurrentMetrics): RetirementEngine {
  const annualBuybacks = annualBuybacksFor(metrics);
  const annualHypePurchased =
    isPositive(annualBuybacks) && isPositive(metrics.hypePrice)
      ? annualBuybacks / metrics.hypePrice
      : null;
  const annualSupplyRetiredPct =
    isPositive(annualHypePurchased) && isPositive(metrics.circulatingSupply)
      ? annualHypePurchased / metrics.circulatingSupply
      : null;
  const daysToRetireOnePercent =
    isPositive(annualHypePurchased) && isPositive(metrics.circulatingSupply)
      ? (metrics.circulatingSupply * 0.01) / (annualHypePurchased / 365)
      : null;
  const projections = buildProjection(metrics);

  return {
    annualHypePurchased,
    annualSupplyRetiredPct,
    daysToRetireOnePercent,
    remainingSupply5Y: projectionAt(projections, 5, 'constantRevenue'),
    remainingSupply10Y: projectionAt(projections, 10, 'constantRevenue'),
    remainingSupply15Y: projectionAt(projections, 15, 'constantRevenue'),
    projections
  };
}

function buildProjection(metrics: CurrentMetrics): RetirementProjectionPoint[] {
  return Array.from({ length: 15 }, (_, index) => {
    const year = index + 1;

    return {
      year,
      constantRevenue: remainingSupply(metrics, year, RETIREMENT_ASSUMPTIONS.revenueCagrScenarios.constantRevenue),
      revenueUp20: remainingSupply(metrics, year, RETIREMENT_ASSUMPTIONS.revenueCagrScenarios.revenueUp20),
      revenueDown20: remainingSupply(metrics, year, RETIREMENT_ASSUMPTIONS.revenueCagrScenarios.revenueDown20)
    };
  });
}

function remainingSupply(metrics: CurrentMetrics, years: number, revenueCagr: number) {
  if (!isPositive(metrics.circulatingSupply) || !isPositive(metrics.hypePrice)) return null;

  let remaining = metrics.circulatingSupply;
  for (let year = 1; year <= years; year += 1) {
    const buybacks = annualBuybacksFor(metrics, year, revenueCagr);
    if (!isPositive(buybacks)) return null;
    remaining = Math.max(0, remaining - buybacks / metrics.hypePrice);
  }

  return remaining / metrics.circulatingSupply;
}

function annualBuybacksFor(metrics: CurrentMetrics, year = 1, revenueCagr = 0) {
  if (isPositive(metrics.annualizedBuybacks)) {
    if (!isPositive(metrics.annualizedRevenue)) return metrics.annualizedBuybacks;
    const baseRatio = metrics.annualizedBuybacks / metrics.annualizedRevenue;
    return metrics.annualizedRevenue * Math.pow(1 + revenueCagr, year - 1) * baseRatio;
  }

  if (isPositive(metrics.annualizedRevenue)) {
    return metrics.annualizedRevenue * Math.pow(1 + revenueCagr, year - 1) * FAIR_VALUE_DEFAULTS.buybackRatio;
  }

  return null;
}

function projectionAt(
  projections: RetirementProjectionPoint[],
  year: number,
  key: keyof Pick<RetirementProjectionPoint, 'constantRevenue' | 'revenueUp20' | 'revenueDown20'>
) {
  return projections.find(point => point.year === year)?.[key] ?? null;
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
