import type { BuybackVelocity, CurrentMetrics, FundamentalHealth, Grade, GrowthMetrics } from '../models/snapshot';

export function gradeFromScore(score: number): Grade {
  return {
    score: Math.round(score * 10) / 10,
    grade: letterGrade(score)
  };
}

export function calculateFundamentalHealth({
  currentMetrics,
  growth,
  buybackVelocity,
  revenueYield
}: {
  currentMetrics: CurrentMetrics;
  growth: GrowthMetrics;
  buybackVelocity: BuybackVelocity;
  revenueYield: number | null;
}): FundamentalHealth {
  const revenueHealth = gradeFromScore(scoreRevenue(currentMetrics, revenueYield));
  const buybackHealth = gradeFromScore(scoreBuybacks(currentMetrics, buybackVelocity));
  const growthGrade = gradeFromScore(scoreGrowth(growth));
  const valuation = gradeFromScore(scoreValuation(currentMetrics, revenueYield));
  const liquidity = gradeFromScore(scoreLiquidity(currentMetrics));
  const overall = gradeFromScore(
    revenueHealth.score * 0.24 +
      buybackHealth.score * 0.2 +
      growthGrade.score * 0.22 +
      valuation.score * 0.16 +
      liquidity.score * 0.18
  );

  return {
    revenueHealth,
    buybackHealth,
    growth: growthGrade,
    valuation,
    liquidity,
    overall
  };
}

function scoreRevenue(metrics: CurrentMetrics, revenueYield: number | null) {
  return clamp(scoreByTarget(metrics.annualizedRevenue, 1_000_000_000) * 0.55 + scoreByTarget(revenueYield, 0.06) * 0.45);
}

function scoreBuybacks(metrics: CurrentMetrics, velocity: BuybackVelocity) {
  const buybackRatio =
    positive(metrics.annualizedBuybacks) && positive(metrics.annualizedRevenue)
      ? metrics.annualizedBuybacks / metrics.annualizedRevenue
      : null;
  return clamp(scoreByTarget(buybackRatio, 0.97) * 0.45 + scoreByTarget(velocity.supplyAbsorptionRate, 0.05) * 0.55);
}

function scoreGrowth(growth: GrowthMetrics) {
  const values = [
    growth.revenue30dGrowth,
    growth.buyback30dGrowth,
    growth.stablecoin30dGrowth,
    growth.openInterest30dGrowth,
    growth.volume30dGrowth
  ].filter(positiveOrZero);

  if (!values.length) return 62;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return clamp(55 + average * 140);
}

function scoreValuation(metrics: CurrentMetrics, revenueYield: number | null) {
  const revenueMultiple =
    positive(metrics.marketCap) && positive(metrics.annualizedRevenue)
      ? metrics.marketCap / metrics.annualizedRevenue
      : null;
  const multipleScore = revenueMultiple ? clamp(100 - ((revenueMultiple - 8) / 35) * 65) : 60;
  return clamp(multipleScore * 0.55 + scoreByTarget(revenueYield, 0.05) * 0.45);
}

function scoreLiquidity(metrics: CurrentMetrics) {
  const stableRatio =
    positive(metrics.stablecoinMarketCap) && positive(metrics.marketCap)
      ? metrics.stablecoinMarketCap / metrics.marketCap
      : null;
  const volumeRatio =
    positive(metrics.perpVolume24h) && positive(metrics.marketCap)
      ? metrics.perpVolume24h / metrics.marketCap
      : null;
  return clamp(scoreByTarget(stableRatio, 0.45) * 0.5 + scoreByTarget(volumeRatio, 0.35) * 0.5);
}

function scoreByTarget(value: number | null, target: number) {
  if (!positiveOrZero(value)) return 45;
  return clamp((value / target) * 85);
}

function letterGrade(score: number) {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  return 'D';
}

function positive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function positiveOrZero(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 100);
}
