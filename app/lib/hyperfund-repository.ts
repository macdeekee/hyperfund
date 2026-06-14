import fs from 'node:fs/promises';
import path from 'node:path';
import { buildForecast } from '../../src/services/forecastService.js';
import { buildValuationAnalysis, normalizeSnapshot } from '../../src/services/hyperliquid';
import type { Snapshot as HistorySnapshot } from '../../src/models/snapshot';
import { createHyperfundServices } from '../../src/services/hyperfundService.js';
import { prisma } from './db';

type SnapshotLike = {
  schemaVersion?: number;
  date: string;
  capturedAt: string;
  savedAt?: string;
  metrics: Record<string, number | null | undefined>;
  score: {
    weightedScore: number;
    rating: string;
    components: Array<{ name: string; weight: number; score: number }>;
  };
  valuationScenarios: Array<{
    multiple: number;
    impliedMarketCap: number | null;
    impliedPrice: number | null;
    upside: number | null;
  }>;
  formulas?: Record<string, unknown>;
  sourceStatus?: Array<Record<string, unknown>>;
};

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

const includeAll = {
  metrics: true,
  scoreComponents: true,
  valuationScenarios: {
    orderBy: { multiple: 'asc' as const }
  },
  forecast: {
    include: {
      drivers: {
        orderBy: { impact: 'desc' as const }
      }
    }
  }
};

export async function getDashboardData() {
  await bootstrapFromLocalSnapshots();

  const [latest, snapshots] = await Promise.all([
    prisma.snapshot.findFirst({
      orderBy: { capturedAt: 'desc' },
      include: includeAll
    }),
    prisma.snapshot.findMany({
      orderBy: { date: 'asc' },
      take: 120,
      include: includeAll
    })
  ]);

  if (!latest) {
    return {
      latest: null,
      snapshots: [],
      generatedAt: new Date().toISOString()
    };
  }

  return {
    latest: enrichDashboardSnapshot(toDashboardSnapshot(latest), snapshots.map(toDashboardSnapshot)),
    snapshots: snapshots.map(toDashboardSnapshot),
    generatedAt: new Date().toISOString()
  };
}

export async function fetchLiveAndPersistSnapshot(options: { refresh?: boolean } = {}) {
  const dataDir = path.join(process.cwd(), '.hyperfund');
  const config = {
    cacheTtlMs: 60_000,
    requestTimeoutMs: 12_000,
    retries: 2,
    retryDelayMs: 500,
    aqav2FeeRateBps: 3,
    valuationMultiples: [10, 15, 20, 25, 30],
    hyperliquidBaseUrl: 'https://api.hyperliquid.xyz',
    defillamaBaseUrl: 'https://api.llama.fi',
    defillamaCoinsUrl: 'https://coins.llama.fi',
    defillamaStablecoinsUrl: 'https://stablecoins.llama.fi',
    dataDir,
    cacheDir: path.join(dataDir, 'cache'),
    snapshotsDir: path.join(dataDir, 'snapshots'),
    disableCache: false,
    forceRefresh: options.refresh ?? true
  };
  const { hyperfund } = createHyperfundServices(config);
  const snapshot = await hyperfund.fetchSnapshot();
  return persistSnapshot(snapshot as SnapshotLike);
}

