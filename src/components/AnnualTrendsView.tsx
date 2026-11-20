import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
} from 'lucide-react';
import {
  AnnualTrendMonthPoint,
  AnnualTrendsReport,
  OverallHealthMetrics,
  exportAnnualTrendsToCSV,
} from '../lib/analytics';
import { formatTZS, formatUSD } from '../lib/currency';
import {
  DisplayCurrencyMode,
  EntryType,
  UserPreferences,
} from '../types/finance';
import { DualAmount } from './DualAmount';

interface AnnualTrendsViewProps {
  year: number;
  currentCalendarYear: number;
  currentMonthKey: string;
  availableYears: number[];
  onYearChange: (year: number) => void;
  report: AnnualTrendsReport;
  overall: OverallHealthMetrics;
  preferences: UserPreferences;
  displayMode: DisplayCurrencyMode;
  theme: 'light' | 'dark';
  onOpenNewEntry: (presetType?: EntryType) => void;
}

type SeriesKey = 'savings' | 'spending' | 'debtReduction';

interface SeriesMeta {
  key: SeriesKey;
  label: string;
  strokeLight: string;
  strokeDark: string;
  dotBg: string;
  cumUsdKey: keyof AnnualTrendMonthPoint;
  cumTzsKey: keyof AnnualTrendMonthPoint;
  monthUsdKey: keyof AnnualTrendMonthPoint;
  monthTzsKey: keyof AnnualTrendMonthPoint;
}

const SERIES_META: SeriesMeta[] = [
  {
    key: 'savings',
    label: 'Cumulative Savings',
    strokeLight: '#2563eb',
    strokeDark: '#60a5fa',
    dotBg: 'bg-blue-600 dark:bg-blue-400',
    cumUsdKey: 'cumulativeSavingsUSD',
    cumTzsKey: 'cumulativeSavingsTZS',
    monthUsdKey: 'savingsUSD',
    monthTzsKey: 'savingsTZS',
  },
  {
    key: 'spending',
    label: 'Cumulative Spending',
    strokeLight: '#e11d48',
    strokeDark: '#fb7185',
    dotBg: 'bg-rose-600 dark:bg-rose-400',
    cumUsdKey: 'cumulativeSpendingUSD',
    cumTzsKey: 'cumulativeSpendingTZS',
    monthUsdKey: 'spendingUSD',
    monthTzsKey: 'spendingTZS',
  },
  {
    key: 'debtReduction',
    label: 'Cumulative Debt Reduction',
    strokeLight: '#059669',
    strokeDark: '#34d399',
    dotBg: 'bg-emerald-600 dark:bg-emerald-400',
    cumUsdKey: 'cumulativeDebtReductionUSD',
    cumTzsKey: 'cumulativeDebtReductionTZS',
    monthUsdKey: 'debtReductionUSD',
    monthTzsKey: 'debtReductionTZS',
  },
];

function formatCompactAxisTick(value: number, useTzs: boolean): string {
  if (value === 0) return useTzs ? '0' : '$0';
  const abs = Math.abs(value);
  if (useTzs) {
    if (abs >= 1_000_000) {
      const m = value / 1_000_000;
      return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
    }
    if (abs >= 1_000) {
      return `${Math.round(value / 1_000)}k`;
    }
    return String(Math.round(value));
  }
  if (abs >= 1_000_000) {
    const m = value / 1_000_000;
    return `$${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = value / 1_000;
    return `$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `$${Math.round(value)}`;
}

interface CustomTooltipPayloadItem {
  color?: string;
  dataKey?: string;
  name?: string;
  payload?: AnnualTrendMonthPoint;
}

interface AnnualTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  displayMode: DisplayCurrencyMode;
  mode: 'cumulative' | 'monthly';
}

