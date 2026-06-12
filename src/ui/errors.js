import chalk from 'chalk';

export function renderError(error) {
  const message = error?.message ?? String(error);
  const cause = error?.cause?.message;

  return [chalk.red.bold('HyperFund failed'), chalk.red(message), cause ? chalk.dim(cause) : null]
    .filter(Boolean)
    .join('\n');
}
