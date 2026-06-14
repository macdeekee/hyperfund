import { AQA_SCENARIOS, DEFAULT_AQA_REVENUE_MULTIPLE, FAIR_VALUE_DEFAULTS } from '../config/assumptions';
import type { AQAValuation, AQAValuationScenario, CurrentMetrics } from '../models/snapshot';

export function calculateAqaValuation(metrics: CurrentMetrics): AQAValuation {
  const scenarios = AQA_SCENARIOS.map(scenario => calculateScenario(metrics, {
    name: scenario.name,
    additionalRevenue: scenario.additionalRevenue,
    expectedMargin: scenario.expectedMargin ?? 0.75
  }));

  return {
    scenarios,
    distribution: buildDistribution(metrics, scenarios)
  };
}

function calculateScenario(
  metrics: CurrentMetrics,
  scenario: { name: string; additionalRevenue: number; expectedMargin: number }
): AQAValuationScenario {
  const incrementalProtocolRevenue = scenario.additionalRevenue * scenario.expectedMargin;
  const incrementalBuybacks = incrementalProtocolRevenue * FAIR_VALUE_DEFAULTS.buybackRatio;
  const additionalNetworkValue = incrementalProtocolRevenue * DEFAULT_AQA_REVENUE_MULTIPLE;
  const additionalFairValuePerHype =
    isPositive(metrics.circulatingSupply)
      ? additionalNetworkValue / metrics.circulatingSupply
      : null;
  const impliedHypePrice =
    isFiniteNumber(metrics.hypePrice) && isFiniteNumber(additionalFairValuePerHype)
      ? metrics.hypePrice + additionalFairValuePerHype
      : null;

  return {
    name: scenario.name,
    aqav2RevenueEstimate: metrics.aqav2EstimatedRevenue,
    incrementalRevenue: scenario.additionalRevenue,
    incrementalBuybacks,
    expectedMargin: scenario.expectedMargin,
    additionalNetworkValue,
    additionalFairValuePerHype,
    impliedHypePrice
  };
}

function buildDistribution(metrics: CurrentMetrics, scenarios: AQAValuationScenario[]) {
  const bear = scenarios.find(scenario => scenario.name === 'Bear');
  const base = scenarios.find(scenario => scenario.name === 'Base');
  const bull = scenarios.find(scenario => scenario.name === 'Bull');
  if (!bear || !base || !bull) return [];

  return Array.from({ length: 19 }, (_, index) => {
    const percentile = 5 + index * 5;
    const value = percentile <= 50
      ? interpolate(bear.additionalFairValuePerHype, base.additionalFairValuePerHype, percentile / 50)
      : interpolate(base.additionalFairValuePerHype, bull.additionalFairValuePerHype, (percentile - 50) / 50);

    return {
      percentile,
      additionalFairValuePerHype: isFiniteNumber(metrics.circulatingSupply) ? value : null
    };
  });
}

function interpolate(start: number | null, end: number | null, ratio: number) {
  if (!isFiniteNumber(start) || !isFiniteNumber(end)) return null;
  return start + (end - start) * ratio;
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
