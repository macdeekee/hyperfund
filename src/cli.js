import { Command, Option } from 'commander';
import ora from 'ora';
import { createConfig } from './config.js';
import { createHyperfundServices } from './services/hyperfundService.js';
import { buildTrendReport } from './services/trendService.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderError } from './ui/errors.js';
import { renderHistory, renderTrend } from './ui/history.js';

export async function runCli(argv = process.argv) {
  const program = new Command();

  program
    .name('hyperfund')
    .description('Professional terminal dashboard for Hyperliquid fundamentals.')
    .version('1.0.0')
    .option('--data-dir <path>', 'directory for cache and snapshots')
    .option('--cache-ttl <ms>', 'cache TTL in milliseconds')
    .option('--timeout <ms>', 'request timeout in milliseconds')
    .option('--retries <count>', 'retry count for transient API failures')
    .option('--aqav2-fee-rate-bps <bps>', 'assumed average AQAv2 fee rate in basis points')
    .option('--refresh', 'force live API refresh and ignore fresh cache')
    .option('--no-cache', 'disable API cache')
    .addOption(new Option('--json', 'print machine-readable JSON').hideHelp())
    .action(async options => {
      await showDashboard(options);
    });

  addRuntimeOptions(program
    .command('snapshot')
    .description('fetch live data, persist today as JSON, and print the snapshot'))
    .option('--no-save', 'fetch without writing the daily snapshot')
    .option('--json', 'print machine-readable JSON')
    .action(async command => {
      const options = mergeOptions(program, command);
      await createSnapshot(options);
    });

  addRuntimeOptions(program
    .command('trend')
    .description('calculate 7d and 30d trends from locally persisted snapshots'))
    .option('--json', 'print machine-readable JSON')
    .action(async command => {
      const options = mergeOptions(program, command);
      await showTrends(options);
    });

  addRuntimeOptions(program
    .command('history')
    .description('list locally persisted daily snapshots'))
    .option('--limit <count>', 'maximum snapshots to display', '30')
    .option('--json', 'print machine-readable JSON')
    .action(async command => {
      const options = mergeOptions(program, command);
      await showHistory(options);
    });

  try {
    await program.parseAsync(argv);
  } catch (error) {
    process.stderr.write(`${renderError(error)}\n`);
    process.exitCode = 1;
  }
}

async function showDashboard(options) {
  const config = createConfig(normalizeOptions(options));
  const { hyperfund, snapshots } = createHyperfundServices(config);

  const snapshot = await withSpinner('Fetching HyperFund live dashboard', options.json, () => hyperfund.fetchSnapshot());
  const saved = await snapshots.saveDaily(snapshot);

  if (options.json) {
    printJson(saved.snapshot);
    return;
  }

  process.stdout.write(renderDashboard(saved.snapshot));
}

async function createSnapshot(options) {
  const config = createConfig(normalizeOptions(options));
  const { hyperfund, snapshots } = createHyperfundServices(config);

  const snapshot = await withSpinner('Fetching HyperFund snapshot', options.json, () => hyperfund.fetchSnapshot());
  const result = options.save === false ? { snapshot, file: null } : await snapshots.saveDaily(snapshot);

  if (options.json) {
    printJson(result.snapshot);
    return;
  }

  process.stdout.write(renderDashboard(result.snapshot));
  if (result.file) {
    process.stdout.write(`Saved snapshot: ${result.file}\n`);
  }
}

async function showTrends(options) {
  const config = createConfig(normalizeOptions(options));
  const { snapshots } = createHyperfundServices(config);
  const report = await buildTrendReport(snapshots);

  if (options.json) {
    printJson(report);
    return;
  }

  process.stdout.write(renderTrend(report));
}

async function showHistory(options) {
  const config = createConfig(normalizeOptions(options));
  const { snapshots } = createHyperfundServices(config);
  const entries = await snapshots.list();
  const limit = Number.parseInt(options.limit, 10);

  if (options.json) {
    printJson(entries.map(entry => entry.snapshot));
    return;
  }

  process.stdout.write(renderHistory(entries, Number.isFinite(limit) && limit > 0 ? limit : 30));
}

async function withSpinner(text, json, action) {
  const spinner = json ? null : ora(text).start();

  try {
    const result = await action();
    spinner?.succeed(text);
    return result;
  } catch (error) {
    spinner?.fail(text);
    throw error;
  }
}

function mergeOptions(program, command) {
  const commandOptions = typeof command?.opts === 'function' ? command.opts() : command ?? {};

  return {
    ...program.opts(),
    ...commandOptions
  };
}

function addRuntimeOptions(command) {
  const runtimeOptions = [
    ['--data-dir <path>', 'directory for cache and snapshots'],
    ['--cache-ttl <ms>', 'cache TTL in milliseconds'],
    ['--timeout <ms>', 'request timeout in milliseconds'],
    ['--retries <count>', 'retry count for transient API failures'],
    ['--aqav2-fee-rate-bps <bps>', 'assumed average AQAv2 fee rate in basis points'],
    ['--refresh', 'force live API refresh and ignore fresh cache'],
    ['--no-cache', 'disable API cache']
  ];

  for (const [flags, description] of runtimeOptions) {
    if (!command.options.some(option => option.flags === flags)) {
      command.option(flags, description);
    }
  }

  return command;
}

function normalizeOptions(options) {
  return {
    ...options,
    cacheTtlMs: options.cacheTtl,
    timeoutMs: options.timeout,
    aqav2FeeRateBps: options.aqav2FeeRateBps
  };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
