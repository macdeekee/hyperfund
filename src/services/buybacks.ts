import type { BuybackVelocity, CurrentMetrics } from '../models/snapshot';

export function calculateBuybackVelocity(metrics: CurrentMetrics): BuybackVelocity {
  const annualHypePurchased =
    isPositive(metrics.annualizedBuybacks) && isPositive(metrics.hypePrice)
      ? metrics.annualizedBuybacks / metrics.hypePrice
      : null;
  const supplyAbsorptionRate =
    isPositive(annualHypePurchased) && isPositive(metrics.circulatingSupply)
      ? annualHypePurchased / metrics.circulatingSupply
      : null;
  const daysToBuyOnePercent =
    isPositive(annualHypePurchased) && isPositive(metrics.circulatingSupply)
      ? (metrics.circulatingSupply * 0.01) / (annualHypePurchased / 365)
      : null;

  return {
    annualHypePurchased,
    supplyAbsorptionRate,
    daysToBuyOnePercent,
    buybacksLast24h: finiteOrNull(metrics.dailyBuybackUSD),
    buybacksLast30d: finiteOrNull(metrics.buybacks30d)
  };
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function finiteOrNull(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
