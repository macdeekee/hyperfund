import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';
import { colorTrend, formatDateTime, formatNumber, formatUsd } from './format.js';

export function renderHistory(entries, limit = 30) {
  const visible = entries.slice(-limit).reverse();

  if (visible.length === 0) {
    return `${boxen(chalk.yellow('No snapshots found. Run `hyperfund snapshot` first.'), {
      padding: 1,
      borderColor: 'yellow'
    })}\n`;
  }

  const table = new Table({
    head: [
      chalk.cyan('Date'),
      chalk.cyan('HYPE'),
      chalk.cyan('MCap'),
      chalk.cyan('Ann. Rev'),
      chalk.cyan('OI'),
      chalk.cyan('Volume'),
      chalk.cyan('Score')
    ],
    style: { head: [], border: [] }
  });

  for (const { snapshot } of visible) {
    table.push([
      snapshot.date,
      formatUsd(snapshot.metrics?.price, { compact: false, digits: 2 }),
      formatUsd(snapshot.metrics?.marketCap),
      formatUsd(snapshot.metrics?.annualizedRevenue),
      formatUsd(snapshot.metrics?.totalOpenInterestUsd),
      formatUsd(snapshot.metrics?.totalPerpVolume24h),
      formatNumber(snapshot.score?.weightedScore, { digits: 1 })
    ]);
  }

  const body = [
    chalk.bold.cyan('HyperFund Snapshot History'),
    chalk.dim(`${entries.length} saved snapshot${entries.length === 1 ? '' : 's'}; showing ${visible.length}`),
    '',
    table.toString()
  ].join('\n');

  return `${boxen(body, { padding: 1, borderStyle: 'round', borderColor: 'cyan' })}\n`;
}

export function renderTrend(report) {
  if (!report.latest) {
    return `${boxen(chalk.yellow('No snapshots found. Run `hyperfund snapshot` first.'), {
      padding: 1,
      borderColor: 'yellow'
    })}\n`;
  }

  const sections = [
    chalk.bold.cyan('HyperFund Trends'),
    chalk.dim(`Latest snapshot ${report.latest.date} (${formatDateTime(report.latest.capturedAt)})`)
  ];

  for (const trend of report.trends) {
    sections.push('', chalk.bold(`${trend.days}d Trend`));

    if (!trend.baseline) {
      sections.push(chalk.yellow(`Need at least two snapshots to calculate ${trend.days}d trend.`));
      continue;
    }

    const table = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Current'), chalk.cyan('Baseline'), chalk.cyan('Change')],
      style: { head: [], border: [] }
    });

    for (const row of trend.rows) {
      table.push([
        row.label,
        formatMetric(row.key, row.current),
        `${formatMetric(row.key, row.previous)} ${chalk.dim(trend.baseline.date)}`,
        formatChange(row.key, row.absoluteChange, row.percentChange)
      ]);
    }

    sections.push(table.toString());
  }

  return `${boxen(sections.join('\n'), {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'cyan'
  })}\n`;
}

function formatMetric(key, value) {
  if (key === 'weightedScore') {
    return formatNumber(value, { digits: 1 });
  }

  return formatUsd(value);
}

function formatChange(key, absoluteChange, percentChange) {
  const absolute = key === 'weightedScore' ? formatNumber(absoluteChange, { digits: 1 }) : formatUsd(absoluteChange);
  return `${absolute} (${colorTrend(percentChange)})`;
}
