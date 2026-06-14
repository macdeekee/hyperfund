import fs from 'node:fs/promises';
import path from 'node:path';

const SUPPLY = {
  circulatingSupply: 333_928_180,
  totalSupply: 1_000_000_000
};

const AQA_SCENARIOS = [
  { name: 'Bear', additionalRevenue: 100_000_000, expectedMargin: 0.65 },
  { name: 'Base', additionalRevenue: 292_000_000, expectedMargin: 0.75 },
  { name: 'Bull', additionalRevenue: 600_000_000, expectedMargin: 0.8 }
];

const BENCHMARKS = [
  { name: 'Coinbase', revenueYield: 0.032 },
  { name: 'CME', revenueYield: 0.041 },
  { name: 'Nasdaq', revenueYield: 0.028 },
  { name: 'Intercontinental Exchange', revenueYield: 0.033 }
];

const EXCHANGE_COMPARABLES = [
  { name: 'Coinbase', revenueYield: 0.032, valuationMultiple: 31.25, growthRate: null, buybackYield: null },
  { name: 'CME', revenueYield: 0.041, valuationMultiple: 24.39, growthRate: null, buybackYield: null },
  { name: 'Nasdaq', revenueYield: 0.028, valuationMultiple: 35.71, growthRate: null, buybackYield: null },
  { name: 'Intercontinental Exchange', revenueYield: 0.033, valuationMultiple: 30.3, growthRate: null, buybackYield: null }
];

const FAIR_VALUE = {
  growthRate: 0.4,
  buybackRatio: 0.97,
  revenueMultiple: 20,
  targetBuybackYield: 0.05,
  terminalMultiple: 20,
  discountRate: 0.12
};

const WEIGHTS = {
  revenueMultiple: 0.4,
  buybackYield: 0.4,
  dcf: 0.2
};

const ATTRIBUTION_WEIGHTS = {
  stablecoinLiquidity: 0.2,
  buybackYield: 0.25,
  revenueMultiple: 0.2,
  activity: 0.15,
  growth: 0.2
};

export async function buildAnalysisForSnapshot(snapshot) {
  const history = await readAnalysisSnapshots();
  const current = normalizeSnapshot(snapshot);
  const nextHistory = [...history.filter(item => item.date !== current.date), current].sort((a, b) => a.timestamp - b.timestamp);
  await persistAnalysisSnapshots(nextHistory);

  return buildAnalysis(snapshot, nextHistory);
}

