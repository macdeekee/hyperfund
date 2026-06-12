import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';
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
    `${chalk.bold('Fundamental Score')}: ${scoreColor(snapshot.score.weightedScore)(
      `${snapshot.score.weightedScore}/100`
    )} ${chalk.dim(snapshot.score.rating)}`,
    scoreTable.toString(),
    '',
    chalk.bold('Valuation Scenarios'),
    valuationTable.toString(),
    '',
    ratioLine(metrics),
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
