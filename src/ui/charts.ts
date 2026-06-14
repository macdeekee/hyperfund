import asciichart from 'asciichart';
import type { Snapshot } from '../models/snapshot';

export function renderAsciiChart(snapshots: Snapshot[], key: keyof Pick<Snapshot, 'revenue' | 'buybacks' | 'stablecoins' | 'openInterest' | 'revenueYield'>) {
  const values = snapshots
    .map(snapshot => snapshot[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (values.length < 2) {
    return 'Need more snapshots for chart.';
  }

  return asciichart.plot(values, {
    height: 6,
    format: value => compact(value)
  });
}

function compact(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (absolute < 1 && absolute > -1) return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(0);
}
