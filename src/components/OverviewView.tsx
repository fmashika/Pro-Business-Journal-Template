import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Download,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  DailyCashFlowPoint,
  DayOfWeekPattern,
  MonthlySummary,
  OverallHealthMetrics,
  exportMonthToCSV,
  exportMonthlySummaryToCSV,
  getMonthLabel,
} from '../lib/analytics';
import { formatTZS, formatUSD } from '../lib/currency';
import {
  DisplayCurrencyMode,
  ENTRY_TYPE_META,
  JournalEntry,
  UserPreferences,
} from '../types/finance';
import { CashFlowChart } from './CashFlowChart';
import { DualAmount } from './DualAmount';

interface OverviewViewProps {
  monthKey: string;
  entries: JournalEntry[];
  summary: MonthlySummary;
  prevSummary: MonthlySummary;
  overall: OverallHealthMetrics;
  dailySeries: DailyCashFlowPoint[];
  dayOfWeek: DayOfWeekPattern[];
  preferences: UserPreferences;
  displayMode: DisplayCurrencyMode;
  onOpenNewEntry: (presetType?: JournalEntry['type'], presetAmountUsd?: number) => void;
  onOpenStoryImport: () => void;
  onNavigate: (tab: 'journal' | 'stewardship' | 'reserves' | 'settings') => void;
  onLoadSampleData: () => Promise<void>;
  seedingSample: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  monthKey,
  entries,
  summary,
  prevSummary,
  overall,
  dailySeries,
  dayOfWeek,
  preferences,
  displayMode,
  onOpenNewEntry,
  onOpenStoryImport,
  onNavigate,
  onLoadSampleData,
  seedingSample,
}) => {
  const monthEntries = entries
    .filter((e) => e.monthKey === monthKey)
    .sort((a, b) => b.date.localeCompare(a.date));

  const incomeDeltaPct =
    prevSummary.income.usd > 0
      ? Math.round(((summary.income.usd - prevSummary.income.usd) / prevSummary.income.usd) * 1000) /
        10
      : null;

  if (entries.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 max-w-2xl mx-auto mt-8 text-center transition-colors">
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Your Business &amp; Stewardship Journal is Ready
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 leading-relaxed max-w-lg mx-auto">
          Start logging daily transactions in USD or TZS to uncover cash flow patterns, track
          emergency uses, monitor debt milestones, and automatically compute your{' '}
          {preferences.titheRatePercent}% tithe on money gained.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onOpenNewEntry('income')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Log First Entry
          </button>
          <button
            type="button"
            onClick={onOpenStoryImport}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            Write Story Entry
          </button>
          <button
            type="button"
            onClick={onLoadSampleData}
            disabled={seedingSample}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            {seedingSample ? 'Loading Sample Ledger...' : 'Load Sample USD & TZS Month'}
          </button>
        </div>
      </div>
    );
  }

  const allocationRows = [
    {
      label: 'Money Gained (Business & Income)',
      dual: summary.income,
      pct: summary.income.usd > 0 ? 100 : 0,
      tone: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: 'Operating & Living Spending',
      dual: summary.spending,
      pct: summary.spendingRatioPct,
      tone: 'text-rose-700 dark:text-rose-400',
    },
    {
      label: 'Savings Allocated',
      dual: summary.saving,
      pct:
        summary.income.usd > 0
          ? Math.round((summary.saving.usd / summary.income.usd) * 1000) / 10
          : 0,
      tone: 'text-blue-700 dark:text-blue-400',
    },
    {
      label: 'Emergency Reserve Funded',
      dual: summary.emergencyFunded,
      pct:
        summary.income.usd > 0
          ? Math.round((summary.emergencyFunded.usd / summary.income.usd) * 1000) / 10
          : 0,
      tone: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: 'Emergency Uses Drawn',
      dual: summary.emergencyUsed,
      pct:
        summary.income.usd > 0
          ? Math.round((summary.emergencyUsed.usd / summary.income.usd) * 1000) / 10
          : 0,
      tone: 'text-amber-700 dark:text-amber-400',
    },
    {
      label: 'Investments Deployed',
      dual: summary.investment,
      pct: summary.investmentRatePct,
      tone: 'text-blue-700 dark:text-blue-400',
    },
    {
      label: 'Debt Principal Repaid',
      dual: summary.debtRepaid,
      pct:
        summary.income.usd > 0
          ? Math.round((summary.debtRepaid.usd / summary.income.usd) * 1000) / 10
          : 0,
      tone: 'text-slate-800 dark:text-slate-200',
    },
    {
      label: `Tithe Paid (${preferences.titheRatePercent}% Rule)`,
      dual: summary.tithePaid,
      pct:
        summary.income.usd > 0
          ? Math.round((summary.tithePaid.usd / summary.income.usd) * 1000) / 10
          : 0,
      tone: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: 'Offering & Charity Given',
      dual: summary.offering,
      pct:
        summary.income.usd > 0
          ? Math.round((summary.offering.usd / summary.income.usd) * 1000) / 10
          : 0,
      tone: 'text-slate-800 dark:text-slate-200',
    },
  ];

  const isPositiveNet = summary.netCashFlow.usd >= 0;
  const rate =
    preferences.exchangeRateTzsPerUsd > 0 ? preferences.exchangeRateTzsPerUsd : 2650;
  const savingsGoalUsd = Math.max(0, preferences.monthlySavingsGoalUsd || 0);
  const savingsGoalTzs = Math.round(savingsGoalUsd * rate);
  const actualSavedUsd = summary.saving.usd;
  const actualSavedTzs = summary.saving.tzs;
  const savingsGoalPct =
    savingsGoalUsd > 0
      ? Math.round((actualSavedUsd / savingsGoalUsd) * 1000) / 10
      : actualSavedUsd > 0
      ? 100
      : 0;
  const remainingSavingsUsd = Math.max(
    0,
    Math.round((savingsGoalUsd - actualSavedUsd) * 100) / 100
  );
  const remainingSavingsTzs = Math.max(0, Math.round(savingsGoalTzs - actualSavedTzs));
  const surplusSavingsUsd = Math.max(
    0,
    Math.round((actualSavedUsd - savingsGoalUsd) * 100) / 100
  );
  const surplusSavingsTzs = Math.max(0, Math.round(actualSavedTzs - savingsGoalTzs));
  const savingsGoalMet = savingsGoalUsd > 0 && actualSavedUsd >= savingsGoalUsd;

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <section aria-label="Monthly key financial indicators" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Total Money Gained</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Inflow
            </span>
          </div>
          <DualAmount
            usd={summary.income.usd}
            tzs={summary.income.tzs}
            mode={displayMode}
            className="text-2xl font-bold text-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 tabular-nums">
            {incomeDeltaPct !== null
              ? `${incomeDeltaPct >= 0 ? '+' : ''}${incomeDeltaPct}% vs ${getMonthLabel(prevSummary.monthKey)}`
              : `${summary.entryCount} entries in ${getMonthLabel(monthKey)}`}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Net Cash Flow</span>
            <span
              className={`font-medium ${
                isPositiveNet
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {isPositiveNet ? 'Surplus' : 'Deficit'}
            </span>
          </div>
          <DualAmount
            usd={summary.netCashFlow.usd}
            tzs={summary.netCashFlow.tzs}
            mode={displayMode}
            className={`text-2xl font-bold ${
              isPositiveNet
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 tabular-nums">
            Outflows:{' '}
            {displayMode === 'TZS'
              ? formatTZS(summary.totalOutflows.tzs)
              : formatUSD(summary.totalOutflows.usd)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Operating Spending</span>
            <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 font-medium">
              <ArrowDownRight className="w-3.5 h-3.5" />
              {summary.spendingRatioPct}% of gain
            </span>
          </div>
          <DualAmount
            usd={summary.spending.usd}
            tzs={summary.spending.tzs}
            mode={displayMode}
            className="text-2xl font-bold text-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 tabular-nums">
            Emergency uses:{' '}
            {displayMode === 'TZS'
              ? formatTZS(summary.emergencyUsed.tzs)
              : formatUSD(summary.emergencyUsed.usd)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Tithe ({preferences.titheRatePercent}% of Gains)</span>
            <span
              className={`font-medium ${
                summary.titheBalanceDue.usd <= 0.01
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {summary.titheBalanceDue.usd <= 0.01 ? 'Settled' : 'Balance Due'}
            </span>
          </div>
          <DualAmount
            usd={summary.titheAccrued.usd}
            tzs={summary.titheAccrued.tzs}
            mode={displayMode}
            className="text-2xl font-bold text-slate-900 dark:text-slate-100"
          />
          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 tabular-nums">
              Due:{' '}
              {displayMode === 'TZS'
                ? formatTZS(summary.titheBalanceDue.tzs)
                : formatUSD(summary.titheBalanceDue.usd)}
            </span>
            {summary.titheBalanceDue.usd > 0.5 && (
              <button
                type="button"
                onClick={() => onOpenNewEntry('tithe', summary.titheBalanceDue.usd)}
                className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline cursor-pointer whitespace-nowrap"
              >
                Settle Now
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Cash Flow Pattern Chart + Weekday Pattern */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Daily Cash Flow Pattern — {getMonthLabel(monthKey)}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Day-by-day inflows against total outflows and cumulative net trajectory
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportMonthToCSV(entries, monthKey)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export Entries CSV
            </button>
          </div>
          <CashFlowChart series={dailySeries} displayMode={displayMode} />
        </div>

        <div className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col transition-colors">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Weekday Cash Velocity
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
            Which days generate inflows vs absorb outflows
          </p>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="text-left font-medium py-2">Day</th>
                  <th className="text-right font-medium py-2">Inflow</th>
                  <th className="text-right font-medium py-2">Outflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {dayOfWeek.map((d) => (
                  <tr key={d.dayLabel} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="py-2.5 text-slate-700 dark:text-slate-300 font-medium">
                      {d.dayLabel}
                      <span className="text-slate-400 dark:text-slate-500 font-normal ml-1.5">· {d.txCount}</span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {displayMode === 'TZS' ? formatTZS(d.inflowTZS) : formatUSD(d.inflowUSD)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-rose-700 dark:text-rose-400">
                      {displayMode === 'TZS' ? formatTZS(d.outflowTZS) : formatUSD(d.outflowUSD)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Monthly Allocation Breakdown + Financial Health Assessment */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Monthly Capital &amp; Stewardship Summary
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                How every unit gained in {getMonthLabel(monthKey)} was deployed · Rate: 1 USD ={' '}
                {preferences.exchangeRateTzsPerUsd.toLocaleString()} TZS
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportMonthlySummaryToCSV(summary, overall, preferences)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-700 rounded-lg hover:bg-slate-800 dark:hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export Summary CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="text-left font-medium py-2.5">Pillar</th>
                  <th className="text-right font-medium py-2.5">Share of Gains</th>
                  <th className="text-right font-medium py-2.5">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {allocationRows.map((row) => (
                  <tr key={row.label} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="py-3 text-slate-800 dark:text-slate-200 font-medium">{row.label}</td>
                    <td className="py-3 text-right font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                      {row.pct}%
                    </td>
                    <td className="py-3">
                      <DualAmount
                        usd={row.dual.usd}
                        tzs={row.dual.tzs}
                        mode={displayMode}
                        align="right"
                        className={`text-sm font-semibold ${row.tone}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 transition-colors">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Overall Financial Health Indicators
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cumulative resilience, stewardship, and debt reduction across your journal
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {/* Monthly Savings Goal Progress Bar */}
            <div className="py-3.5 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  Monthly Savings Goal
                </span>
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  {savingsGoalUsd > 0 ? (
                    <>
                      <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                        {displayMode === 'TZS'
                          ? `${formatTZS(actualSavedTzs)} / ${formatTZS(savingsGoalTzs)}`
                          : `${formatUSD(actualSavedUsd)} / ${formatUSD(savingsGoalUsd)}`}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold ${
                          savingsGoalMet
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {savingsGoalMet && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        {savingsGoalPct}%
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      No goal set
                    </span>
                  )}
                </div>
              </div>

              {displayMode === 'BOTH' && savingsGoalUsd > 0 && (
                <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 text-right mt-0.5">
                  {formatTZS(actualSavedTzs)} / {formatTZS(savingsGoalTzs)}
                </div>
              )}

              <div
                className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden"
                role="progressbar"
                aria-label="Monthly cumulative savings goal progress"
                aria-valuenow={Math.min(100, Math.max(0, Math.round(savingsGoalPct)))}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    savingsGoalMet
                      ? 'bg-emerald-600 dark:bg-emerald-500'
                      : savingsGoalPct >= 50
                      ? 'bg-blue-600 dark:bg-blue-500'
                      : 'bg-amber-500 dark:bg-amber-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, savingsGoalPct))}%` }}
                />
              </div>

              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="tabular-nums">
                  {savingsGoalUsd <= 0 ? (
                    'Configure a monthly savings target in Settings to track progress.'
                  ) : savingsGoalMet ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      Goal reached
                      {surplusSavingsUsd > 0
                        ? ` (+${
                            displayMode === 'TZS'
                              ? formatTZS(surplusSavingsTzs)
                              : formatUSD(surplusSavingsUsd)
                          } above target)`
                        : ''}
                    </span>
                  ) : (
                    <>
                      {displayMode === 'TZS'
                        ? formatTZS(remainingSavingsTzs)
                        : formatUSD(remainingSavingsUsd)}{' '}
                      left to reach {getMonthLabel(monthKey)} target
                    </>
                  )}
                </span>
                <div className="flex items-center gap-2.5 shrink-0">
                  {remainingSavingsUsd > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenNewEntry('saving', remainingSavingsUsd)}
                      className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline cursor-pointer whitespace-nowrap"
                    >
                      + Log Savings
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate('settings')}
                    className="text-slate-600 dark:text-slate-300 font-medium hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Edit Goal
                  </button>
                </div>
              </div>
            </div>

            <div className="py-3.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-200">Savings &amp; Reserve Rate</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {summary.savingsRatePct}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(100, summary.savingsRatePct)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {summary.savingsRatePct >= 20
                  ? 'Above 20% target benchmark for healthy business capital retention.'
                  : 'Below 20% benchmark; consider increasing monthly reserve allocations.'}
              </p>
            </div>

            <div className="py-3.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-200">Emergency Runway Coverage</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {overall.emergencyRunwayMonths} mo / {preferences.emergencyTargetMonths} mo goal
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      (overall.emergencyRunwayMonths /
                        Math.max(1, preferences.emergencyTargetMonths)) *
                        100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                Net Reserve:{' '}
                {displayMode === 'TZS'
                  ? formatTZS(overall.emergencyReserveNet.tzs)
                  : formatUSD(overall.emergencyReserveNet.usd)}{' '}
                (after{' '}
                {displayMode === 'TZS'
                  ? formatTZS(overall.emergencyUsesTotal.tzs)
                  : formatUSD(overall.emergencyUsesTotal.usd)}{' '}
                emergency uses)
              </p>
            </div>

            <div className="py-3.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-200">Tithe &amp; Offering Generosity</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {summary.generosityRatePct}% of gains
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, summary.titheCompletionPct)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {summary.titheCompletionPct}% of this month&apos;s {preferences.titheRatePercent}%
                tithe settled ·{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('stewardship')}
                  className="text-emerald-700 dark:text-emerald-400 font-medium hover:underline cursor-pointer"
                >
                  Open Tithe Ledger
                </button>
              </p>
            </div>

            <div className="py-3.5 last:pb-0">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-200">Debt Payoff Milestone Progress</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {overall.debtPayoffPct}% repaid
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-slate-900 dark:bg-slate-200 rounded-full"
                  style={{ width: `${Math.min(100, overall.debtPayoffPct)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                Remaining principal:{' '}
                {displayMode === 'TZS'
                  ? formatTZS(overall.totalDebtRemaining.tzs)
                  : formatUSD(overall.totalDebtRemaining.usd)}{' '}
                ·{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('reserves')}
                  className="text-slate-900 dark:text-slate-200 font-medium hover:underline cursor-pointer"
                >
                  View Milestones
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Journal Entries */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Latest Journal Entries — {getMonthLabel(monthKey)}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('journal')}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
          >
            View All {monthEntries.length} Entries
          </button>
        </div>

        {monthEntries.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No transactions recorded for {getMonthLabel(monthKey)} yet.{' '}
            <button
              type="button"
              onClick={() => onOpenNewEntry('income')}
              className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
            >
              Log an entry
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {monthEntries.slice(0, 6).map((entry) => {
              const meta = ENTRY_TYPE_META[entry.type];
              const isEmergencyUse =
                entry.type === 'emergency' && entry.emergencyAction === 'use';
              const isInflow = entry.type === 'income';
              return (
                <div
                  key={entry.id}
                  className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {entry.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span>{entry.date}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          isEmergencyUse
                            ? 'text-amber-700 dark:text-amber-400 font-medium'
                            : isInflow
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-slate-600 dark:text-slate-300 font-medium'
                        }
                      >
                        {isEmergencyUse ? 'Emergency Use' : meta.shortLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{entry.category}</span>
                      {entry.counterparty && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{entry.counterparty}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{entry.account}</span>
                    </div>
                  </div>
                  <DualAmount
                    usd={entry.amountUSD}
                    tzs={entry.amountTZS}
                    mode={displayMode}
                    prefix={isInflow ? '+' : isEmergencyUse ? '-' : ''}
                    align="right"
                    className={`text-sm font-semibold ${
                      isInflow
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
