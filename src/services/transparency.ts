import type { FairValueResult, TransparencyFormula } from '../models/snapshot';

export function buildTransparency(fairValue: FairValueResult): TransparencyFormula[] {
  return [
    {
      name: fairValue.revenueMultipleModel.name,
      formula: fairValue.revenueMultipleModel.formula,
      inputs: fairValue.revenueMultipleModel.inputs,
      output: {
        label: 'Revenue Multiple Value',
        value: fairValue.revenueMultipleModel.fairValue,
        format: 'usd'
      }
    },
    {
      name: fairValue.buybackYieldModel.name,
      formula: fairValue.buybackYieldModel.formula,
      inputs: fairValue.buybackYieldModel.inputs,
      output: {
        label: 'Buyback Value',
        value: fairValue.buybackYieldModel.fairValue,
        format: 'usd'
      }
    },
    {
      name: fairValue.dcfModel.name,
      formula: fairValue.dcfModel.formula,
      inputs: fairValue.dcfModel.inputs,
      output: {
        label: 'DCF Value',
        value: fairValue.dcfModel.fairValue,
        format: 'usd'
      }
    },
    {
      name: 'Composite Value',
      formula: 'Revenue Multiple Value x 40% + Buyback Value x 40% + DCF Value x 20%',
      inputs: fairValue.composite.components.map(component => ({
        label: `${component.name} (${Math.round(component.weight * 100)}%)`,
        value: component.fairValue,
        format: 'usd' as const
      })),
      output: {
        label: 'Composite Value',
        value: fairValue.composite.fairValue,
        format: 'usd'
      }
    }
  ];
}
