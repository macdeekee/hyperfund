import type { AQAScenario } from '../models/snapshot';

export const SUPPLY_ASSUMPTIONS = {
  circulatingSupply: 333_928_180,
  totalSupply: 1_000_000_000
};

export const AQA_SCENARIOS: AQAScenario[] = [
  { name: 'Bear', additionalRevenue: 100_000_000, expectedMargin: 0.65 },
  { name: 'Base', additionalRevenue: 292_000_000, expectedMargin: 0.75 },
  { name: 'Bull', additionalRevenue: 600_000_000, expectedMargin: 0.8 }
];

export const FAIR_VALUE_DEFAULTS = {
  growthRate: 0.4,
  buybackRatio: 0.97,
  revenueMultiple: 20,
  targetBuybackYield: 0.05,
  terminalMultiple: 20,
  discountRate: 0.12
};

export const DEFAULT_AQA_REVENUE_MULTIPLE = 20;

export const FAIR_VALUE_WEIGHTS = {
  revenueMultiple: 0.4,
  buybackYield: 0.4,
  dcf: 0.2
};

export const RETIREMENT_ASSUMPTIONS = {
  projectionYears: [5, 10, 15],
  revenueCagrScenarios: {
    constantRevenue: 0,
    revenueUp20: 0.2,
    revenueDown20: -0.2
  }
};

export const ATTRIBUTION_WEIGHTS = {
  stablecoinLiquidity: 0.2,
  buybackYield: 0.25,
  revenueMultiple: 0.2,
  activity: 0.15,
  growth: 0.2
};
