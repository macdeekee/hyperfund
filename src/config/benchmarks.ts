import type { ExchangeComparable, RevenueYieldComparison } from '../models/snapshot';

export const REVENUE_YIELD_BENCHMARKS: RevenueYieldComparison[] = [
  { name: 'Coinbase', revenueYield: 0.032 },
  { name: 'Nasdaq', revenueYield: 0.028 },
  { name: 'CME', revenueYield: 0.041 },
  { name: 'Intercontinental Exchange', revenueYield: 0.033 }
];

export const EXCHANGE_COMPARABLES: ExchangeComparable[] = [
  {
    name: 'Coinbase',
    revenueYield: 0.032,
    valuationMultiple: 31.25,
    growthRate: null,
    buybackYield: null
  },
  {
    name: 'CME',
    revenueYield: 0.041,
    valuationMultiple: 24.39,
    growthRate: null,
    buybackYield: null
  },
  {
    name: 'Nasdaq',
    revenueYield: 0.028,
    valuationMultiple: 35.71,
    growthRate: null,
    buybackYield: null
  },
  {
    name: 'Intercontinental Exchange',
    revenueYield: 0.033,
    valuationMultiple: 30.3,
    growthRate: null,
    buybackYield: null
  }
];
