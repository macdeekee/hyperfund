const SCENARIOS = {
  bear: { multipleOffset: -5, revenueHaircut: 0.82 },
  base: { multipleOffset: 0, revenueHaircut: 1 },
  bull: { multipleOffset: 8, revenueHaircut: 1.22 }
};

export function buildForecast(snapshot, history = []) {
  const metrics = snapshot.metrics ?? {};
  const currentPrice = finite(metrics.price);
  const marketCap = finite(metrics.marketCap);
  const revenueBase = finite(metrics.annualizedRevenue) ?? finite(metrics.aqav2AnnualizedRevenue);
  const impliedSupply = currentPrice && marketCap ? marketCap / currentPrice : null;
  const quality = calculateQuality(metrics);
  const momentum = calculateMomentum(snapshot, history);
  const baseMultiple = clamp(10 + quality.multipleLift + momentum.multipleLift, 7, 28);

  const bearMultiple = clamp(baseMultiple + SCENARIOS.bear.multipleOffset, 5, 18);
  const bullMultiple = clamp(baseMultiple + SCENARIOS.bull.multipleOffset, 12, 40);
  const fairBear = fairPrice({ revenueBase, impliedSupply, multiple: bearMultiple, revenueHaircut: SCENARIOS.bear.revenueHaircut });
  const fairBase = fairPrice({ revenueBase, impliedSupply, multiple: baseMultiple, revenueHaircut: SCENARIOS.base.revenueHaircut });
  const fairBull = fairPrice({ revenueBase, impliedSupply, multiple: bullMultiple, revenueHaircut: SCENARIOS.bull.revenueHaircut });

  const forecast = {
    currentPrice,
    fairBear,
    fairBase,
    fairBull,
    bearUpside: upside(fairBear, currentPrice),
    baseUpside: upside(fairBase, currentPrice),
    bullUpside: upside(fairBull, currentPrice),
    signal: signalFor(upside(fairBase, currentPrice)),
    confidenceScore: confidenceScore(snapshot, history),
    assumptions: {
      revenueBase,
      impliedSupply,
      baseMultiple,
      bearMultiple,
      bullMultiple,
      revenueMomentum: momentum.revenueMomentum,
      volumeMomentum: momentum.volumeMomentum,
      scoreMomentum: momentum.scoreMomentum,
      methodology:
        'Scenario fair value = revenue run-rate x scenario multiple / implied circulating supply. Multiples are adjusted by liquidity, buyback yield, valuation, activity, score, and local momentum.'
    },
    drivers: [...quality.drivers, ...momentum.drivers]
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, 8)
  };

  return {
    ...forecast,
    confidence: confidenceLabel(forecast.confidenceScore)
  };
}

function calculateQuality(metrics) {
  const drivers = [];
  let multipleLift = 0;

  const revenueMultiple = finite(metrics.revenueMultiple);
  if (revenueMultiple) {
    const impact = revenueMultiple < 18 ? 1.9 : revenueMultiple < 28 ? 0.6 : -1.8;
    multipleLift += impact;
    drivers.push(driver('Revenue multiple', impact, 1 / revenueMultiple, `${round(revenueMultiple, 1)}x revenue multiple`));
  }

  const buybackYield = finite(metrics.buybackYield);
  if (buybackYield !== null) {
    const impact = scale(buybackYield, 0.02, 0.08, -0.8, 2.5);
    multipleLift += impact;
    drivers.push(driver('Buyback yield', impact, buybackYield, `${percent(buybackYield)} annualized buyback yield proxy`));
  }

  const stablecoinToMarketCap = finite(metrics.stablecoinToMarketCap);
  if (stablecoinToMarketCap !== null) {
    const impact = scale(stablecoinToMarketCap, 0.12, 0.45, -0.8, 1.8);
    multipleLift += impact;
    drivers.push(driver('Stablecoin liquidity', impact, stablecoinToMarketCap, `${percent(stablecoinToMarketCap)} stablecoin base vs market cap`));
  }

  const volumeToMarketCap = finite(metrics.volumeToMarketCap);
  if (volumeToMarketCap !== null) {
    const impact = scale(volumeToMarketCap, 0.08, 0.42, -1, 2);
    multipleLift += impact;
    drivers.push(driver('Trading activity', impact, volumeToMarketCap, `${percent(volumeToMarketCap)} daily volume vs market cap`));
  }

  const score = finite(metrics.weightedScore);
  if (score !== null) {
    const impact = scale(score, 35, 85, -1.2, 1.8);
    multipleLift += impact;
    drivers.push(driver('Fundamental score', impact, score, `${round(score, 1)}/100 composite score`));
  }

  return { multipleLift, drivers };
}

