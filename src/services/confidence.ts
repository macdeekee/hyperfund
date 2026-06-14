import type { ConfidencePenalty, ConfidenceResult, CurrentMetrics, Snapshot } from '../models/snapshot';

export function calculateConfidence({
  metrics,
  snapshots,
  sourceStatus,
  currentTimestamp,
  interpolationUsed = false
}: {
  metrics: CurrentMetrics;
  snapshots: Snapshot[];
  sourceStatus?: Array<Record<string, any>>;
  currentTimestamp?: number | null;
  interpolationUsed?: boolean;
}): ConfidenceResult {
  const observationCount = snapshots.length;
  const base = baseConfidence(observationCount);
  const penalties = confidencePenalties({ metrics, sourceStatus, currentTimestamp, interpolationUsed });
  const score = clamp(base.score - penalties.reduce((sum, penalty) => sum + penalty.points, 0));
  const label = scoreToLabel(score, observationCount);

  return {
    label,
    score,
    observationCount,
    penalties,
    explanation: `${label} confidence from ${observationCount} stored observation${observationCount === 1 ? '' : 's'}${penalties.length ? ` with ${penalties.length} data quality penalty${penalties.length === 1 ? '' : 'ies'}.` : ' and no data quality penalties.'}`
  };
}

function baseConfidence(observationCount: number) {
  if (observationCount <= 30) return { label: 'Low' as const, score: 30 };
  if (observationCount <= 90) return { label: 'Medium' as const, score: 60 };
  if (observationCount <= 365) return { label: 'High' as const, score: 82 };
  return { label: 'Very High' as const, score: 94 };
}

function confidencePenalties({
  metrics,
  sourceStatus,
  currentTimestamp,
  interpolationUsed
}: {
  metrics: CurrentMetrics;
  sourceStatus?: Array<Record<string, any>>;
  currentTimestamp?: number | null;
  interpolationUsed?: boolean;
}): ConfidencePenalty[] {
  const penalties: ConfidencePenalty[] = [];
  const missing = [
    ['HYPE price', metrics.hypePrice],
    ['market cap', metrics.marketCap],
    ['annualized revenue', metrics.annualizedRevenue],
    ['annual buybacks', metrics.annualizedBuybacks],
    ['stablecoin market cap', metrics.stablecoinMarketCap],
    ['open interest', metrics.openInterest],
    ['perp volume', metrics.perpVolume24h]
  ].filter(([, value]) => !isFiniteNumber(value));

  if (missing.length) {
    penalties.push({
      reason: `Missing metrics: ${missing.map(([label]) => label).join(', ')}`,
      points: Math.min(24, missing.length * 4)
    });
  }

  if (isFiniteNumber(currentTimestamp) && Date.now() - currentTimestamp > 36 * 60 * 60 * 1000) {
    penalties.push({ reason: 'Latest snapshot is older than 36 hours', points: 12 });
  }

  const failedSources = (sourceStatus ?? []).filter(source => source?.ok === false);
  if (failedSources.length) {
    penalties.push({ reason: `${failedSources.length} API source${failedSources.length === 1 ? '' : 's'} failed`, points: Math.min(24, failedSources.length * 8) });
  }

  const staleSources = (sourceStatus ?? []).filter(source => source?.stale === true);
  if (staleSources.length) {
    penalties.push({ reason: `${staleSources.length} stale source${staleSources.length === 1 ? '' : 's'}`, points: Math.min(16, staleSources.length * 4) });
  }

  if (interpolationUsed) {
    penalties.push({ reason: 'Interpolated data used', points: 10 });
  }

  return penalties;
}

function scoreToLabel(score: number, observationCount: number): ConfidenceResult['label'] {
  if (score >= 90 && observationCount > 365) return 'Very High';
  if (score >= 75 && observationCount > 90) return 'High';
  if (score >= 45 && observationCount > 30) return 'Medium';
  return 'Low';
}

function clamp(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