export async function readAnalysisSnapshots() {
  try {
    const raw = await fs.readFile(snapshotPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export function buildAnalysis(snapshot, history = []) {
  const metrics = snapshot.metrics ?? {};
  const hypePrice = finite(metrics.price);
  const marketCap = finite(metrics.marketCap);
  const circulatingSupply = hypePrice && marketCap ? marketCap / hypePrice : SUPPLY.circulatingSupply;
  const currentMetrics = {
    hypePrice,
    marketCap,
    annualizedRevenue: finite(metrics.annualizedRevenue),
    annualizedBuybacks: finite(metrics.buybacksAnnualized),
    stablecoinMarketCap: finite(metrics.stablecoinMarketCap),
    openInterest: finite(metrics.totalOpenInterestUsd),
    perpVolume24h: finite(metrics.totalPerpVolume24h),
    aqav2EstimatedRevenue: finite(metrics.aqav2AnnualizedRevenue),
    dailyBuybackUSD: finite(metrics.buybacks24h),
    buybacks30d: finite(metrics.revenue30d),
    circulatingSupply,
    totalSupply: SUPPLY.totalSupply
  };
  const snapshots = [...history.filter(item => item.date !== snapshot.date).map(normalizeSnapshot), normalizeSnapshot(snapshot)]
    .sort((a, b) => a.timestamp - b.timestamp);
  const growth = calculateGrowth(snapshots);
  const buybackVelocity = calculateBuybackVelocity(currentMetrics);
  const retirement = calculateRetirement(currentMetrics);
  const capitalAllocation = calculateCapitalAllocation(currentMetrics);
  const revenueYield = capitalAllocation.revenueYield;
  const aqaImpact = calculateLegacyAqaImpact(currentMetrics);
  const aqaValuation = calculateAqaValuation(currentMetrics);
  const fairValue = calculateFairValue(currentMetrics);
  const health = calculateHealth(currentMetrics, growth, buybackVelocity, revenueYield);
  const confidence = calculateConfidence(currentMetrics, snapshots, snapshot.sourceStatus, snapshots.at(-1)?.timestamp);
  const attribution = calculateAttribution(currentMetrics, growth, capitalAllocation);
  const exchangeComparables = buildExchangeComparables(currentMetrics, capitalAllocation);
  const thesis = buildThesis(currentMetrics, growth, capitalAllocation, fairValue, confidence);
  const transparency = buildTransparency(fairValue);
  const signals = calculateSignals(growth, revenueYield, currentMetrics);
  const dataWarnings = buildDataWarnings(growth, confidence);

  return {
    currentMetrics,
    growth,
    buybackVelocity,
    retirement,
    capitalAllocation,
    aqaImpact,
    aqaValuation,
    revenueYield: {
      hyperliquid: revenueYield,
      comparisons: BENCHMARKS
    },
    exchangeComparables,
    fairValue,
    health,
    confidence,
    attribution,
    thesis,
    transparency,
    dataWarnings,
    signals,
    snapshots
  };
}

function normalizeSnapshot(snapshot) {
  if (!snapshot?.metrics && 'revenue' in (snapshot ?? {})) {
    const revenue = finite(snapshot.revenue);
    const marketCap = finite(snapshot.marketCap);
    return {
      timestamp: finite(snapshot.timestamp) ?? new Date(snapshot.date ?? Date.now()).getTime(),
      date: snapshot.date ?? new Date().toISOString().slice(0, 10),
      revenue,
      buybacks: finite(snapshot.buybacks),
      stablecoins: finite(snapshot.stablecoins),
      openInterest: finite(snapshot.openInterest),
      volume: finite(snapshot.volume),
      marketCap,
      hypePrice: finite(snapshot.hypePrice),
      revenueYield: revenue && marketCap ? revenue / marketCap : null
    };
  }

  const metrics = snapshot?.metrics ?? {};
  const revenue = finite(metrics.annualizedRevenue);
  const marketCap = finite(metrics.marketCap);

  return {
    timestamp: new Date(snapshot?.capturedAt ?? snapshot?.date ?? Date.now()).getTime(),
    date: snapshot?.date ?? new Date().toISOString().slice(0, 10),
    revenue,
    buybacks: finite(metrics.buybacksAnnualized),
    stablecoins: finite(metrics.stablecoinMarketCap),
    openInterest: finite(metrics.totalOpenInterestUsd),
    volume: finite(metrics.totalPerpVolume24h),
    marketCap,
    hypePrice: finite(metrics.price),
    revenueYield: revenue && marketCap ? revenue / marketCap : null
  };
}

function calculateGrowth(history) {
  const latest = history.at(-1);

  return {
    revenue7dGrowth: growth(history, latest, 'revenue', 7),
    revenue30dGrowth: growth(history, latest, 'revenue', 30),
    revenue90dGrowth: growth(history, latest, 'revenue', 90),
    buyback7dGrowth: growth(history, latest, 'buybacks', 7),
    buyback30dGrowth: growth(history, latest, 'buybacks', 30),
    stablecoin7dGrowth: growth(history, latest, 'stablecoins', 7),
    stablecoin30dGrowth: growth(history, latest, 'stablecoins', 30),
    openInterest7dGrowth: growth(history, latest, 'openInterest', 7),
    openInterest30dGrowth: growth(history, latest, 'openInterest', 30),
    volume7dGrowth: growth(history, latest, 'volume', 7),
    volume30dGrowth: growth(history, latest, 'volume', 30)
  };
}

function calculateBuybackVelocity(metrics) {
  const annualHypePurchased = metrics.annualizedBuybacks && metrics.hypePrice
    ? metrics.annualizedBuybacks / metrics.hypePrice
    : null;
  const supplyAbsorptionRate = annualHypePurchased && metrics.circulatingSupply
    ? annualHypePurchased / metrics.circulatingSupply
    : null;
  const daysToBuyOnePercent = annualHypePurchased && metrics.circulatingSupply
    ? (metrics.circulatingSupply * 0.01) / (annualHypePurchased / 365)
    : null;

  return {
    annualHypePurchased,
    supplyAbsorptionRate,
    daysToBuyOnePercent,
    buybacksLast24h: metrics.dailyBuybackUSD,
    buybacksLast30d: metrics.buybacks30d
  };
}

function calculateRetirement(metrics) {
  const annualBuybacks = annualBuybacksFor(metrics);
  const annualHypePurchased = annualBuybacks && metrics.hypePrice ? annualBuybacks / metrics.hypePrice : null;
  const annualSupplyRetiredPct = annualHypePurchased && metrics.circulatingSupply
    ? annualHypePurchased / metrics.circulatingSupply
    : null;
  const daysToRetireOnePercent = annualHypePurchased && metrics.circulatingSupply
    ? (metrics.circulatingSupply * 0.01) / (annualHypePurchased / 365)
    : null;
  const projections = Array.from({ length: 15 }, (_, index) => {
    const year = index + 1;
    return {
      year,
      constantRevenue: remainingSupply(metrics, year, 0),
      revenueUp20: remainingSupply(metrics, year, 0.2),
      revenueDown20: remainingSupply(metrics, year, -0.2)
    };
  });

  return {
    annualHypePurchased,
    annualSupplyRetiredPct,
    daysToRetireOnePercent,
    remainingSupply5Y: projections.find(point => point.year === 5)?.constantRevenue ?? null,
    remainingSupply10Y: projections.find(point => point.year === 10)?.constantRevenue ?? null,
    remainingSupply15Y: projections.find(point => point.year === 15)?.constantRevenue ?? null,
    projections
  };
}

function calculateCapitalAllocation(metrics) {
  return {
    revenueYield: ratio(metrics.annualizedRevenue, metrics.marketCap),
    buybackYield: ratio(metrics.annualizedBuybacks, metrics.marketCap),
    paybackPeriod: ratio(metrics.marketCap, metrics.annualizedRevenue),
    revenuePerOpenInterest: ratio(metrics.annualizedRevenue, metrics.openInterest),
    revenuePerStablecoinDollar: ratio(metrics.annualizedRevenue, metrics.stablecoinMarketCap)
  };
}

function calculateLegacyAqaImpact(metrics) {
  return AQA_SCENARIOS.map(scenario => {
    const newRevenue = metrics.annualizedRevenue ? metrics.annualizedRevenue + scenario.additionalRevenue : null;
    const impliedMarketCap = newRevenue ? newRevenue * FAIR_VALUE.revenueMultiple : null;
    return {
      name: scenario.name,
      additionalRevenue: scenario.additionalRevenue,
      newRevenue,
      impliedMarketCap,
      impliedHypePrice: impliedMarketCap && metrics.circulatingSupply ? impliedMarketCap / metrics.circulatingSupply : null
    };
  });
}

function calculateAqaValuation(metrics) {
  const scenarios = AQA_SCENARIOS.map(scenario => {
    const incrementalRevenue = scenario.additionalRevenue;
    const expectedMargin = scenario.expectedMargin;
    const incrementalProtocolRevenue = incrementalRevenue * expectedMargin;
    const incrementalBuybacks = incrementalProtocolRevenue * FAIR_VALUE.buybackRatio;
    const additionalNetworkValue = incrementalProtocolRevenue * FAIR_VALUE.revenueMultiple;
    const additionalFairValuePerHype = metrics.circulatingSupply ? additionalNetworkValue / metrics.circulatingSupply : null;
    const impliedHypePrice = metrics.hypePrice && additionalFairValuePerHype ? metrics.hypePrice + additionalFairValuePerHype : null;

    return {
      name: scenario.name,
      aqav2RevenueEstimate: metrics.aqav2EstimatedRevenue,
      incrementalRevenue,
      incrementalBuybacks,
      expectedMargin,
      additionalNetworkValue,
      additionalFairValuePerHype,
      impliedHypePrice
    };
  });

  return {
    scenarios,
    distribution: buildAqaDistribution(scenarios)
  };
}

function calculateFairValue(metrics) {
  const revenueMultipleModel = revenueMultipleValue(metrics);
  const buybackYieldModel = buybackYieldValue(metrics);
  const dcfModel = dcfValue(metrics);
  const components = [
    { name: revenueMultipleModel.name, weight: WEIGHTS.revenueMultiple, fairValue: revenueMultipleModel.fairValue },
    { name: buybackYieldModel.name, weight: WEIGHTS.buybackYield, fairValue: buybackYieldModel.fairValue },
    { name: dcfModel.name, weight: WEIGHTS.dcf, fairValue: dcfModel.fairValue }
  ].map(component => ({
    ...component,
    contribution: finite(component.fairValue) === null ? null : component.fairValue * component.weight
  }));
  const valid = components.filter(component => finite(component.contribution) !== null);
  const validWeight = valid.reduce((sum, component) => sum + component.weight, 0);
  const compositeFairValue = validWeight
    ? valid.reduce((sum, component) => sum + component.contribution, 0) / validWeight
    : null;
  const impliedMarketCap = compositeFairValue && metrics.circulatingSupply ? compositeFairValue * metrics.circulatingSupply : null;
  const discount = compositeFairValue && metrics.hypePrice ? 1 - metrics.hypePrice / compositeFairValue : null;
  const futureRevenue = metrics.annualizedRevenue ? metrics.annualizedRevenue * (1 + FAIR_VALUE.growthRate) : null;
  const futureMarketCap = futureRevenue ? futureRevenue * FAIR_VALUE.terminalMultiple : null;
  const discountedValue = futureMarketCap ? futureMarketCap / (1 + FAIR_VALUE.discountRate) : null;

  return {
    ...FAIR_VALUE,
    revenueMultipleModel,
    buybackYieldModel,
    dcfModel,
    composite: {
      fairValue: compositeFairValue,
      impliedMarketCap,
      currentPrice: metrics.hypePrice,
      discount,
      weights: WEIGHTS,
      components
    },
    futureRevenue,
    futureMarketCap,
    discountedValue,
    fairValue: compositeFairValue,
    currentPrice: metrics.hypePrice,
    discount
  };
}

function revenueMultipleValue(metrics) {
  const impliedMarketCap = metrics.annualizedRevenue ? metrics.annualizedRevenue * FAIR_VALUE.revenueMultiple : null;
  return {
    id: 'revenueMultiple',
    name: 'Revenue Multiple Value',
    formula: 'Annualized Revenue x Revenue Multiple / Circulating Supply',
    fairValue: impliedMarketCap && metrics.circulatingSupply ? impliedMarketCap / metrics.circulatingSupply : null,
    impliedMarketCap,
    assumptions: { revenueMultiple: FAIR_VALUE.revenueMultiple },
    inputs: [
      { label: 'Annualized Revenue', value: metrics.annualizedRevenue, format: 'usd' },
      { label: 'Revenue Multiple', value: FAIR_VALUE.revenueMultiple, format: 'multiple' },
      { label: 'Circulating Supply', value: metrics.circulatingSupply, format: 'number' }
    ]
  };
}

function buybackYieldValue(metrics) {
  const impliedMarketCap = metrics.annualizedBuybacks && FAIR_VALUE.targetBuybackYield
    ? metrics.annualizedBuybacks / FAIR_VALUE.targetBuybackYield
    : null;
  return {
    id: 'buybackYield',
    name: 'Buyback Value',
    formula: 'Annual Buybacks / Target Buyback Yield / Circulating Supply',
    fairValue: impliedMarketCap && metrics.circulatingSupply ? impliedMarketCap / metrics.circulatingSupply : null,
    impliedMarketCap,
    assumptions: { targetBuybackYield: FAIR_VALUE.targetBuybackYield },
    inputs: [
      { label: 'Annual Buybacks', value: metrics.annualizedBuybacks, format: 'usd' },
      { label: 'Target Buyback Yield', value: FAIR_VALUE.targetBuybackYield, format: 'percent' },
      { label: 'Circulating Supply', value: metrics.circulatingSupply, format: 'number' }
    ]
  };
}

function dcfValue(metrics) {
  const futureRevenue = metrics.annualizedRevenue ? metrics.annualizedRevenue * (1 + FAIR_VALUE.growthRate) : null;
  const futureMarketCap = futureRevenue ? futureRevenue * FAIR_VALUE.terminalMultiple : null;
  const impliedMarketCap = futureMarketCap ? futureMarketCap / (1 + FAIR_VALUE.discountRate) : null;
  return {
    id: 'dcf',
    name: 'DCF Value',
    formula: 'Annualized Revenue x (1 + Growth Rate) x Terminal Multiple / (1 + Discount Rate) / Circulating Supply',
    fairValue: impliedMarketCap && metrics.circulatingSupply ? impliedMarketCap / metrics.circulatingSupply : null,
    impliedMarketCap,
    assumptions: {
      growthRate: FAIR_VALUE.growthRate,
      terminalMultiple: FAIR_VALUE.terminalMultiple,
      discountRate: FAIR_VALUE.discountRate
    },
    inputs: [
      { label: 'Annualized Revenue', value: metrics.annualizedRevenue, format: 'usd' },
      { label: 'Growth Rate', value: FAIR_VALUE.growthRate, format: 'percent' },
      { label: 'Terminal Multiple', value: FAIR_VALUE.terminalMultiple, format: 'multiple' },
      { label: 'Discount Rate', value: FAIR_VALUE.discountRate, format: 'percent' },
      { label: 'Circulating Supply', value: metrics.circulatingSupply, format: 'number' }
    ]
  };
}

function calculateHealth(metrics, growth, velocity, revenueYield) {
  const revenueHealth = grade(scoreByTarget(metrics.annualizedRevenue, 1_000_000_000) * 0.55 + scoreByTarget(revenueYield, 0.06) * 0.45);
  const buybackHealth = grade(scoreByTarget(metrics.annualizedBuybacks && metrics.annualizedRevenue ? metrics.annualizedBuybacks / metrics.annualizedRevenue : null, 0.97) * 0.45 + scoreByTarget(velocity.supplyAbsorptionRate, 0.05) * 0.55);
  const growthGrade = grade(55 + average([
    growth.revenue30dGrowth,
    growth.buyback30dGrowth,
    growth.stablecoin30dGrowth,
    growth.openInterest30dGrowth,
    growth.volume30dGrowth
  ]) * 140);
  const valuation = grade(scoreByTarget(revenueYield, 0.05));
  const liquidity = grade(scoreByTarget(metrics.stablecoinMarketCap && metrics.marketCap ? metrics.stablecoinMarketCap / metrics.marketCap : null, 0.45) * 0.5 + scoreByTarget(metrics.perpVolume24h && metrics.marketCap ? metrics.perpVolume24h / metrics.marketCap : null, 0.35) * 0.5);
  const overall = grade(revenueHealth.score * 0.24 + buybackHealth.score * 0.2 + growthGrade.score * 0.22 + valuation.score * 0.16 + liquidity.score * 0.18);

  return { revenueHealth, buybackHealth, growth: growthGrade, valuation, liquidity, overall };
}

function calculateConfidence(metrics, snapshots, sourceStatus = [], currentTimestamp = null) {
  const observationCount = snapshots.length;
  const baseScore = observationCount <= 30 ? 30 : observationCount <= 90 ? 60 : observationCount <= 365 ? 82 : 94;
  const penalties = [];
  const missing = [
    ['HYPE price', metrics.hypePrice],
    ['market cap', metrics.marketCap],
    ['annualized revenue', metrics.annualizedRevenue],
    ['annual buybacks', metrics.annualizedBuybacks],
    ['stablecoin market cap', metrics.stablecoinMarketCap],
    ['open interest', metrics.openInterest],
    ['perp volume', metrics.perpVolume24h]
  ].filter(([, value]) => finite(value) === null);

  if (missing.length) penalties.push({ reason: `Missing metrics: ${missing.map(([label]) => label).join(', ')}`, points: Math.min(24, missing.length * 4) });
  if (currentTimestamp && Date.now() - currentTimestamp > 36 * 60 * 60 * 1000) penalties.push({ reason: 'Latest snapshot is older than 36 hours', points: 12 });

  const failed = sourceStatus.filter(source => source?.ok === false);
  const stale = sourceStatus.filter(source => source?.stale === true);
  if (failed.length) penalties.push({ reason: `${failed.length} API source${failed.length === 1 ? '' : 's'} failed`, points: Math.min(24, failed.length * 8) });
  if (stale.length) penalties.push({ reason: `${stale.length} stale source${stale.length === 1 ? '' : 's'}`, points: Math.min(16, stale.length * 4) });

  const score = clamp(baseScore - penalties.reduce((sum, penalty) => sum + penalty.points, 0));
  const label = score >= 90 && observationCount > 365
    ? 'Very High'
    : score >= 75 && observationCount > 90
      ? 'High'
      : score >= 45 && observationCount > 30
        ? 'Medium'
        : 'Low';

  return {
    label,
    score,
    observationCount,
    penalties,
    explanation: `${label} confidence from ${observationCount} stored observation${observationCount === 1 ? '' : 's'}${penalties.length ? ` with ${penalties.length} data quality penalty${penalties.length === 1 ? '' : 'ies'}.` : ' and no data quality penalties.'}`
  };
}

function calculateAttribution(metrics, growthData, capitalAllocation) {
  const stablecoinLiquidity = ratio(metrics.stablecoinMarketCap, metrics.marketCap);
  const revenueMultiple = ratio(metrics.marketCap, metrics.annualizedRevenue);
  const activity = ratio(metrics.perpVolume24h, metrics.marketCap);
  return [
    attributionFactor('stablecoinLiquidity', 'Stablecoin Liquidity Score', stablecoinLiquidity, 'percent', scoreByTarget(stablecoinLiquidity, 0.35), ATTRIBUTION_WEIGHTS.stablecoinLiquidity, 'stablecoin market cap / network market cap'),
    attributionFactor('buybackYield', 'Buyback Yield Score', capitalAllocation.buybackYield, 'percent', scoreByTarget(capitalAllocation.buybackYield, 0.05), ATTRIBUTION_WEIGHTS.buybackYield, 'annual buybacks / network market cap'),
    attributionFactor('revenueMultiple', 'Revenue Multiple Score', revenueMultiple, 'multiple', scoreRevenueMultiple(revenueMultiple), ATTRIBUTION_WEIGHTS.revenueMultiple, 'network market cap / annualized revenue; lower is better'),
    attributionFactor('activity', 'Activity Score', activity, 'percent', scoreByTarget(activity, 0.25), ATTRIBUTION_WEIGHTS.activity, '24h perp volume / network market cap'),
    attributionFactor('growth', 'Growth Score', growthData.revenue30dGrowth, 'percent', scoreGrowth(growthData.revenue30dGrowth), ATTRIBUTION_WEIGHTS.growth, '30d annualized revenue growth when sufficient history exists')
  ];
}

function buildExchangeComparables(metrics, capitalAllocation) {
  return [
    {
      name: 'Hyperliquid',
      revenueYield: capitalAllocation.revenueYield,
      valuationMultiple: ratio(metrics.marketCap, metrics.annualizedRevenue),
      growthRate: null,
      buybackYield: capitalAllocation.buybackYield
    },
    ...EXCHANGE_COMPARABLES
  ];
}

function buildThesis(metrics, growthData, capitalAllocation, fairValue, confidence) {
  const bull = [];
  const base = [];
  const bear = [];

  if ((growthData.revenue30dGrowth ?? -Infinity) > 0.15) bull.push(`Revenue growth is accelerating at ${percent(growthData.revenue30dGrowth)} over 30 days.`);
  if ((capitalAllocation.buybackYield ?? -Infinity) > 0.05) bull.push(`Buyback yield is above 5% at ${percent(capitalAllocation.buybackYield)}.`);
  if ((growthData.stablecoin30dGrowth ?? -Infinity) > 0.05) bull.push(`Stablecoin base is expanding at ${percent(growthData.stablecoin30dGrowth)} over 30 days.`);
  if ((capitalAllocation.revenueYield ?? -Infinity) > 0.05) bull.push(`Revenue yield is above 5% at ${percent(capitalAllocation.revenueYield)}.`);
  if ((growthData.revenue30dGrowth ?? Infinity) < 0) bear.push(`Revenue growth is negative at ${percent(growthData.revenue30dGrowth)} over 30 days.`);
  if ((growthData.buyback30dGrowth ?? Infinity) < 0) bear.push(`Buybacks are declining at ${percent(growthData.buyback30dGrowth)} over 30 days.`);
  if ((growthData.stablecoin30dGrowth ?? Infinity) < 0) bear.push(`Stablecoin market cap is contracting at ${percent(growthData.stablecoin30dGrowth)} over 30 days.`);
  if ((growthData.volume30dGrowth ?? Infinity) < 0) bear.push(`Perp volume is declining at ${percent(growthData.volume30dGrowth)} over 30 days.`);

  const revenueMultiple = ratio(metrics.marketCap, metrics.annualizedRevenue);
  if (revenueMultiple !== null) base.push(`Current valuation is ${revenueMultiple.toFixed(1)}x annualized revenue.`);
  if (fairValue.composite.discount !== null) base.push(`Composite model shows ${fairValue.composite.discount >= 0 ? 'a discount' : 'a premium'} of ${percent(Math.abs(fairValue.composite.discount))}.`);
  base.push(`${confidence.label} confidence based on ${confidence.observationCount} stored observations.`);
  if (!bull.length) bull.push('No confirmed bull-case growth or capital-return triggers are available from current measurable data.');
  if (!bear.length) bear.push('No confirmed bear-case contraction triggers are available from current measurable data.');

  return { bull, base, bear };
}

function buildTransparency(fairValue) {
  return [
    transparencyFormula(fairValue.revenueMultipleModel, 'Revenue Multiple Value'),
    transparencyFormula(fairValue.buybackYieldModel, 'Buyback Value'),
    transparencyFormula(fairValue.dcfModel, 'DCF Value'),
    {
      name: 'Composite Value',
      formula: 'Revenue Multiple Value x 40% + Buyback Value x 40% + DCF Value x 20%',
      inputs: fairValue.composite.components.map(component => ({
        label: `${component.name} (${Math.round(component.weight * 100)}%)`,
        value: component.fairValue,
        format: 'usd'
      })),
      output: { label: 'Composite Value', value: fairValue.composite.fairValue, format: 'usd' }
    }
  ];
}

function calculateSignals(growthData, revenueYield, metrics) {
  const signals = [];
  if ((growthData.revenue30dGrowth ?? -Infinity) > 0.15) signals.push({ severity: 'bullish', label: 'Revenue accelerating', detail: `30d revenue growth ${percent(growthData.revenue30dGrowth)}` });
  if ((growthData.buyback30dGrowth ?? -Infinity) > 0.1) signals.push({ severity: 'bullish', label: 'Buyback velocity increasing', detail: `30d buyback growth ${percent(growthData.buyback30dGrowth)}` });
  if ((growthData.stablecoin30dGrowth ?? -Infinity) > 0.05) signals.push({ severity: 'bullish', label: 'Stablecoin base expanding', detail: `30d stablecoin growth ${percent(growthData.stablecoin30dGrowth)}` });
  if ((revenueYield ?? 0) > 0.05) signals.push({ severity: 'bullish', label: 'Revenue yield above benchmark', detail: `Revenue yield ${percent(revenueYield)}` });
  if ((growthData.revenue30dGrowth ?? 1) < 0) signals.push({ severity: 'warning', label: 'Revenue decelerating', detail: `30d revenue growth ${percent(growthData.revenue30dGrowth)}` });
  if ((growthData.buyback30dGrowth ?? 1) < 0) signals.push({ severity: 'warning', label: 'Buybacks declining', detail: `30d buyback growth ${percent(growthData.buyback30dGrowth)}` });
  if ((growthData.stablecoin30dGrowth ?? 1) < 0) signals.push({ severity: 'warning', label: 'Stablecoin base contracting', detail: `30d stablecoin growth ${percent(growthData.stablecoin30dGrowth)}` });
  if ((growthData.openInterest30dGrowth ?? 1) < 0) signals.push({ severity: 'warning', label: 'Open interest declining', detail: `30d open interest growth ${percent(growthData.openInterest30dGrowth)}` });
  const revenueMultiple = ratio(metrics.marketCap, metrics.annualizedRevenue);
  if ((revenueMultiple ?? 0) > 25) signals.push({ severity: 'warning', label: 'Revenue multiple elevated', detail: `${revenueMultiple.toFixed(1)}x revenue` });
  return signals.length ? signals : [{ severity: 'warning', label: 'Insufficient trend history', detail: 'More daily snapshots are needed for stronger research signals.' }];
}

function growth(history, latest, key, days) {
  if (!latest) return null;
  const current = finite(latest[key]);
  const baseline = history.filter(item => item.timestamp <= latest.timestamp - days * 86_400_000).at(-1);
  const previous = finite(baseline?.[key]);
  if (current === null || previous === null || previous === 0) return null;
  return current / previous - 1;
}

function annualBuybacksFor(metrics, year = 1, revenueCagr = 0) {
  if (metrics.annualizedBuybacks) {
    if (!metrics.annualizedRevenue) return metrics.annualizedBuybacks;
    const ratioValue = metrics.annualizedBuybacks / metrics.annualizedRevenue;
    return metrics.annualizedRevenue * Math.pow(1 + revenueCagr, year - 1) * ratioValue;
  }

  if (metrics.annualizedRevenue) {
    return metrics.annualizedRevenue * Math.pow(1 + revenueCagr, year - 1) * FAIR_VALUE.buybackRatio;
  }

  return null;
}

function remainingSupply(metrics, years, revenueCagr) {
  if (!metrics.circulatingSupply || !metrics.hypePrice) return null;
  let remaining = metrics.circulatingSupply;
  for (let year = 1; year <= years; year += 1) {
    const buybacks = annualBuybacksFor(metrics, year, revenueCagr);
    if (!buybacks) return null;
    remaining = Math.max(0, remaining - buybacks / metrics.hypePrice);
  }
  return remaining / metrics.circulatingSupply;
}

function buildAqaDistribution(scenarios) {
  const bear = scenarios.find(scenario => scenario.name === 'Bear');
  const base = scenarios.find(scenario => scenario.name === 'Base');
  const bull = scenarios.find(scenario => scenario.name === 'Bull');
  if (!bear || !base || !bull) return [];
  return Array.from({ length: 19 }, (_, index) => {
    const percentile = 5 + index * 5;
    const additionalFairValuePerHype = percentile <= 50
      ? interpolate(bear.additionalFairValuePerHype, base.additionalFairValuePerHype, percentile / 50)
      : interpolate(base.additionalFairValuePerHype, bull.additionalFairValuePerHype, (percentile - 50) / 50);
    return { percentile, additionalFairValuePerHype };
  });
}

function buildDataWarnings(growthData, confidence) {
  const warnings = [];
  if (Object.values(growthData).some(value => value === null)) {
    warnings.push('Some growth metrics are unavailable because local history does not cover the required lookback period.');
  }
  for (const penalty of confidence.penalties) warnings.push(penalty.reason);
  return warnings;
}

function transparencyFormula(model, label) {
  return {
    name: model.name,
    formula: model.formula,
    inputs: model.inputs,
    output: { label, value: model.fairValue, format: 'usd' }
  };
}

function attributionFactor(id, label, rawValue, rawFormat, normalizedScore, weight, methodology) {
  return {
    id,
    label,
    rawValue,
    rawFormat,
    normalizedScore,
    weight,
    contribution: normalizedScore === null ? null : normalizedScore * weight,
    methodology
  };
}

function scoreRevenueMultiple(value) {
  if (value === null || value <= 0) return null;
  if (value <= 10) return 100;
  if (value >= 40) return 20;
  return clamp(100 - ((value - 10) / 30) * 80);
}

function scoreGrowth(value) {
  if (value === null) return null;
  return clamp(50 + value * 200);
}

function ratio(numerator, denominator) {
  if (!positive(numerator) || !positive(denominator)) return null;
  return numerator / denominator;
}

function grade(score) {
  const bounded = clamp(Number.isFinite(score) ? score : 55);
  return { score: Math.round(bounded * 10) / 10, grade: letter(bounded) };
}

function letter(score) {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  return 'D';
}

function scoreByTarget(value, target) {
  return value === null || value === undefined ? null : clamp((value / target) * 100);
}

function average(values) {
  const valid = values.filter(value => typeof value === 'number' && Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function percent(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function clamp(value) {
  return Math.min(Math.max(value, 0), 100);
}

function interpolate(start, end, ratioValue) {
  if (finite(start) === null || finite(end) === null) return null;
  return start + (end - start) * ratioValue;
}

function snapshotPath() {
  return path.join(process.cwd(), 'data', 'snapshots.json');
}

async function persistAnalysisSnapshots(history) {
  await fs.mkdir(path.dirname(snapshotPath()), { recursive: true });
  await fs.writeFile(snapshotPath(), `${JSON.stringify(history, null, 2)}\n`, 'utf8');
}
