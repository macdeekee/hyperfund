import type { ValuationAnalysis } from '../models/snapshot';

export interface DashboardViewModel {
  title: string;
  capturedAt: string;
  analysis: ValuationAnalysis;
}

export function createDashboardViewModel(title: string, capturedAt: string, analysis: ValuationAnalysis): DashboardViewModel {
  return {
    title,
    capturedAt,
    analysis
  };
}