function calculateMomentum(snapshot, history) {
  const previous = history
    .filter(item => item.date < snapshot.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const drivers = [];
  let multipleLift = 0;

  const revenueMomentum = revenueAcceleration(snapshot.metrics);
  if (revenueMomentum !== null) {
    const impact = scale(revenueMomentum, -0.25, 0.35, -1.6, 1.8);
    multipleLift += impact;
    drivers.push(driver('Revenue acceleration', impact, revenueMomentum, `7d revenue run-rate vs 30d revenue run-rate: ${percent(revenueMomentum)}`));
  }

  const volumeMomentum = previous
    ? change(snapshot.metrics?.totalPerpVolume24h, previous.metrics?.totalPerpVolume24h)
    : null;
  if (volumeMomentum !== null) {
    const impact = scale(volumeMomentum, -0.3, 0.3, -1.2, 1.2);
    multipleLift += impact;
    drivers.push(driver('Volume momentum', impact, volumeMomentum, `Change vs previous stored snapshot: ${percent(volumeMomentum)}`));
  }

  const scoreMomentum = previous ? change(snapshot.score?.weightedScore, previous.score?.weightedScore) : null;
  if (scoreMomentum !== null) {
    const impact = scale(scoreMomentum, -0.12, 0.12, -0.8, 0.8);
    multipleLift += impact;
    drivers.push(driver('Score momentum', impact, scoreMomentum, `Composite score change vs previous snapshot: ${percent(scoreMomentum)}`));
  }

  return { multipleLift, drivers, revenueMomentum, volumeMomentum, scoreMomentum };
}

function revenueAcceleration(metrics = {}) {
  const revenue7d = finite(metrics.revenue7d);
  const revenue30d = finite(metrics.revenue30d);

  if (!revenue7d || !revenue30d) {
    return null;
  }

  return (revenue7d / 7) / (revenue30d / 30) - 1;
}

function fairPrice({ revenueBase, impliedSupply, multiple, revenueHaircut }) {
  if (!revenueBase || !impliedSupply) {
    return null;
  }

  return (revenueBase * revenueHaircut * multiple) / impliedSupply;
}

function confidenceScore(snapshot, history) {
  const metrics = snapshot.metrics ?? {};
  const populated = [
    metrics.price,
    metrics.marketCap,
    metrics.annualizedRevenue,
    metrics.stablecoinMarketCap,
    metrics.totalOpenInterestUsd,
    metrics.totalPerpVolume24h,
    metrics.buybackYield
  ].filter(value => finite(value) !== null).length;
  const sourceStatuses = Array.isArray(snapshot.sourceStatus) ? snapshot.sourceStatus : [];
  const sourceCoverage = sourceStatuses.length
    ? sourceStatuses.filter(source => source.ok && !source.stale).length / sourceStatuses.length
    : 0.5;
  const historyDepth = clamp(history.length / 30, 0, 1);

  return round((populated / 7) * 45 + sourceCoverage * 35 + historyDepth * 20, 1);
}

function confidenceLabel(score) {
  if (score >= 78) return 'High';
  if (score >= 55) return 'Medium';
  return 'Low';
}

function signalFor(baseUpside) {
  if (baseUpside === null) return 'Insufficient data';
  if (baseUpside >= 0.3) return 'Deep value';
  if (baseUpside >= 0.1) return 'Undervalued';
  if (baseUpside >= -0.1) return 'Fair value';
  if (baseUpside >= -0.25) return 'Expensive';
  return 'Stretched';
}

function driver(label, impact, value, detail) {
  return {
    label,
    direction: impact >= 0 ? 'positive' : 'negative',
    impact: round(impact, 2),
    value,
    detail
  };
}

function upside(fair, current) {
  if (!fair || !current) {
    return null;
  }

  return fair / current - 1;
}

function change(current, previous) {
  const currentNumber = finite(current);
  const previousNumber = finite(previous);

  if (currentNumber === null || previousNumber === null || previousNumber === 0) {
    return null;
  }

  return currentNumber / previousNumber - 1;
}

function scale(value, low, high, min, max) {
  const number = finite(value);
  if (number === null) return 0;
  const ratio = clamp((number - low) / (high - low), 0, 1);
  return min + ratio * (max - min);
}

function percent(value) {
  const number = finite(value);
  if (number === null) return 'n/a';
  return `${round(number * 100, 1)}%`;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
