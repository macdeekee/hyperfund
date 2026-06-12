const TREND_METRICS = [
  ['HYPE Price', 'price'],
  ['Market Cap', 'marketCap'],
  ['Annualized Revenue', 'annualizedRevenue'],
  ['Annualized Buybacks', 'buybacksAnnualized'],
  ['Stablecoin Market Cap', 'stablecoinMarketCap'],
  ['AQAv2 Annualized Revenue', 'aqav2AnnualizedRevenue'],
  ['Open Interest', 'totalOpenInterestUsd'],
  ['24h Perp Volume', 'totalPerpVolume24h'],
  ['Fundamental Score', 'weightedScore']
];

export async function buildTrendReport(snapshotStore) {
  const entries = await snapshotStore.list();
  const snapshots = entries.map(entry => entry.snapshot);
  const latest = snapshots.at(-1) ?? null;

  return {
    snapshots,
    latest,
    trends: [7, 30].map(days => calculateTrend(snapshots, days))
  };
}

export function calculateTrend(snapshots, days) {
  if (snapshots.length < 2) {
    return { days, baseline: null, rows: [] };
  }

  const latest = snapshots.at(-1);
  const target = offsetDate(latest.date, -days);
  const baseline = findBaselineSnapshot(snapshots.slice(0, -1), target);

  if (!baseline) {
    return { days, baseline: null, rows: [] };
  }

  return {
    days,
    baseline,
    latest,
    rows: TREND_METRICS.map(([label, key]) => {
      const current = valueFor(latest, key);
      const previous = valueFor(baseline, key);
      const absoluteChange = isFiniteNumber(current) && isFiniteNumber(previous) ? current - previous : null;
      const percentChange =
        isFiniteNumber(absoluteChange) && isFiniteNumber(previous) && previous !== 0
          ? absoluteChange / previous
          : null;

      return {
        label,
        key,
        current,
        previous,
        absoluteChange,
        percentChange
      };
    })
  };
}

function findBaselineSnapshot(snapshots, targetDate) {
  const onOrBefore = snapshots.filter(snapshot => snapshot.date <= targetDate).at(-1);
  return onOrBefore ?? snapshots[0] ?? null;
}

function valueFor(snapshot, key) {
  if (key === 'weightedScore') {
    return snapshot.score?.weightedScore ?? null;
  }

  return snapshot.metrics?.[key] ?? null;
}

function offsetDate(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
