import { FAIR_VALUE_WEIGHTS } from '../config/assumptions';
import type { FairValueInputs, FairValueResult, ValuationModelResult } from '../models/snapshot';

export function calculateFairValue(inputs: FairValueInputs): FairValueResult {
  const revenueMultipleModel = revenueMultipleValue(inputs);
  const buybackYieldModel = buybackYieldValue(inputs);
  const dcfModel = dcfValue(inputs);
  const composite = compositeValue(inputs, revenueMultipleModel, buybackYieldModel, dcfModel);
  const futureRevenue = isPositive(inputs.annualRevenue)
    ? inputs.annualRevenue * (1 + inputs.growthRate)
    : null;
  const futureMarketCap = isPositive(futureRevenue)
    ? futureRevenue * inputs.terminalMultiple
    : null;
  const discountedValue = isPositive(futureMarketCap)
    ? futureMarketCap / (1 + inputs.discountRate)
    : null;
  const fairValue =
    isPositive(discountedValue) && isPositive(inputs.circulatingSupply)
      ? discountedValue / inputs.circulatingSupply
      : null;
  const discount =
    isPositive(fairValue) && isPositive(inputs.currentPrice)
      ? 1 - inputs.currentPrice / fairValue
      : null;

  return {
    growthRate: inputs.growthRate,
    buybackRatio: inputs.buybackRatio,
    revenueMultiple: inputs.revenueMultiple,
    targetBuybackYield: inputs.targetBuybackYield,
    terminalMultiple: inputs.terminalMultiple,
    discountRate: inputs.discountRate,
    revenueMultipleModel,
    buybackYieldModel,
    dcfModel,
    composite,
    futureRevenue,
    futureMarketCap,
    discountedValue,
    fairValue: composite.fairValue ?? fairValue,
    currentPrice: inputs.currentPrice,
    discount: composite.discount ?? discount
  };
}

function revenueMultipleValue(inputs: FairValueInputs): ValuationModelResult {
  const impliedMarketCap = isPositive(inputs.annualRevenue)
    ? inputs.annualRevenue * inputs.revenueMultiple
    : null;
  const fairValue =
    isPositive(impliedMarketCap) && isPositive(inputs.circulatingSupply)
      ? impliedMarketCap / inputs.circulatingSupply
      : null;

  return {
    id: 'revenueMultiple',
    name: 'Revenue Multiple Value',
    formula: 'Annualized Revenue x Revenue Multiple / Circulating Supply',
    fairValue,
    impliedMarketCap,
    assumptions: {
      revenueMultiple: inputs.revenueMultiple
    },
    inputs: [
      { label: 'Annualized Revenue', value: inputs.annualRevenue, format: 'usd' },
      { label: 'Revenue Multiple', value: inputs.revenueMultiple, format: 'multiple' },
      { label: 'Circulating Supply', value: inputs.circulatingSupply, format: 'number' }
    ]
  };
}

function buybackYieldValue(inputs: FairValueInputs): ValuationModelResult {
  const impliedMarketCap =
    isPositive(inputs.annualBuybacks) && isPositive(inputs.targetBuybackYield)
      ? inputs.annualBuybacks / inputs.targetBuybackYield
      : null;
  const fairValue =
    isPositive(impliedMarketCap) && isPositive(inputs.circulatingSupply)
      ? impliedMarketCap / inputs.circulatingSupply
      : null;

  return {
    id: 'buybackYield',
    name: 'Buyback Value',
    formula: 'Annual Buybacks / Target Buyback Yield / Circulating Supply',
    fairValue,
    impliedMarketCap,
    assumptions: {
      targetBuybackYield: inputs.targetBuybackYield
    },
    inputs: [
      { label: 'Annual Buybacks', value: inputs.annualBuybacks, format: 'usd' },
      { label: 'Target Buyback Yield', value: inputs.targetBuybackYield, format: 'percent' },
      { label: 'Circulating Supply', value: inputs.circulatingSupply, format: 'number' }
    ]
  };
}

function dcfValue(inputs: FairValueInputs): ValuationModelResult {
  const futureRevenue = isPositive(inputs.annualRevenue)
    ? inputs.annualRevenue * (1 + inputs.growthRate)
    : null;
  const futureMarketCap = isPositive(futureRevenue)
    ? futureRevenue * inputs.terminalMultiple
    : null;
  const impliedMarketCap = isPositive(futureMarketCap)
    ? futureMarketCap / (1 + inputs.discountRate)
    : null;
  const fairValue =
    isPositive(impliedMarketCap) && isPositive(inputs.circulatingSupply)
      ? impliedMarketCap / inputs.circulatingSupply
      : null;

  return {
    id: 'dcf',
    name: 'DCF Value',
    formula: 'Annualized Revenue x (1 + Growth Rate) x Terminal Multiple / (1 + Discount Rate) / Circulating Supply',
    fairValue,
    impliedMarketCap,
    assumptions: {
      growthRate: inputs.growthRate,
      terminalMultiple: inputs.terminalMultiple,
      discountRate: inputs.discountRate
    },
    inputs: [
      { label: 'Annualized Revenue', value: inputs.annualRevenue, format: 'usd' },
      { label: 'Growth Rate', value: inputs.growthRate, format: 'percent' },
      { label: 'Terminal Multiple', value: inputs.terminalMultiple, format: 'multiple' },
      { label: 'Discount Rate', value: inputs.discountRate, format: 'percent' },
      { label: 'Circulating Supply', value: inputs.circulatingSupply, format: 'number' }
    ]
  };
}

function compositeValue(
  inputs: FairValueInputs,
  revenueMultipleModel: ValuationModelResult,
  buybackYieldModel: ValuationModelResult,
  dcfModel: ValuationModelResult
) {
  const components = [
    { name: revenueMultipleModel.name, weight: FAIR_VALUE_WEIGHTS.revenueMultiple, fairValue: revenueMultipleModel.fairValue },
    { name: buybackYieldModel.name, weight: FAIR_VALUE_WEIGHTS.buybackYield, fairValue: buybackYieldModel.fairValue },
    { name: dcfModel.name, weight: FAIR_VALUE_WEIGHTS.dcf, fairValue: dcfModel.fairValue }
  ].map(component => ({
    ...component,
    contribution: isPositiveOrZero(component.fairValue) ? component.fairValue * component.weight : null
  }));

  const validComponents = components.filter(component => isPositiveOrZero(component.contribution));
  const validWeight = validComponents.reduce((sum, component) => sum + component.weight, 0);
  const fairValue = validWeight > 0
    ? validComponents.reduce((sum, component) => sum + (component.contribution ?? 0), 0) / validWeight
    : null;
  const impliedMarketCap =
    isPositive(fairValue) && isPositive(inputs.circulatingSupply)
      ? fairValue * inputs.circulatingSupply
      : null;
  const discount =
    isPositive(fairValue) && isPositive(inputs.currentPrice)
      ? 1 - inputs.currentPrice / fairValue
      : null;

  return {
    fairValue,
    impliedMarketCap,
    currentPrice: inputs.currentPrice,
    discount,
    weights: FAIR_VALUE_WEIGHTS,
    components
  };
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPositiveOrZero(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
