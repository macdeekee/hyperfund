'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { compactDate, pct, signedPct, usd } from '../lib/format';

type ChartSnapshot = {
  date: string;
  metrics: {
    price?: number | null;
    annualizedRevenue?: number | null;
    totalPerpVolume24h?: number | null;
    stablecoinMarketCap?: number | null;
    weightedScore?: number | null;
  };
};

type Scenario = {
  name: string;
  price: number | null;
  upside: number | null;
};

type HistorySnapshot = {
  date: string;
  revenue: number | null;
  buybacks: number | null;
  stablecoins: number | null;
  openInterest: number | null;
  revenueYield: number | null;
};

type RetirementPoint = {
  year: number;
  constantRevenue: number | null;
  revenueUp20: number | null;
  revenueDown20: number | null;
};

type AqaDistributionPoint = {
  percentile: number;
  additionalFairValuePerHype: number | null;
};

export function DashboardCharts({
  snapshots,
  scenarios,
  history,
  retirement,
  aqaDistribution
}: {
  snapshots: ChartSnapshot[];
  scenarios: Scenario[];
  history: HistorySnapshot[];
  retirement: RetirementPoint[];
  aqaDistribution: AqaDistributionPoint[];
}) {
  const [mounted, setMounted] = useState(false);
  const series = snapshots.map(snapshot => ({
    date: snapshot.date,
    label: compactDate(`${snapshot.date}T00:00:00Z`),
    price: snapshot.metrics.price,
    revenue: snapshot.metrics.annualizedRevenue,
    volume: snapshot.metrics.totalPerpVolume24h,
    stablecoins: snapshot.metrics.stablecoinMarketCap,
    score: snapshot.metrics.weightedScore
  }));
  const historySeries = history.map(snapshot => ({
    date: snapshot.date,
    label: compactDate(`${snapshot.date}T00:00:00Z`),
    revenue: snapshot.revenue,
    buybacks: snapshot.buybacks,
    stablecoins: snapshot.stablecoins,
    openInterest: snapshot.openInterest,
    revenueYield: snapshot.revenueYield
  }));
  const retirementSeries = retirement.map(point => ({
    year: `Y${point.year}`,
    constantRevenue: point.constantRevenue,
    revenueUp20: point.revenueUp20,
    revenueDown20: point.revenueDown20
  }));
  const aqaSeries = aqaDistribution.map(point => ({
    percentile: `P${point.percentile}`,
    additionalFairValuePerHype: point.additionalFairValuePerHype
  }));

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="chartGrid">
      <section className="panel chartPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">Time Series</span>
            <h2>Price, Revenue, And Liquidity</h2>
          </div>
        </div>
        <div className="chartCanvas">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <AreaChart data={series} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="priceFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#36d399" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#36d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8f9b93', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis hide yAxisId="left" />
                <YAxis hide yAxisId="right" />
                <Tooltip content={<SeriesTooltip />} />
                <Area yAxisId="left" type="monotone" dataKey="price" stroke="#36d399" fill="url(#priceFill)" strokeWidth={2} dot={false} />
                <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#fbbf24" fill="url(#revenueFill)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chartSkeleton" />
          )}
        </div>
      </section>

      <section className="panel chartPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">Valuation Models</span>
            <h2>Independent Fair Values</h2>
          </div>
        </div>
        <div className="chartCanvas">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <BarChart data={scenarios} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#8f9b93', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip content={<ScenarioTooltip />} />
                <Bar dataKey="price" radius={[6, 6, 0, 0]}>
                  {scenarios.map(scenario => (
                    <Cell
                      key={scenario.name}
                      fill={scenario.name.includes('Buyback') ? '#36d399' : scenario.name.includes('DCF') ? '#38bdf8' : '#fbbf24'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chartSkeleton" />
          )}
        </div>
      </section>

      <section className="panel chartPanel wideChart">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">Historical Trend Charts</span>
            <h2>Revenue, Buybacks, Adoption, And Yield</h2>
          </div>
        </div>
        <div className="chartCanvas">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <AreaChart data={historySeries} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="buybackFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="oiFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8f9b93', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis hide yAxisId="left" />
                <YAxis hide yAxisId="right" />
                <Tooltip content={<HistoryTooltip />} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#fbbf24" fill="url(#revenueFill)" strokeWidth={2} dot={false} />
                <Area yAxisId="left" type="monotone" dataKey="buybacks" stroke="#a78bfa" fill="url(#buybackFill)" strokeWidth={2} dot={false} />
                <Area yAxisId="right" type="monotone" dataKey="stablecoins" stroke="#36d399" fill="url(#priceFill)" strokeWidth={2} dot={false} />
                <Area yAxisId="right" type="monotone" dataKey="openInterest" stroke="#38bdf8" fill="url(#oiFill)" strokeWidth={2} dot={false} />
                <Area yAxisId="left" type="monotone" dataKey="revenueYield" stroke="#fb7185" fill="transparent" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chartSkeleton" />
          )}
        </div>
      </section>

      <section className="panel chartPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">HYPE Retirement Engine</span>
            <h2>Projected Supply Decay</h2>
          </div>
        </div>
        <div className="chartCanvas">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <AreaChart data={retirementSeries} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#8f9b93', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 1]} />
                <Tooltip content={<RetirementTooltip />} />
                <Area type="monotone" dataKey="revenueDown20" name="-20% CAGR" stroke="#fb7185" fill="transparent" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="constantRevenue" name="Constant" stroke="#fbbf24" fill="transparent" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="revenueUp20" name="+20% CAGR" stroke="#36d399" fill="transparent" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chartSkeleton" />
          )}
        </div>
      </section>

      <section className="panel chartPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">AQAv2 Distribution</span>
            <h2>Incremental Fair Value Range</h2>
          </div>
        </div>
        <div className="chartCanvas">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <BarChart data={aqaSeries} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="percentile" tick={{ fill: '#8f9b93', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip content={<AqaDistributionTooltip />} />
                <Bar dataKey="additionalFairValuePerHype" radius={[6, 6, 0, 0]} fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chartSkeleton" />
          )}
        </div>
      </section>
    </div>
  );
}

function SeriesTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="tooltip">
      <strong>{label}</strong>
      <span>HYPE {usd(row.price, { notation: 'standard' })}</span>
      <span>Revenue {usd(row.revenue)}</span>
      <span>Volume {usd(row.volume)}</span>
      <span>Stables {usd(row.stablecoins)}</span>
    </div>
  );
}

function ScenarioTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="tooltip">
      <strong>{label}</strong>
      <span>Fair price {usd(row.price, { notation: 'standard' })}</span>
      <span>Upside {signedPct(row.upside)}</span>
    </div>
  );
}

function HistoryTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="tooltip">
      <strong>{label}</strong>
      <span>Revenue {usd(row.revenue)}</span>
      <span>Buybacks {usd(row.buybacks)}</span>
      <span>Stablecoins {usd(row.stablecoins)}</span>
      <span>Open Interest {usd(row.openInterest)}</span>
      <span>Revenue Yield {signedPct(row.revenueYield)}</span>
    </div>
  );
}

function RetirementTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="tooltip">
      <strong>{label}</strong>
      <span>Constant {pct(row.constantRevenue)}</span>
      <span>+20% CAGR {pct(row.revenueUp20)}</span>
      <span>-20% CAGR {pct(row.revenueDown20)}</span>
    </div>
  );
}

function AqaDistributionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="tooltip">
      <strong>{label}</strong>
      <span>Incremental value {usd(row.additionalFairValuePerHype, { notation: 'standard' })}</span>
    </div>
  );
}