export async function persistSnapshot(snapshot: SnapshotLike) {
  const existingHistory = await listSnapshotModels();
  const forecast = buildForecast(snapshot, mergeHistory(existingHistory, snapshot));
  await persistJsonSnapshot(snapshot);

  const saved = await prisma.$transaction(async tx => {
    const snapshotRow = await tx.snapshot.upsert({
      where: { date: snapshot.date },
      update: {
        capturedAt: new Date(snapshot.capturedAt),
        savedAt: snapshot.savedAt ? new Date(snapshot.savedAt) : new Date(),
        schemaVersion: snapshot.schemaVersion ?? 1,
        sourceStatus: jsonValue(snapshot.sourceStatus ?? []),
        formulas: jsonValue(snapshot.formulas ?? {}),
        raw: jsonValue(snapshot)
      },
      create: {
        date: snapshot.date,
        capturedAt: new Date(snapshot.capturedAt),
        savedAt: snapshot.savedAt ? new Date(snapshot.savedAt) : new Date(),
        schemaVersion: snapshot.schemaVersion ?? 1,
        sourceStatus: jsonValue(snapshot.sourceStatus ?? []),
        formulas: jsonValue(snapshot.formulas ?? {}),
        raw: jsonValue(snapshot)
      }
    });

    await tx.metricSnapshot.upsert({
      where: { snapshotId: snapshotRow.id },
      update: metricData(snapshot),
      create: {
        snapshotId: snapshotRow.id,
        ...metricData(snapshot)
      }
    });

    await tx.scoreComponent.deleteMany({ where: { snapshotId: snapshotRow.id } });
    await tx.valuationScenario.deleteMany({ where: { snapshotId: snapshotRow.id } });

    if (snapshot.score?.components?.length) {
      await tx.scoreComponent.createMany({
        data: snapshot.score.components.map(component => ({
          snapshotId: snapshotRow.id,
          name: component.name,
          weight: component.weight,
          score: component.score
        }))
      });
    }

    if (snapshot.valuationScenarios?.length) {
      await tx.valuationScenario.createMany({
        data: snapshot.valuationScenarios.map(scenario => ({
          snapshotId: snapshotRow.id,
          multiple: scenario.multiple,
          impliedMarketCap: finiteOrNull(scenario.impliedMarketCap),
          impliedPrice: finiteOrNull(scenario.impliedPrice),
          upside: finiteOrNull(scenario.upside)
        }))
      });
    }

    const existingForecast = await tx.forecast.findUnique({
      where: { snapshotId: snapshotRow.id }
    });

    if (existingForecast) {
      await tx.forecastDriver.deleteMany({ where: { forecastId: existingForecast.id } });
    }

    const forecastRow = await tx.forecast.upsert({
      where: { snapshotId: snapshotRow.id },
      update: forecastData(forecast),
      create: {
        snapshotId: snapshotRow.id,
        ...forecastData(forecast)
      }
    });

    if (forecast.drivers.length) {
      await tx.forecastDriver.createMany({
        data: forecast.drivers.map(driver => ({
          forecastId: forecastRow.id,
          label: driver.label,
          direction: driver.direction,
          impact: driver.impact,
          value: finiteOrNull(driver.value),
          detail: driver.detail
        }))
      });
    }

    return tx.snapshot.findUniqueOrThrow({
      where: { id: snapshotRow.id },
      include: includeAll
    });
  });

  return toDashboardSnapshot(saved);
}

