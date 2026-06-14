import {
  Activity,
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  Database,
  Gauge,
  LineChart,
  RadioTower,
  ShieldCheck,
  TrendingUp,
  WalletCards
} from 'lucide-react';
import { DashboardCharts } from './components/DashboardCharts';
import { RefreshControl } from './components/RefreshControl';
import { getDashboardData } from './lib/hyperfund-repository';
import { dateTime, number, pct, signedPct, usd, valueClass } from './lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Home() {
  const data = await getDashboardData();
  const latest = data.latest;

  if (!latest) {
    return (
      <main className="shell emptyShell">
        <section className="emptyState">
          <Database size={42} />
          <h1>HyperFund</h1>
          <p>No SQLite snapshots are stored yet.</p>
          <RefreshControl />
        </section>
      </main>
    );
  }

  const metrics = latest.metrics;
  const analysis = (latest as any).analysis;
  const current = analysis.currentMetrics;
  const growth = analysis.growth;
  const fairValue = analysis.fairValue;
  const composite = fairValue.composite;
  const confidence = analysis.confidence;
  const staleSources = (latest.sourceStatus as Array<any>).filter(source => source.stale || !source.ok);
  const valuationModels = [
    fairValue.revenueMultipleModel,
    fairValue.buybackYieldModel,
    fairValue.dcfModel
  ];
  const modelSignal = composite.discount === null
    ? 'Insufficient data'
    : composite.discount > 0.2
      ? 'Cheap'
      : composite.discount > 0.05
        ? 'Slightly cheap'
        : composite.discount < -0.2
          ? 'Expensive'
          : composite.discount < -0.05
            ? 'Slightly expensive'
            : 'Fair value';

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <span className="productMark">HyperVision v2</span>
          <h1>Hyperliquid Research Terminal</h1>
        </div>
        <div className="topActions">
          <span className="statusPill">
            <RadioTower size={15} />
            {staleSources.length ? `${staleSources.length} source warnings` : 'Sources live'}
          </span>
          <RefreshControl />
        </div>
      </header>

      <section className="heroGrid">
        <div className="panel thesisPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Composite Valuation Signal</span>
              <h2>{modelSignal}</h2>
            </div>
            <ShieldCheck size={22} />
          </div>
          <div className="priceRow">
            <div>
              <span className="label">Current HYPE</span>
              <strong>{usd(current.hypePrice, { notation: 'standard' })}</strong>
            </div>
            <div>
              <span className="label">Composite Value</span>
              <strong>{usd(composite.fairValue, { notation: 'standard' })}</strong>
            </div>
            <div>
              <span className="label">Discount / Premium</span>
              <strong className={valueClass(composite.discount)}>{signedPct(composite.discount)}</strong>
            </div>
          </div>
          <div className="modelStrip">
            {composite.components.map((component: any) => (
              <div key={component.name}>
                <span>{component.name}</span>
                <strong>{usd(component.fairValue, { notation: 'standard' })}</strong>
                <small>{pct(component.weight, { maximumFractionDigits: 0 })} weight</small>
              </div>
            ))}
          </div>
        </div>

        <div className="panel marketPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Confidence Engine</span>
              <h2>{confidence.label} Confidence</h2>
            </div>
            <Gauge size={22} />
          </div>
          <div className="confidenceRow compact">
            <span>{confidence.observationCount} observations</span>
            <strong>{number(confidence.score, { maximumFractionDigits: 0 })}/100</strong>
            <div className="confidenceTrack">
              <i style={{ width: `${Math.min(confidence.score ?? 0, 100)}%` }} />
            </div>
          </div>
          <p className="timestamp">{confidence.explanation}</p>
          <div className="warningList">
            {confidence.penalties.length ? confidence.penalties.map((penalty: any) => (
              <span key={penalty.reason}>-{number(penalty.points, { maximumFractionDigits: 0 })} {penalty.reason}</span>
            )) : <span>No data quality penalties.</span>}
          </div>
        </div>
      </section>

      <section className="metricGrid">
        <MetricCard icon={<BadgeDollarSign />} label="Annualized Revenue" value={usd(metrics.annualizedRevenue)} detail={`${usd(metrics.revenue24h)} 24h`} />
        <MetricCard icon={<WalletCards />} label="Annual Buybacks" value={usd(metrics.buybacksAnnualized)} detail={`${usd(metrics.buybacks24h)} 24h`} />
        <MetricCard icon={<Activity />} label="Open Interest" value={usd(metrics.totalOpenInterestUsd)} detail={`${number(metrics.activePerpMarkets)} active markets`} />
        <MetricCard icon={<BarChart3 />} label="24h Perp Volume" value={usd(metrics.totalPerpVolume24h)} detail={`${usd(metrics.hypePerpVolume24h)} HYPE volume`} />
        <MetricCard icon={<Gauge />} label="Overall Grade" value={analysis.health.overall.grade} detail={`${number(analysis.health.overall.score)}/100`} />
        <MetricCard icon={<LineChart />} label="AQAv2 Est. Revenue" value={usd(metrics.aqav2AnnualizedRevenue)} detail={`${usd(metrics.aqav2DailyRevenue)} daily`} />
      </section>

      <section className="contentGrid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Valuation Model Stack</span>
              <h2>Independent Fair Values</h2>
            </div>
          </div>
          <div className="modelGrid">
            {valuationModels.map((model: any) => (
              <MetricBlock key={model.id} label={model.name} value={usd(model.fairValue, { notation: 'standard' })} />
            ))}
            <MetricBlock label="Composite Value" value={usd(composite.fairValue, { notation: 'standard' })} accent="positive" />
            <MetricBlock label="Current Price" value={usd(composite.currentPrice, { notation: 'standard' })} />
            <MetricBlock label="Discount / Premium" value={signedPct(composite.discount)} accent={valueClass(composite.discount)} />
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Capital Allocation Metrics</span>
              <h2>Revenue And Buyback Efficiency</h2>
            </div>
          </div>
          <div className="modelGrid">
            <MetricBlock label="Revenue Yield" value={pct(analysis.capitalAllocation.revenueYield)} />
            <MetricBlock label="Buyback Yield" value={pct(analysis.capitalAllocation.buybackYield)} />
            <MetricBlock label="Payback Period" value={`${number(analysis.capitalAllocation.paybackPeriod)}x`} />
            <MetricBlock label="Revenue / Open Interest" value={pct(analysis.capitalAllocation.revenuePerOpenInterest)} />
            <MetricBlock label="Revenue / Stablecoin $" value={pct(analysis.capitalAllocation.revenuePerStablecoinDollar)} />
          </div>
        </div>
      </section>

      <section className="contentGrid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">HYPE Retirement Engine</span>
              <h2>Supply Absorption</h2>
            </div>
          </div>
          <div className="scenarioTable">
            <TableRow label="Annual HYPE Purchased" value={number(analysis.retirement.annualHypePurchased, { notation: 'compact' })} />
            <TableRow label="Supply Retired Per Year" value={pct(analysis.retirement.annualSupplyRetiredPct)} />
            <TableRow label="Days To Retire 1%" value={number(analysis.retirement.daysToRetireOnePercent, { maximumFractionDigits: 0 })} />
            <TableRow label="5 Year Remaining Supply" value={pct(analysis.retirement.remainingSupply5Y)} />
            <TableRow label="10 Year Remaining Supply" value={pct(analysis.retirement.remainingSupply10Y)} />
            <TableRow label="15 Year Remaining Supply" value={pct(analysis.retirement.remainingSupply15Y)} />
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Growth Engine</span>
              <h2>No Fabricated Lookbacks</h2>
            </div>
            <TrendingUp size={22} />
          </div>
          <GrowthGrid groups={[
            ['Revenue', [['7d', growth.revenue7dGrowth], ['30d', growth.revenue30dGrowth], ['90d', growth.revenue90dGrowth]]],
            ['Buybacks', [['7d', growth.buyback7dGrowth], ['30d', growth.buyback30dGrowth]]],
            ['Stablecoins', [['7d', growth.stablecoin7dGrowth], ['30d', growth.stablecoin30dGrowth]]],
            ['Open Interest', [['7d', growth.openInterest7dGrowth], ['30d', growth.openInterest30dGrowth]]],
            ['Volume', [['7d', growth.volume7dGrowth], ['30d', growth.volume30dGrowth]]]
          ]} />
        </div>
      </section>

      <DashboardCharts
        snapshots={data.snapshots}
        scenarios={valuationModels.map((model: any) => ({
          name: model.name.replace(' Value', ''),
          price: model.fairValue,
          upside: current.hypePrice && model.fairValue ? model.fairValue / current.hypePrice - 1 : null
        }))}
        history={analysis.snapshots}
        retirement={analysis.retirement.projections}
        aqaDistribution={analysis.aqaValuation.distribution}
      />

      <section className="contentGrid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Forecast Attribution Engine</span>
              <h2>Deterministic Factor Stack</h2>
            </div>
          </div>
          <div className="attributionTable">
            <div className="tableHead"><span>Factor</span><span>Raw</span><span>Score</span><span>Weight</span><span>Contribution</span></div>
            {analysis.attribution.map((factor: any) => (
              <div className="tableRow" key={factor.id}>
                <span>{factor.label}<small>{factor.methodology}</small></span>
                <strong>{formatMetric(factor.rawValue, factor.rawFormat)}</strong>
                <strong>{number(factor.normalizedScore, { maximumFractionDigits: 0 })}</strong>
                <strong>{pct(factor.weight, { maximumFractionDigits: 0 })}</strong>
                <strong>{number(factor.contribution, { maximumFractionDigits: 1 })}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Exchange Comparison</span>
              <h2>Where Hyperliquid Sits</h2>
            </div>
          </div>
          <div className="attributionTable compactTable">
            <div className="tableHead"><span>Exchange</span><span>Rev Yield</span><span>Multiple</span><span>Growth</span><span>Buyback</span></div>
            {analysis.exchangeComparables.map((exchange: any) => (
              <div className={exchange.name === 'Hyperliquid' ? 'tableRow primary' : 'tableRow'} key={exchange.name}>
                <span>{exchange.name}</span>
                <strong>{pct(exchange.revenueYield)}</strong>
                <strong>{exchange.valuationMultiple === null ? 'n/a' : `${number(exchange.valuationMultiple)}x`}</strong>
                <strong>{pct(exchange.growthRate)}</strong>
                <strong>{pct(exchange.buybackYield)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="contentGrid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">AQAv2 Valuation Model</span>
              <h2>Incremental Network Value</h2>
            </div>
          </div>
          <div className="scenarioTable">
            {analysis.aqaValuation.scenarios.map((scenario: any) => (
              <div className="scenarioRow richRow" key={scenario.name}>
                <span>{scenario.name}<small>{pct(scenario.expectedMargin)} margin</small></span>
                <strong>{usd(scenario.incrementalRevenue)}</strong>
                <b>{usd(scenario.additionalFairValuePerHype, { notation: 'standard' })}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Investment Thesis</span>
              <h2>Metric-Gated Cases</h2>
            </div>
          </div>
          <div className="thesisGrid">
            <ThesisList label="Bull Case" items={analysis.thesis.bull} tone="positive" />
            <ThesisList label="Base Case" items={analysis.thesis.base} tone="neutral" />
            <ThesisList label="Bear Case" items={analysis.thesis.bear} tone="negative" />
          </div>
        </div>
      </section>

      <section className="contentGrid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Fundamental Health</span>
              <h2>Grade Stack</h2>
            </div>
          </div>
          <div className="gradeGrid">
            <GradeRow label="Revenue Health" grade={analysis.health.revenueHealth} />
            <GradeRow label="Buyback Health" grade={analysis.health.buybackHealth} />
            <GradeRow label="Growth" grade={analysis.health.growth} />
            <GradeRow label="Valuation" grade={analysis.health.valuation} />
            <GradeRow label="Liquidity" grade={analysis.health.liquidity} />
            <GradeRow label="Overall Grade" grade={analysis.health.overall} strong />
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Fundamental Signals</span>
              <h2>Research Signals</h2>
            </div>
          </div>
          <div className="signalList">
            {analysis.signals.map((signal: any) => (
              <div className={`signalRow ${signal.severity}`} key={signal.label}>
                <strong>{signal.severity === 'bullish' ? '✓' : '⚠'} {signal.label}</strong>
                <span>{signal.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel transparencyPanel">
        <details open>
          <summary>How Fair Value Is Calculated</summary>
          <div className="formulaGrid">
            {analysis.transparency.map((formula: any) => (
              <div className="formulaCard" key={formula.name}>
                <strong>{formula.name}</strong>
                <code>{formula.formula}</code>
                <div className="formulaInputs">
                  {formula.inputs.map((input: any) => (
                    <span key={input.label}>{input.label}: <b>{formatMetric(input.value, input.format)}</b></span>
                  ))}
                </div>
                <em>{formula.output.label}: {formatMetric(formula.output.value, formula.output.format)}</em>
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="contentGrid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Data Quality Warnings</span>
              <h2>Model Boundaries</h2>
            </div>
            <AlertTriangle size={21} />
          </div>
          <ul className="riskList">
            {analysis.dataWarnings.length ? analysis.dataWarnings.map((warning: string) => (
              <li key={warning}>{warning}</li>
            )) : <li>No active model data warnings.</li>}
            <li>Forecasts are valuation estimates, not investment advice or guaranteed outcomes.</li>
          </ul>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Source Health</span>
              <h2>Data Integrity</h2>
            </div>
          </div>
          <div className="sourceGrid">
            {(latest.sourceStatus as Array<any>).map(source => (
              <div className="sourceItem" key={source.name}>
                <span className={source.ok && !source.stale ? 'sourceDot ok' : 'sourceDot warn'} />
                <div>
                  <strong>{source.name}</strong>
                  <span>{source.ok ? (source.stale ? 'stale cache' : 'live') : 'failed'}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="timestamp">Captured {dateTime(latest.capturedAt)}. Stored in SQLite via Prisma.</p>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="metricCard">
      <div className="metricIcon">{icon}</div>
      <span className="label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function MetricBlock({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="metricBlock">
      <span className="label">{label}</span>
      <strong className={accent}>{value}</strong>
    </div>
  );
}

function TableRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="scenarioRow">
      <span>{label}</span>
      <strong>{value}</strong>
      <b />
    </div>
  );
}

function GrowthGrid({ groups }: { groups: Array<[string, Array<[string, number | null]>]> }) {
  return (
    <div className="growthGrid">
      {groups.map(([name, rows]) => (
        <div className="growthGroup" key={name}>
          <strong>{name}</strong>
          {rows.map(([label, value]) => (
            <div className="growthRow" key={label}>
              <span>{label}</span>
              <b className={growthClass(value)}>{signedPct(value)}</b>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function GradeRow({ label, grade, strong = false }: { label: string; grade: { grade: string; score: number }; strong?: boolean }) {
  return (
    <div className={strong ? 'gradeRow strong' : 'gradeRow'}>
      <span>{label}</span>
      <strong>{grade.grade}</strong>
      <small>{number(grade.score)}/100</small>
    </div>
  );
}

function ThesisList({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  return (
    <div className={`thesisCase ${tone}`}>
      <strong>{label}</strong>
      {items.map(item => <span key={item}>{item}</span>)}
    </div>
  );
}

function formatMetric(value: number | null, format: string) {
  if (format === 'usd') return usd(value, { notation: 'standard' });
  if (format === 'percent') return pct(value);
  if (format === 'multiple') return value === null ? 'n/a' : `${number(value)}x`;
  return number(value);
}

function growthClass(value: number | null) {
  if (value === null) return 'muted';
  if (value > 0.1) return 'positive';
  if (value >= 0) return 'warning';
  return 'negative';
}
