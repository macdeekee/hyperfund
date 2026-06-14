export interface CurrentMetrics {
  hypePrice: number | null;
  marketCap: number | null;
  annualizedRevenue: number | null;
  annualizedBuybacks: number | null;
  stablecoinMarketCap: number | null;
  openInterest: number | null;
  perpVolume24h: number | null;
  aqav2EstimatedRevenue: number | null;
  dailyBuybackUSD: number | null;
  buybacks30d: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
}

export interface Snapshot {
  timestamp: number;
  date: string;
  revenue: number | null;
  buybacks: number | null;
  stablecoins: number | null;
  openInterest: number | null;
  volume: number | null;
  marketCap: number | null;
  hypePrice: number | null;
  revenueYield: number | null;
}

export interface GrowthMetrics {
  revenue7dGrowth: number | null;
  revenue30dGrowth: number | null;
  revenue90dGrowth: number | null;
  buyback7dGrowth: number | null;
  buyback30dGrowth: number | null;
  stablecoin7dGrowth: number | null;
  stablecoin30dGrowth: number | null;
  openInterest7dGrowth: number | null;
  openInterest30dGrowth: number | null;
  volume7dGrowth: number | null;
  volume30dGrowth: number | null;
}

export interface BuybackVelocity {
  annualHypePurchased: number | null;
  supplyAbsorptionRate: number | null;
  daysToBuyOnePercent: number | null;
  buybacksLast24h: number | null;
  buybacksLast30d: number | null;
}

export interface AQAScenario {
  name: string;
  additionalRevenue: number;
  expectedMargin?: number;
  incrementalBuybacks?: number;
}

export interface AQAImpact {
  name: string;
  additionalRevenue: number;
  newRevenue: number | null;
  impliedMarketCap: number | null;
  impliedHypePrice: number | null;
}

export interface RevenueYieldComparison {
  name: string;
  revenueYield: number;
}

export interface ExchangeComparable {
  name: string;
  revenueYield: number | null;
  valuationMultiple: number | null;
  growthRate: number | null;
  buybackYield: number | null;
}

export interface Grade {
  score: number;
  grade: string;
}

export interface FundamentalHealth {
  revenueHealth: Grade;
  buybackHealth: Grade;
  growth: Grade;
  valuation: Grade;
  liquidity: Grade;
  overall: Grade;
}

export interface FairValueInputs {
  annualRevenue: number | null;
  annualBuybacks: number | null;
  growthRate: number;
  buybackRatio: number;
  revenueMultiple: number;
  targetBuybackYield: number;
  terminalMultiple: number;
  discountRate: number;
  circulatingSupply: number | null;
  currentPrice: number | null;
}

export interface ValuationModelResult {
  id: 'revenueMultiple' | 'buybackYield' | 'dcf';
  name: string;
  formula: string;
  fairValue: number | null;
  impliedMarketCap: number | null;
  assumptions: Record<string, number>;
  inputs: Array<{
    label: string;
    value: number | null;
    format: 'usd' | 'number' | 'percent' | 'multiple';
  }>;
}

export interface CompositeValuation {
  fairValue: number | null;
  impliedMarketCap: number | null;
  currentPrice: number | null;
  discount: number | null;
  weights: {
    revenueMultiple: number;
    buybackYield: number;
    dcf: number;
  };
  components: Array<{
    name: string;
    weight: number;
    fairValue: number | null;
    contribution: number | null;
  }>;
}

export interface FairValueResult {
  growthRate: number;
  buybackRatio: number;
  revenueMultiple: number;
  targetBuybackYield: number;
  terminalMultiple: number;
  discountRate: number;
  revenueMultipleModel: ValuationModelResult;
  buybackYieldModel: ValuationModelResult;
  dcfModel: ValuationModelResult;
  composite: CompositeValuation;
  futureRevenue: number | null;
  futureMarketCap: number | null;
  discountedValue: number | null;
  fairValue: number | null;
  currentPrice: number | null;
  discount: number | null;
}

export interface RetirementProjectionPoint {
  year: number;
  constantRevenue: number | null;
  revenueUp20: number | null;
  revenueDown20: number | null;
}

export interface RetirementEngine {
  annualHypePurchased: number | null;
  annualSupplyRetiredPct: number | null;
  daysToRetireOnePercent: number | null;
  remainingSupply5Y: number | null;
  remainingSupply10Y: number | null;
  remainingSupply15Y: number | null;
  projections: RetirementProjectionPoint[];
}

export interface CapitalAllocationMetrics {
  revenueYield: number | null;
  buybackYield: number | null;
  paybackPeriod: number | null;
  revenuePerOpenInterest: number | null;
  revenuePerStablecoinDollar: number | null;
}

export interface ConfidencePenalty {
  reason: string;
  points: number;
}

export interface ConfidenceResult {
  label: 'Low' | 'Medium' | 'High' | 'Very High';
  score: number;
  observationCount: number;
  penalties: ConfidencePenalty[];
  explanation: string;
}

export interface AttributionFactor {
  id: string;
  label: string;
  rawValue: number | null;
  rawFormat: 'usd' | 'number' | 'percent' | 'multiple';
  normalizedScore: number | null;
  weight: number;
  contribution: number | null;
  methodology: string;
}

export interface AQAValuationScenario {
  name: string;
  aqav2RevenueEstimate: number | null;
  incrementalRevenue: number;
  incrementalBuybacks: number | null;
  expectedMargin: number;
  additionalNetworkValue: number | null;
  additionalFairValuePerHype: number | null;
  impliedHypePrice: number | null;
}

export interface AQAValuation {
  scenarios: AQAValuationScenario[];
  distribution: Array<{
    percentile: number;
    additionalFairValuePerHype: number | null;
  }>;
}

export interface InvestmentThesis {
  bull: string[];
  base: string[];
  bear: string[];
}

export interface TransparencyFormula {
  name: string;
  formula: string;
  inputs: Array<{
    label: string;
    value: number | null;
    format: 'usd' | 'number' | 'percent' | 'multiple';
  }>;
  output: {
    label: string;
    value: number | null;
    format: 'usd' | 'number' | 'percent' | 'multiple';
  };
}

export interface ResearchSignal {
  label: string;
  severity: 'bullish' | 'warning';
  detail: string;
}

export interface ValuationAnalysis {
  currentMetrics: CurrentMetrics;
  growth: GrowthMetrics;
  buybackVelocity: BuybackVelocity;
  retirement: RetirementEngine;
  capitalAllocation: CapitalAllocationMetrics;
  aqaImpact: AQAImpact[];
  aqaValuation: AQAValuation;
  revenueYield: {
    hyperliquid: number | null;
    comparisons: RevenueYieldComparison[];
  };
  exchangeComparables: ExchangeComparable[];
  health: FundamentalHealth;
  fairValue: FairValueResult;
  confidence: ConfidenceResult;
  attribution: AttributionFactor[];
  thesis: InvestmentThesis;
  transparency: TransparencyFormula[];
  dataWarnings: string[];
  signals: ResearchSignal[];
  snapshots: Snapshot[];
}
