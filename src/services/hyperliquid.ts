import { AQA_SCENARIOS, DEFAULT_AQA_REVENUE_MULTIPLE, FAIR_VALUE_DEFAULTS, SUPPLY_ASSUMPTIONS } from '../config/assumptions';
import type { CurrentMetrics, Snapshot, ValuationAnalysis } from '../models/snapshot';
import { buildSignalSet } from '../signals/signalEngine';
import { calculateAqaValuation } from './aqa';
import { calculateAttribution } from './attribution';
import { calculateBuybackVelocity } from './buybacks';
import { calculateCapitalAllocation } from './capitalAllocation';
import { calculateConfidence } from './confidence';
import { calculateFairValue } from './fairvalue';
import { calculateGrowthMetrics } from './growth';
import { calculateRetirementEngine } from './retirement';
import { buildInvestmentThesis } from './thesis';
import { buildTransparency } from './transparency';
import { calculateAQAImpact, compareRevenueYield, inferCirculatingSupply, buildExchangeComparables } from './valuation';
import { calculateFundamentalHealth } from './health';

export function normalizeCurrentMetrics(rawSnapshot: any): CurrentMetrics {
  const metrics = rawSnapshot?.metrics ?? {};
  const hypePrice = finite(metrics.price);
  const marketCap = finite(metrics.marketCap);
  const circulatingSupply = inferCirculatingSupply(hypePrice, marketCap, SUPPLY_ASSUMPTIONS.circulatingSupply);

  return {
    hypePrice,
    marketCap,
    annualizedRevenue: finite(metrics.annualizedRevenue),
    annualizedBuybacks: finite(metrics.buybacksAnnualized),
    stablecoinMarketCap: finite(metrics.stablecoinMarketCap),
    openInterest: finite(metrics.totalOpenInterestUsd),
    perpVolume24h: finite(metrics.totalPerpVolume24h),
    aqav2EstimatedRevenue: finite(metrics.aqav2AnnualizedRevenue),
    dailyBuybackUSD: finite(metrics.buybacks24h),
    buybacks30d: finite(metrics.revenue30d),
    circulatingSupply,
    totalSupply: SUPPLY_ASSUMPTIONS.totalSupply
  };
}

export function normalizeSnapshot(rawSnapshot: any): Snapshot {
  const metrics = rawSnapshot?.metrics ?? {};
  const revenueYield =
    isPositive(metrics.annualizedRevenue) && isPositive(metrics.marketCap)
      ? metrics.annualizedRevenue / metrics.marketCap
      : null;

  return {
    timestamp: new Date(rawSnapshot?.capturedAt ?? rawSnapshot?.date ?? Date.now()).getTime(),
    date: rawSnapshot?.date ?? new Date().toISOString().slice(0, 10),
    revenue: finite(metrics.annualizedRevenue),
    buybacks: finite(metrics.buybacksAnnualized),
    stablecoins: finite(metrics.stablecoinMarketCap),
    openInterest: finite(metrics.totalOpenInterestUsd),
    volume: finite(metrics.totalPerpVolume24h),
    marketCap: finite(metrics.marketCap),
    hypePrice: finite(metrics.price),
    revenueYield
  };
}

export function buildValuationAnalysis(rawSnapshot: any, rawHistory: any[] = []): ValuationAnalysis {
  const currentMetrics = normalizeCurrentMetrics(rawSnapshot);
  const snapshots = normalizeHistory(rawSnapshot, rawHistory);
  const growth = calculateGrowthMetrics(snapshots);
  const buybackVelocity = calculateBuybackVelocity(currentMetrics);
  const retirement = calculateRetirementEngine(currentMetrics);
  const capitalAllocation = calculateCapitalAllocation(currentMetrics);
  const aqaImpact = calculateAQAImpact(currentMetrics, AQA_SCENARIOS, DEFAULT_AQA_REVENUE_MULTIPLE);
  const aqaValuation = calculateAqaValuation(currentMetrics);
  const revenueYield = compareRevenueYield(currentMetrics);
  const exchangeComparables = buildExchangeComparables(currentMetrics);
  const health = calculateFundamentalHealth({
    currentMetrics,
    growth,
    buybackVelocity,
    revenueYield: revenueYield.hyperliquid
  });
  const fairValue = calculateFairValue({
    annualRevenue: currentMetrics.annualizedRevenue,
    annualBuybacks: currentMetrics.annualizedBuybacks,
    circulatingSupply: currentMetrics.circulatingSupply,
    currentPrice: currentMetrics.hypePrice,
    ...FAIR_VALUE_DEFAULTS
  });
  const confidence = calculateConfidence({
    metrics: currentMetrics,
    snapshots,
    sourceStatus: rawSnapshot?.sourceStatus,
    currentTimestamp: snapshots.at(-1)?.timestamp
  });
  const attribution = calculateAttribution({ metrics: currentMetrics, growth, capitalAllocation });
  const thesis = buildInvestmentThesis({ metrics: currentMetrics, growth, capitalAllocation, fairValue, confidence });
  const transparency = buildTransparency(fairValue);
  const signals = buildSignalSet({ growth, revenueYield: revenueYield.hyperliquid, currentMetrics });

  return {
    currentMetrics,
    growth,
    buybackVelocity,
    retirement,
    capitalAllocation,
    aqaImpact,
    aqaValuation,
    revenueYield,
    exchangeComparables,
    health,
    fairValue,
    confidence,
    attribution,
    thesis,
    transparency,
    dataWarnings: buildDataWarnings(growth, confidence),
    signals,
    snapshots
  };
}

export function normalizeHistory(rawSnapshot: any, rawHistory: any[] = []) {
  const normalized = rawHistory.map(normalizeSnapshot);
  const latest = normalizeSnapshot(rawSnapshot);
  const withoutCurrent = normalized.filter(snapshot => snapshot.date !== latest.date);
  return [...withoutCurrent, latest].sort((a, b) => a.timestamp - b.timestamp);
}

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function buildDataWarnings(growth: ReturnType<typeof calculateGrowthMetrics>, confidence: ReturnType<typeof calculateConfidence>) {
  const warnings: string[] = [];

  if (Object.values(growth).some(value => value === null)) {
    warnings.push('Some growth metrics are unavailable because local history does not cover the required lookback period.');
  }

  for (const penalty of confidence.penalties) {
    warnings.push(penalty.reason);
  }

  return warnings;
}