export async function readJsonSnapshots(): Promise<HistorySnapshot[]> {
  try {
    const raw = await fs.readFile(snapshotJsonPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function bootstrapFromLocalSnapshots() {
  const count = await prisma.snapshot.count();
  if (count > 0) {
    return;
  }

  const snapshotsDir = path.join(process.cwd(), '.hyperfund', 'snapshots');
  let files: string[];

  try {
    files = await fs.readdir(snapshotsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw error;
  }

  for (const file of files.filter(name => name.endsWith('.json')).sort()) {
    const raw = await fs.readFile(path.join(snapshotsDir, file), 'utf8');
    await persistSnapshot(JSON.parse(raw) as SnapshotLike);
  }
}

async function listSnapshotModels() {
  const rows = await prisma.snapshot.findMany({
    orderBy: { date: 'asc' },
    include: includeAll
  });

  return rows.map(toModelSnapshot);
}

function mergeHistory(history: ReturnType<typeof toModelSnapshot>[], current: SnapshotLike) {
  const withoutCurrent = history.filter(item => item.date !== current.date);
  return [...withoutCurrent, toModelSnapshotFromSnapshot(current)].sort((a, b) => a.date.localeCompare(b.date));
}

function metricData(snapshot: SnapshotLike) {
  const metrics = snapshot.metrics ?? {};

  return {
    price: finiteOrNull(metrics.price),
    marketCap: finiteOrNull(metrics.marketCap),
    annualizedRevenue: finiteOrNull(metrics.annualizedRevenue),
    revenue24h: finiteOrNull(metrics.revenue24h),
    revenue7d: finiteOrNull(metrics.revenue7d),
    revenue30d: finiteOrNull(metrics.revenue30d),
    fees24h: finiteOrNull(metrics.fees24h),
    buybacks24h: finiteOrNull(metrics.buybacks24h),
    buybacksAnnualized: finiteOrNull(metrics.buybacksAnnualized),
    stablecoinMarketCap: finiteOrNull(metrics.stablecoinMarketCap),
    aqav2DailyRevenue: finiteOrNull(metrics.aqav2DailyRevenue),
    aqav2AnnualizedRevenue: finiteOrNull(metrics.aqav2AnnualizedRevenue),
    totalOpenInterestUsd: finiteOrNull(metrics.totalOpenInterestUsd),
    totalPerpVolume24h: finiteOrNull(metrics.totalPerpVolume24h),
    hypeOpenInterestUsd: finiteOrNull(metrics.hypeOpenInterestUsd),
    hypePerpVolume24h: finiteOrNull(metrics.hypePerpVolume24h),
    tvl: finiteOrNull(metrics.tvl),
    activePerpMarkets: integerOrNull(metrics.activePerpMarkets),
    revenueMultiple: finiteOrNull(metrics.revenueMultiple),
    buybackYield: finiteOrNull(metrics.buybackYield),
    stablecoinToMarketCap: finiteOrNull(metrics.stablecoinToMarketCap),
    volumeToMarketCap: finiteOrNull(metrics.volumeToMarketCap),
    weightedScore: finiteOrNull(snapshot.score?.weightedScore),
    scoreRating: snapshot.score?.rating ?? null
  };
}

function forecastData(forecast: ReturnType<typeof buildForecast>) {
  return {
    currentPrice: finiteOrNull(forecast.currentPrice),
    fairBear: finiteOrNull(forecast.fairBear),
    fairBase: finiteOrNull(forecast.fairBase),
    fairBull: finiteOrNull(forecast.fairBull),
    bearUpside: finiteOrNull(forecast.bearUpside),
    baseUpside: finiteOrNull(forecast.baseUpside),
    bullUpside: finiteOrNull(forecast.bullUpside),
    signal: forecast.signal,
    confidence: forecast.confidence,
    confidenceScore: forecast.confidenceScore,
    assumptions: jsonValue(forecast.assumptions)
  };
}

function toDashboardSnapshot(row: any) {
  const model = toModelSnapshot(row);

  return {
    ...model,
    id: row.id,
    capturedAt: row.capturedAt.toISOString(),
    savedAt: row.savedAt.toISOString(),
    sourceStatus: row.sourceStatus,
    formulas: row.formulas,
    scoreComponents: row.scoreComponents,
    valuationScenarios: row.valuationScenarios,
    forecast: row.forecast
      ? {
          ...row.forecast,
          createdAt: row.forecast.createdAt.toISOString()
        }
      : null
  };
}

function enrichDashboardSnapshot(snapshot: ReturnType<typeof toDashboardSnapshot>, history: ReturnType<typeof toDashboardSnapshot>[]) {
  return {
    ...snapshot,
    analysis: buildValuationAnalysis(snapshot, history)
  };
}

function toModelSnapshot(row: any) {
  return {
    date: row.date,
    metrics: {
      ...(row.metrics ?? {}),
      weightedScore: row.metrics?.weightedScore ?? null
    },
    score: {
      weightedScore: row.metrics?.weightedScore ?? 0,
      rating: row.metrics?.scoreRating ?? 'n/a'
    },
    sourceStatus: row.sourceStatus
  };
}

function toModelSnapshotFromSnapshot(snapshot: SnapshotLike) {
  return {
    date: snapshot.date,
    metrics: {
      ...snapshot.metrics,
      weightedScore: snapshot.score?.weightedScore ?? null
    },
    score: {
      weightedScore: snapshot.score?.weightedScore ?? 0,
      rating: snapshot.score?.rating ?? 'n/a'
    },
    sourceStatus: snapshot.sourceStatus ?? []
  };
}

function finiteOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value: unknown) {
  const number = finiteOrNull(value);
  return number === null ? null : Math.round(number);
}

function jsonValue(value: unknown): any {
  return value;
}

async function persistJsonSnapshot(snapshot: SnapshotLike) {
  const history = await readJsonSnapshots();
  const analysisSnapshot = normalizeSnapshot(snapshot);

  const withoutCurrent = history.filter(item => item.date !== analysisSnapshot.date);
  const next = [...withoutCurrent, analysisSnapshot].sort((a, b) => a.timestamp - b.timestamp);
  await fs.mkdir(path.dirname(snapshotJsonPath()), { recursive: true });
  await fs.writeFile(snapshotJsonPath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

function snapshotJsonPath() {
  return path.join(process.cwd(), 'data', 'snapshots.json');
}
