import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';
import asciichart from 'asciichart';
import { colorTrend, formatDateTime, formatNumber, formatPercent, formatUsd } from './format.js';

export function renderDashboard(snapshot) {
  const metrics = snapshot.metrics;

  const summaryTable = new Table({
    chars: tableChars(),
    style: { head: [], border: [] },
    wordWrap: true,
    colWidths: [28, 22, 34]
  });

  summaryTable.push(
    ['HYPE Price', chalk.bold(formatUsd(metrics.price, { compact: false, digits: 2 })), 'DL price / HL'],
    ['Market Cap', chalk.bold(formatUsd(metrics.marketCap)), 'Protocol mcap'],
    ['Annualized Revenue', chalk.bold(formatUsd(metrics.annualizedRevenue)), '7d run-rate'],
    ['Buybacks', chalk.bold(formatUsd(metrics.buybacksAnnualized)), `${formatUsd(metrics.buybacks24h)} 24h`],
    ['Stablecoin Market Cap', chalk.bold(formatUsd(metrics.stablecoinMarketCap)), 'HL L1 stables'],
    ['AQAv2 Est. Revenue', chalk.bold(formatUsd(metrics.aqav2AnnualizedRevenue)), 'Volume estimate'],
    ['Open Interest', chalk.bold(formatUsd(metrics.totalOpenInterestUsd)), `${formatNumber(metrics.activePerpMarkets)} active markets`],
    ['24h Perp Volume', chalk.bold(formatUsd(metrics.totalPerpVolume24h)), 'dayNtlVlm sum']
  );

  const valuationTable = new Table({
    head: [chalk.cyan('Revenue Multiple'), chalk.cyan('Implied MCap'), chalk.cyan('Implied HYPE'), chalk.cyan('Upside')],
    chars: tableChars(),
    style: { head: [], border: [] }
  });

  for (const scenario of snapshot.valuationScenarios) {
    valuationTable.push([
      `${scenario.multiple}x`,
      formatUsd(scenario.impliedMarketCap),
      formatUsd(scenario.impliedPrice, { compact: false, digits: 2 }),
      colorTrend(scenario.upside)
    ]);
  }

  const scoreTable = new Table({
    head: [chalk.cyan('Component'), chalk.cyan('Weight'), chalk.cyan('Score')],
    chars: tableChars(),
    style: { head: [], border: [] }
  });

  for (const component of snapshot.score.components) {
    scoreTable.push([
      component.name,
      formatPercent(component.weight, { digits: 0 }),
      scoreColor(component.score)(formatNumber(component.score, { digits: 1 }))
    ]);
  }

  const sourceWarnings = snapshot.sourceStatus
    .filter(source => !source.ok || source.stale)
    .map(source => {
      if (!source.ok) {
        return `${source.name}: ${source.message}`;
      }

      return `${source.name}: using stale cache from ${formatDateTime(source.fetchedAt)}`;
    });

  const body = [
    chalk.bold.cyan('HyperFund'),
    chalk.dim(`Captured ${formatDateTime(snapshot.capturedAt)}`),
    '',
    summaryTable.toString(),
    '',
    snapshot.analysis ? renderAnalysis(snapshot.analysis) : `${chalk.bold('Fundamental Score')}: ${scoreColor(snapshot.score.weightedScore)(
      `${snapshot.score.weightedScore}/100`
    )} ${chalk.dim(snapshot.score.rating)}`,
    snapshot.analysis ? '' : scoreTable.toString(),
    snapshot.analysis ? '' : '',
    snapshot.analysis ? '' : chalk.bold('Valuation Scenarios'),
    snapshot.analysis ? '' : valuationTable.toString(),
    snapshot.analysis ? '' : '',
    snapshot.analysis ? '' : ratioLine(metrics),
    snapshot.analysis ? renderCharts(snapshot.analysis) : '',
    sourceWarnings.length ? `${chalk.yellow('Warnings')}\n${sourceWarnings.map(item => `- ${item}`).join('\n')}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  return `${boxen(body, {
    padding: 1,
    margin: 0,
    borderStyle: 'round',
    borderColor: 'cyan'
  })}\n`;
}

function renderAnalysis(analysis) {
  const sections = [
    renderValuationStack(analysis.fairValue),
    renderRetirement(analysis.retirement),
    renderCapitalAllocation(analysis.capitalAllocation),
    renderConfidence(analysis.confidence),
    renderGrowthEngine(analysis.growth),
    renderBuybackVelocity(analysis.buybackVelocity),
    renderAqaValuation(analysis.aqaValuation),
    renderExchangeComparables(analysis.exchangeComparables),
    renderAttribution(analysis.attribution),
    renderHealth(analysis.health),
    renderThesis(analysis.thesis),
    renderSignals(analysis.signals),
    renderTransparency(analysis.transparency)
  ];

  return sections.join('\n\n');
}

function renderValuationStack(fairValue) {
  const table = new Table({ chars: tableChars(), style: { head: [], border: [] }, colWidths: [28, 18, 16] });
  table.push(
    ['Revenue Multiple Value', formatUsd(fairValue.revenueMultipleModel.fairValue, { compact: false, digits: 2 }), `${formatNumber(fairValue.revenueMultiple)}x`],
    ['Buyback Value', formatUsd(fairValue.buybackYieldModel.fairValue, { compact: false, digits: 2 }), `${formatPercent(fairValue.targetBuybackYield)} target`],
    ['DCF Value', formatUsd(fairValue.dcfModel.fairValue, { compact: false, digits: 2 }), `${formatPercent(fairValue.growthRate)} growth`],
    [chalk.bold('Composite Value'), chalk.bold(formatUsd(fairValue.composite.fairValue, { compact: false, digits: 2 })), colorTrend(fairValue.composite.discount)]
  );

  return `${chalk.bold('Valuation Model Stack')}\n${chalk.dim('Composite weights: 40% revenue multiple / 40% buyback yield / 20% DCF')}\n${table.toString()}`;
}

function renderRetirement(retirement) {
  const table = new Table({ chars: tableChars(), style: { head: [], border: [] }, colWidths: [30, 18] });
  table.push(
    ['Annual HYPE Purchased', formatNumber(retirement.annualHypePurchased, { compact: true, digits: 1 })],
    ['Supply Retired Per Year', formatPercent(retirement.annualSupplyRetiredPct)],
    ['Days To Retire 1%', formatNumber(retirement.daysToRetireOnePercent, { digits: 0 })],
    ['5 Year Remaining Supply', formatPercent(retirement.remainingSupply5Y)],
    ['10 Year Remaining Supply', formatPercent(retirement.remainingSupply10Y)],
    ['15 Year Remaining Supply', formatPercent(retirement.remainingSupply15Y)]
  );

  return `${chalk.bold('HYPE Retirement Engine')}\n${table.toString()}`;
}

function renderCapitalAllocation(metrics) {
  const table = new Table({ chars: tableChars(), style: { head: [], border: [] }, colWidths: [30, 18] });
  table.push(
    ['Revenue Yield', formatPercent(metrics.revenueYield)],
    ['Buyback Yield', formatPercent(metrics.buybackYield)],
    ['Payback Period', `${formatNumber(metrics.paybackPeriod)}x`],
    ['Revenue / Open Interest', formatPercent(metrics.revenuePerOpenInterest)],
    ['Revenue / Stablecoin $', formatPercent(metrics.revenuePerStablecoinDollar)]
  );

  return `${chalk.bold('Capital Allocation Metrics')}\n${table.toString()}`;
}

function renderConfidence(confidence) {
  const penalties = confidence.penalties.length
    ? confidence.penalties.map(penalty => chalk.yellow(`- ${penalty.points} ${penalty.reason}`)).join('\n')
    : chalk.dim('No data quality penalties.');
  return [
    chalk.bold('Confidence Engine'),
    `${confidence.label} (${formatNumber(confidence.score, { digits: 0 })}/100) from ${formatNumber(confidence.observationCount, { digits: 0 })} observations`,
    chalk.dim(confidence.explanation),
    penalties
  ].join('\n');
}

function renderGrowthEngine(growth) {
  const table = new Table({ chars: tableChars(), style: { head: [], border: [] }, colWidths: [18, 12, 12, 12] });
  table.push(
    ['Revenue', growthColor(growth.revenue7dGrowth), growthColor(growth.revenue30dGrowth), growthColor(growth.revenue90dGrowth)],
    ['Buybacks', growthColor(growth.buyback7dGrowth), growthColor(growth.buyback30dGrowth), chalk.dim('n/a')],
    ['Stablecoins', growthColor(growth.stablecoin7dGrowth), growthColor(growth.stablecoin30dGrowth), chalk.dim('n/a')],
    ['Open Interest', growthColor(growth.openInterest7dGrowth), growthColor(growth.openInterest30dGrowth), chalk.dim('n/a')],
    ['Volume', growthColor(growth.volume7dGrowth), growthColor(growth.volume30dGrowth), chalk.dim('n/a')]
  );

  return `${chalk.bold('Growth Engine')}\n${chalk.dim('Metric             7d          30d         90d')}\n${table.toString()}`;
}

function renderBuybackVelocity(velocity) {
  const table = new Table({ chars: tableChars(), style: { head: [], border: [] }, colWidths: [28, 18] });
  table.push(
    ['Annual HYPE Purchased', formatNumber(velocity.annualHypePurchased, { compact: true, digits: 1 })],
    ['Supply Absorption', formatPercent(velocity.supplyAbsorptionRate)],
    ['Days To Buy 1% Supply', formatNumber(velocity.daysToBuyOnePercent, { digits: 0 })],
    ['Buybacks Last 24h', formatUsd(velocity.buybacksLast24h)],
    ['Buybacks Last 30d', formatUsd(velocity.buybacksLast30d)]
  );
  return `${chalk.bold('Buyback Velocity')}\n${table.toString()}`;
}

function renderAqaValuation(aqaValuation) {
  const table = new Table({
    head: [chalk.cyan('Scenario'), chalk.cyan('Incremental Rev'), chalk.cyan('Buybacks'), chalk.cyan('Addl HYPE')],
    chars: tableChars(),
    style: { head: [], border: [] }
  });
  for (const scenario of aqaValuation.scenarios) {
    table.push([
      scenario.name,
      formatUsd(scenario.incrementalRevenue),
      formatUsd(scenario.incrementalBuybacks),
      formatUsd(scenario.additionalFairValuePerHype, { compact: false, digits: 2 })
    ]);
  }
  return `${chalk.bold('AQAv2 Valuation Model')}\n${table.toString()}`;
}

function renderExchangeComparables(comparables) {
  const table = new Table({
    head: [chalk.cyan('Exchange'), chalk.cyan('Rev Yield'), chalk.cyan('Multiple'), chalk.cyan('Growth'), chalk.cyan('Buyback')],
    chars: tableChars(),
    style: { head: [], border: [] }
  });
  for (const comparable of comparables) {
    table.push([
      comparable.name,
      comparable.name === 'Hyperliquid' ? yieldColor(comparable.revenueYield) : formatPercent(comparable.revenueYield),
      comparable.valuationMultiple === null ? chalk.dim('n/a') : `${formatNumber(comparable.valuationMultiple)}x`,
      formatPercent(comparable.growthRate),
      formatPercent(comparable.buybackYield)
    ]);
  }
  return `${chalk.bold('Exchange Comparison')}\n${table.toString()}`;
}

function renderAttribution(attribution) {
  const table = new Table({
    head: [chalk.cyan('Factor'), chalk.cyan('Raw'), chalk.cyan('Score'), chalk.cyan('Weight'), chalk.cyan('Contribution')],
    chars: tableChars(),
    style: { head: [], border: [] }
  });
  for (const factor of attribution) {
    table.push([
      factor.label,
      formatRaw(factor.rawValue, factor.rawFormat),
      formatNumber(factor.normalizedScore, { digits: 0 }),
      formatPercent(factor.weight, { digits: 0 }),
      formatNumber(factor.contribution, { digits: 1 })
    ]);
  }
  return `${chalk.bold('Forecast Attribution Engine')}\n${table.toString()}`;
}

function renderHealth(health) {
  const table = new Table({ chars: tableChars(), style: { head: [], border: [] }, colWidths: [22, 8, 12] });
  table.push(
    ['Revenue Health', gradeColor(health.revenueHealth.grade), formatNumber(health.revenueHealth.score)],
    ['Buyback Health', gradeColor(health.buybackHealth.grade), formatNumber(health.buybackHealth.score)],
    ['Growth', gradeColor(health.growth.grade), formatNumber(health.growth.score)],
    ['Valuation', gradeColor(health.valuation.grade), formatNumber(health.valuation.score)],
    ['Liquidity', gradeColor(health.liquidity.grade), formatNumber(health.liquidity.score)],
    [chalk.bold('Overall Grade'), gradeColor(health.overall.grade), formatNumber(health.overall.score)]
  );
  return `${chalk.bold('Fundamental Health')}\n${table.toString()}`;
}

function renderSignals(signals) {
  return [
    chalk.bold('Fundamental Signals'),
    ...signals.map(signal => signal.severity === 'bullish'
      ? chalk.green(`✓ ${signal.label} ${chalk.dim(signal.detail)}`)
      : chalk.yellow(`⚠ ${signal.label} ${chalk.dim(signal.detail)}`))
  ].join('\n');
}

function renderThesis(thesis) {
  return [
    chalk.bold('Investment Thesis'),
    chalk.green('Bull Case'),
    ...thesis.bull.map(item => `- ${item}`),
    chalk.cyan('Base Case'),
    ...thesis.base.map(item => `- ${item}`),
    chalk.red('Bear Case'),
    ...thesis.bear.map(item => `- ${item}`)
  ].join('\n');
}

function renderTransparency(transparency) {
  return [
    chalk.bold('How Fair Value Is Calculated'),
    ...transparency.map(formula => `${chalk.cyan(formula.name)}: ${formula.formula} = ${formatRaw(formula.output.value, formula.output.format)}`)
  ].join('\n');
}

function renderCharts(analysis) {
  if (!analysis.snapshots || analysis.snapshots.length < 2) {
    return chalk.dim('Historical Trend Charts\nNeed more stored snapshots for ASCII charts.');
  }

  const lines = [chalk.bold('Historical Trend Charts')];
  for (const [label, key] of [
    ['Revenue', 'revenue'],
    ['Buybacks', 'buybacks'],
    ['Stablecoins', 'stablecoins'],
    ['Open Interest', 'openInterest'],
    ['Revenue Yield', 'revenueYield']
  ]) {
    const values = analysis.snapshots
      .map(snapshot => snapshot[key])
      .filter(value => typeof value === 'number' && Number.isFinite(value));
    if (values.length >= 2) {
      lines.push(chalk.cyan(label));
      lines.push(asciichart.plot(values, { height: 5, format: compactAxis }));
    }
  }

  return lines.join('\n');
}

function growthColor(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return chalk.dim('n/a');
  const formatted = `${value > 0 ? '+' : ''}${formatPercent(value)}`;
  if (value > 0.1) return chalk.green(formatted);
  if (value >= 0) return chalk.yellow(formatted);
  return chalk.red(formatted);
}

function yieldColor(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return chalk.dim('n/a');
  return value > 0.05 ? chalk.green(formatPercent(value)) : chalk.yellow(formatPercent(value));
}

function formatRaw(value, format) {
  if (format === 'usd') return formatUsd(value, { compact: false, digits: 2 });
  if (format === 'percent') return formatPercent(value);
  if (format === 'multiple') return typeof value === 'number' && Number.isFinite(value) ? `${formatNumber(value)}x` : chalk.dim('n/a');
  return formatNumber(value);
}

function gradeColor(grade) {
  if (grade.startsWith('A')) return chalk.green(grade);
  if (grade.startsWith('B')) return chalk.yellow(grade);
  return chalk.red(grade);
}

function compactAxis(value) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (absolute < 1 && absolute > -1) return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(0);
}

function ratioLine(metrics) {
  const parts = [
    `Rev multiple ${formatNumber(metrics.revenueMultiple, { digits: 1 })}x`,
    `Buyback yield ${formatPercent(metrics.buybackYield)}`,
    `Stables/MCap ${formatPercent(metrics.stablecoinToMarketCap)}`,
    `Volume/MCap ${formatPercent(metrics.volumeToMarketCap)}`
  ];

  return chalk.dim(parts.join(' | '));
}

function scoreColor(score) {
  if (score >= 80) return chalk.greenBright;
  if (score >= 65) return chalk.green;
  if (score >= 50) return chalk.yellow;
  if (score >= 35) return chalk.hex('#f59e0b');
  return chalk.red;
}

function tableChars() {
  return {
    top: '',
    'top-mid': '',
    'top-left': '',
    'top-right': '',
    bottom: '',
    'bottom-mid': '',
    'bottom-left': '',
    'bottom-right': '',
    left: '',
    'left-mid': '',
    mid: '',
    'mid-mid': '',
    right: '',
    'right-mid': '',
    middle: '  '
  };
}
