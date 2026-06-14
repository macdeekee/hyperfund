import type { GrowthMetrics, Snapshot } from '../models/snapshot';

export function calculateGrowthMetrics(snapshots: Snapshot[]): GrowthMetrics {
  const sorted = snapshots.filter(snapshot => snapshot.timestamp).sort((a, b) => a.timestamp - b.timestamp);
  const latest = sorted.at(-1);

  return {
    revenue7dGrowth: growth(sorted, latest, 'revenue', 7),
    revenue30dGrowth: growth(sorted, latest, 'revenue', 30),
    revenue90dGrowth: growth(sorted, latest, 'revenue', 90),
    buyback7dGrowth: growth(sorted, latest, 'buybacks', 7),
    buyback30dGrowth: growth(sorted, latest, 'buybacks', 30),
    stablecoin7dGrowth: growth(sorted, latest, 'stablecoins', 7),
    stablecoin30dGrowth: growth(sorted, latest, 'stablecoins', 30),
    openInterest7dGrowth: growth(sorted, latest, 'openInterest', 7),
    openInterest30dGrowth: growth(sorted, latest, 'openInterest', 30),
    volume7dGrowth: growth(sorted, latest, 'volume', 7),
    volume30dGrowth: growth(sorted, latest, 'volume', 30)
  };
}

export function rollingGrowthFromEmbeddedWindows(latest: Snapshot, windows: { revenue7d?: number | null; revenue30d?: number | null }) {
  const revenue7d = finite(windows.revenue7d);
  const revenue30d = finite(windows.revenue30d);

  if (!revenue7d || !revenue30d) return null;
  return (revenue7d / 7) / (revenue30d / 30) - 1;
}

function growth(
  snapshots: Snapshot[],
  latest: Snapshot | undefined,
  key: keyof Pick<Snapshot, 'revenue' | 'buybacks' | 'stablecoins' | 'openInterest' | 'volume'>,
  days: number
) {
  if (!latest) return null;
  const current = finite(latest[key]);
  if (current === null) return null;
  const baseline = findBaseline(snapshots, latest.timestamp - days * 86_400_000);
  const previous = finite(baseline?.[key]);
  if (previous === null || previous === 0) return null;
  return current / previous - 1;
}

function findBaseline(snapshots: Snapshot[], targetTimestamp: number) {
  return snapshots.filter(snapshot => snapshot.timestamp <= targetTimestamp).at(-1) ?? null;
}

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