const AnnualChartTooltip: React.FC<AnnualTooltipProps> = ({
  active,
  payload,
  displayMode,
  mode,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const rows = [
    {
      key: 'savings',
      label: mode === 'cumulative' ? 'Cumulative Savings' : 'Monthly Savings',
      dotClass: 'bg-blue-600 dark:bg-blue-400',
      usd: mode === 'cumulative' ? point.cumulativeSavingsUSD : point.savingsUSD,
      tzs: mode === 'cumulative' ? point.cumulativeSavingsTZS : point.savingsTZS,
    },
    {
      key: 'spending',
      label: mode === 'cumulative' ? 'Cumulative Spending' : 'Monthly Spending',
      dotClass: 'bg-rose-600 dark:bg-rose-400',
      usd: mode === 'cumulative' ? point.cumulativeSpendingUSD : point.spendingUSD,
      tzs: mode === 'cumulative' ? point.cumulativeSpendingTZS : point.spendingTZS,
    },
    {
      key: 'debtReduction',
      label: mode === 'cumulative' ? 'Cumulative Debt Reduction' : 'Monthly Debt Reduction',
      dotClass: 'bg-emerald-600 dark:bg-emerald-400',
      usd: mode === 'cumulative' ? point.cumulativeDebtReductionUSD : point.debtReductionUSD,
      tzs: mode === 'cumulative' ? point.cumulativeDebtReductionTZS : point.debtReductionTZS,
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-3.5 py-2.5 text-xs min-w-[230px]">
      <div className="flex items-center justify-between gap-4 pb-1.5 mb-2 border-b border-slate-100 dark:border-slate-800">
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {point.fullMonthLabel}
        </span>
        <span className="text-slate-500 dark:text-slate-400 tabular-nums">
          {point.entryCount} {point.entryCount === 1 ? 'entry' : 'entries'}
        </span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-start justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className={`w-2 h-2 rounded-xs shrink-0 ${r.dotClass}`} />
              {r.label}
            </span>
            <div className="text-right font-mono tabular-nums">
              {displayMode === 'TZS' ? (
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatTZS(r.tzs)}
                </span>
              ) : displayMode === 'USD' ? (
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatUSD(r.usd)}
                </span>
              ) : (
                <>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatUSD(r.usd)}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formatTZS(r.tzs)}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AnnualTrendsView: React.FC<AnnualTrendsViewProps> = ({
  year,
  currentCalendarYear,
  currentMonthKey,
  availableYears,
  onYearChange,
  report,
  overall,
  preferences,
  displayMode,
  theme,
  onOpenNewEntry,
}) => {
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({
    savings: true,
    spending: true,
    debtReduction: true,
  });

  const useTzsAxis = displayMode === 'TZS';
  const isDark = theme === 'dark';

  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisTickColor = isDark ? '#94a3b8' : '#64748b';

  const annualSavingsGoalUsd = Math.max(0, preferences.monthlySavingsGoalUsd * 12);
  const annualSavingsGoalTzs = Math.round(
    annualSavingsGoalUsd * (preferences.exchangeRateTzsPerUsd || 2650)
  );
  const annualSavingsGoalPct =
    annualSavingsGoalUsd > 0
      ? Math.round((report.totalSavings.usd / annualSavingsGoalUsd) * 1000) / 10
      : 0;

  const avgMonthlySpendUsd =
    report.activeMonthsCount > 0
      ? report.totalSpending.usd / report.activeMonthsCount
      : 0;
  const avgMonthlySpendTzs =
    report.activeMonthsCount > 0
      ? report.totalSpending.tzs / report.activeMonthsCount
      : 0;

  const debtPrincipalUsd = overall.totalDebtPrincipal.usd;
  const yearDebtReductionSharePct =
    debtPrincipalUsd > 0
      ? Math.min(100, Math.round((report.totalDebtReduction.usd / debtPrincipalUsd) * 1000) / 10)
      : 0;

  const wealthProgressDual = useMemo(
    () => ({
      usd: Math.round((report.totalSavings.usd + report.totalDebtReduction.usd) * 100) / 100,
      tzs: Math.round(report.totalSavings.tzs + report.totalDebtReduction.tzs),
    }),
    [report.totalSavings, report.totalDebtReduction]
  );

  const toggleSeries = (key: SeriesKey) => {
    setVisibleSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.savings && !next.spending && !next.debtReduction) {
        return prev; // keep at least one active
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Year & Export Controls Bar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              {year} Calendar Year Financial Trajectory
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              Jan–Dec {year} · {report.activeMonthsCount} of 12 months active · {report.entryCount}{' '}
              {report.entryCount === 1 ? 'journal entry' : 'journal entries'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {availableYears.length > 1 && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                {availableYears.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onYearChange(y)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer tabular-nums ${
                      y === year
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => onYearChange(year - 1)}
                aria-label="Previous calendar year"
                className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-md cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                {year}
              </span>
              <button
                type="button"
                onClick={() => onYearChange(year + 1)}
                aria-label="Next calendar year"
                className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-md cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {year !== currentCalendarYear && (
              <button
                type="button"
                onClick={() => onYearChange(currentCalendarYear)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Current Year ({currentCalendarYear})
              </button>
            )}

            <button
              type="button"
              onClick={() => exportAnnualTrendsToCSV(report, preferences)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export {year} CSV
            </button>
          </div>
        </div>
      </section>

      {/* 4-Card Annual KPI Summary Strip */}
      <section
        aria-label="Annual cumulative performance summary"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Cumulative Savings ({year})</span>
            <span className="font-medium text-blue-700 dark:text-blue-400 tabular-nums">
              {annualSavingsGoalUsd > 0 ? `${annualSavingsGoalPct}% of goal` : 'YTD Saved'}
            </span>
          </div>
          <DualAmount
            usd={report.totalSavings.usd}
            tzs={report.totalSavings.tzs}
            mode={displayMode}
            className="text-xl font-bold text-slate-900 dark:text-slate-100"
          />
          {annualSavingsGoalUsd > 0 && (
            <div className="mt-2.5 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-blue-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, annualSavingsGoalPct))}%` }}
              />
            </div>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 tabular-nums">
            {annualSavingsGoalUsd > 0
              ? `Annual target: ${
                  displayMode === 'TZS'
                    ? formatTZS(annualSavingsGoalTzs)
                    : formatUSD(annualSavingsGoalUsd)
                }`
              : report.peakSavingsMonthLabel
              ? `Peak month: ${report.peakSavingsMonthLabel} ${year}`
              : 'No savings logged yet'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Cumulative Spending ({year})</span>
            <span className="font-medium text-rose-700 dark:text-rose-400">
              {report.peakSpendingMonthLabel ? `Peak ${report.peakSpendingMonthLabel}` : 'Outflow'}
            </span>
          </div>
          <DualAmount
            usd={report.totalSpending.usd}
            tzs={report.totalSpending.tzs}
            mode={displayMode}
            className="text-xl font-bold text-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 tabular-nums">
            Avg active month:{' '}
            {displayMode === 'TZS'
              ? formatTZS(avgMonthlySpendTzs)
              : formatUSD(avgMonthlySpendUsd)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Cumulative Debt Reduction</span>
            <span className="font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
              {debtPrincipalUsd > 0 ? `${yearDebtReductionSharePct}% of principal` : 'Principal'}
            </span>
          </div>
          <DualAmount
            usd={report.totalDebtReduction.usd}
            tzs={report.totalDebtReduction.tzs}
            mode={displayMode}
            className="text-xl font-bold text-emerald-700 dark:text-emerald-400"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 tabular-nums">
            Remaining debt:{' '}
            {displayMode === 'TZS'
              ? formatTZS(overall.totalDebtRemaining.tzs)
              : formatUSD(overall.totalDebtRemaining.usd)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Savings + Debt Cleared</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">
              {report.totalIncome.usd > 0
                ? `${Math.round((wealthProgressDual.usd / report.totalIncome.usd) * 1000) / 10}% of gains`
                : 'Net Builder'}
            </span>
          </div>
          <DualAmount
            usd={wealthProgressDual.usd}
            tzs={wealthProgressDual.tzs}
            mode={displayMode}
            className="text-xl font-bold text-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 tabular-nums">
            {report.totalIncome.usd > 0
              ? `YTD income: ${
                  displayMode === 'TZS'
                    ? formatTZS(report.totalIncome.tzs)
                    : formatUSD(report.totalIncome.usd)
                }`
              : 'Combined annual balance-sheet gain'}
          </p>
        </div>
      </section>

      {report.entryCount === 0 ? (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center transition-colors">
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            No Journal Entries Recorded for {year}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
            Log savings allocations, spending expenses, or debt repayments in {year} to populate
            your 12-month cumulative curves.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onOpenNewEntry('saving')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Savings Entry
            </button>
            {availableYears.some((y) => y !== year) && (
              <button
                type="button"
                onClick={() => {
                  const target = availableYears.find((y) => y !== year);
                  if (target) onYearChange(target);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Jump to {availableYears.find((y) => y !== year)}
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
          {/* Hero Recharts Cumulative Area Chart */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  Cumulative Annual Trends ({year})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Running year-to-date totals from January through December ({useTzsAxis ? 'TZS' : 'USD scale · hover for dual currency'})
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {SERIES_META.map((s) => {
                  const active = visibleSeries[s.key];
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleSeries(s.key)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 opacity-70'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-xs ${s.dotBg}`} />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={report.points}
                  margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="gradSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={isDark ? '#60a5fa' : '#2563eb'}
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor={isDark ? '#60a5fa' : '#2563eb'}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient id="gradSpending" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={isDark ? '#fb7185' : '#e11d48'}
                        stopOpacity={0.22}
                      />
                      <stop
                        offset="95%"
                        stopColor={isDark ? '#fb7185' : '#e11d48'}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient id="gradDebtReduction" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={isDark ? '#34d399' : '#059669'}
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor={isDark ? '#34d399' : '#059669'}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={gridStroke}
                  />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fill: axisTickColor, fontSize: 12 }}
                    axisLine={{ stroke: gridStroke }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: axisTickColor, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={62}
                    tickFormatter={(val: number) => formatCompactAxisTick(val, useTzsAxis)}
                  />
                  <Tooltip
                    content={
                      <AnnualChartTooltip
                        displayMode={displayMode}
                        mode="cumulative"
                      />
                    }
                  />

                  {visibleSeries.spending && (
                    <Area
                      type="monotone"
                      dataKey={useTzsAxis ? 'cumulativeSpendingTZS' : 'cumulativeSpendingUSD'}
                      name="Cumulative Spending"
                      stroke={isDark ? '#fb7185' : '#e11d48'}
                      strokeWidth={2.25}
                      fill="url(#gradSpending)"
                      activeDot={{ r: 5 }}
                    />
                  )}
                  {visibleSeries.savings && (
                    <Area
                      type="monotone"
                      dataKey={useTzsAxis ? 'cumulativeSavingsTZS' : 'cumulativeSavingsUSD'}
                      name="Cumulative Savings"
                      stroke={isDark ? '#60a5fa' : '#2563eb'}
                      strokeWidth={2.5}
                      fill="url(#gradSavings)"
                      activeDot={{ r: 5 }}
                    />
                  )}
                  {visibleSeries.debtReduction && (
                    <Area
                      type="monotone"
                      dataKey={
                        useTzsAxis
                          ? 'cumulativeDebtReductionTZS'
                          : 'cumulativeDebtReductionUSD'
                      }
                      name="Cumulative Debt Reduction"
                      stroke={isDark ? '#34d399' : '#059669'}
                      strokeWidth={2.5}
                      fill="url(#gradDebtReduction)"
                      activeDot={{ r: 5 }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Monthly Activity Breakdown BarChart */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  Monthly Savings, Spending &amp; Debt Reduction ({year})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Individual month-by-month comparison alongside the cumulative trend above
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 dark:bg-blue-400" />
                  Savings
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 dark:bg-rose-400" />
                  Spending
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-400" />
                  Debt Reduction
                </span>
              </div>
            </div>

            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.points}
                  margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={gridStroke}
                  />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fill: axisTickColor, fontSize: 12 }}
                    axisLine={{ stroke: gridStroke }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: axisTickColor, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={62}
                    tickFormatter={(val: number) => formatCompactAxisTick(val, useTzsAxis)}
                  />
                  <Tooltip
                    content={
                      <AnnualChartTooltip
                        displayMode={displayMode}
                        mode="monthly"
                      />
                    }
                  />
                  {visibleSeries.savings && (
                    <Bar
                      dataKey={useTzsAxis ? 'savingsTZS' : 'savingsUSD'}
                      name="Monthly Savings"
                      fill={isDark ? '#60a5fa' : '#2563eb'}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                  )}
                  {visibleSeries.spending && (
                    <Bar
                      dataKey={useTzsAxis ? 'spendingTZS' : 'spendingUSD'}
                      name="Monthly Spending"
                      fill={isDark ? '#fb7185' : '#e11d48'}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                  )}
                  {visibleSeries.debtReduction && (
                    <Bar
                      dataKey={useTzsAxis ? 'debtReductionTZS' : 'debtReductionUSD'}
                      name="Monthly Debt Reduction"
                      fill={isDark ? '#34d399' : '#059669'}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* 12-Month Cumulative Breakdown Table */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  12-Month Cumulative Ledger ({year})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Monthly figures and cumulative year-to-date running totals across all 12 months
                </p>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Currency mode: {displayMode === 'BOTH' ? 'USD + TZS' : displayMode}
              </span>
            </div>

            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pr-4 font-semibold">Month</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Mo. Savings</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Cum. Savings</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Mo. Spending</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Cum. Spending</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Mo. Debt Paid</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Cum. Debt Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 tabular-nums">
                  {report.points.map((p) => {
                    const isSelectedMonth = p.monthKey === currentMonthKey;
                    const fmtCell = (usd: number, tzs: number) =>
                      displayMode === 'TZS' ? formatTZS(tzs) : formatUSD(usd);
                    return (
                      <tr
                        key={p.monthKey}
                        className={
                          isSelectedMonth
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/30 font-medium'
                            : p.entryCount === 0
                            ? 'text-slate-400 dark:text-slate-500'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {p.monthLabel} {year}
                          </span>
                          {isSelectedMonth && (
                            <span className="ml-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                              · Current
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {fmtCell(p.savingsUSD, p.savingsTZS)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-blue-700 dark:text-blue-400">
                          {fmtCell(p.cumulativeSavingsUSD, p.cumulativeSavingsTZS)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {fmtCell(p.spendingUSD, p.spendingTZS)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-700 dark:text-rose-400">
                          {fmtCell(p.cumulativeSpendingUSD, p.cumulativeSpendingTZS)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {fmtCell(p.debtReductionUSD, p.debtReductionTZS)}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          {fmtCell(
                            p.cumulativeDebtReductionUSD,
                            p.cumulativeDebtReductionTZS
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
