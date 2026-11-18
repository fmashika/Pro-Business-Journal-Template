import React from 'react';
import { CheckCircle2, HeartHandshake, Plus } from 'lucide-react';
import { MonthlySummary, OverallHealthMetrics, getMonthLabel } from '../lib/analytics';
import { DisplayCurrencyMode, JournalEntry, UserPreferences } from '../types/finance';
import { DualAmount } from './DualAmount';

interface StewardshipViewProps {
  monthKey: string;
  entries: JournalEntry[];
  summary: MonthlySummary;
  overall: OverallHealthMetrics;
  preferences: UserPreferences;
  displayMode: DisplayCurrencyMode;
  onOpenNewEntry: (presetType: 'tithe' | 'offering', presetAmountUsd?: number) => void;
}

export const StewardshipView: React.FC<StewardshipViewProps> = ({
  monthKey,
  entries,
  summary,
  overall,
  preferences,
  displayMode,
  onOpenNewEntry,
}) => {
  const titheEntries = entries
    .filter((e) => e.monthKey === monthKey && e.type === 'tithe')
    .sort((a, b) => b.date.localeCompare(a.date));

  const offeringEntries = entries
    .filter((e) => e.monthKey === monthKey && e.type === 'offering')
    .sort((a, b) => b.date.localeCompare(a.date));

  const hasRemainingMonthTithe = summary.titheBalanceDue.usd > 0.5;

  return (
    <div className="space-y-6">
      {/* 10% Tithe Calculation Banner */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Tithe Accountability — {preferences.titheRatePercent}% of Total Money Gained
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Every income entry automatically accrues {preferences.titheRatePercent}% toward your
              tithe ledger in both USD and TZS, keeping your sacred tithe obligation distinct from
              freewill offerings and charitable donations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {hasRemainingMonthTithe ? (
              <button
                type="button"
                onClick={() => onOpenNewEntry('tithe', summary.titheBalanceDue.usd)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Settle Remaining {preferences.titheRatePercent}% Tithe
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                {getMonthLabel(monthKey)} Tithe Settled
              </span>
            )}
            <button
              type="button"
              onClick={() => onOpenNewEntry('offering')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              Record Offering / Charity
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              {getMonthLabel(monthKey)} Money Gained
            </div>
            <DualAmount
              usd={summary.income.usd}
              tzs={summary.income.tzs}
              mode={displayMode}
              className="text-xl font-bold text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              Tithe Accrued ({preferences.titheRatePercent}% Formula)
            </div>
            <DualAmount
              usd={summary.titheAccrued.usd}
              tzs={summary.titheAccrued.tzs}
              mode={displayMode}
              className="text-xl font-bold text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Tithe Paid This Month</div>
            <DualAmount
              usd={summary.tithePaid.usd}
              tzs={summary.tithePaid.tzs}
              mode={displayMode}
              className="text-xl font-bold text-emerald-700 dark:text-emerald-400"
            />
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Tithe Balance Remaining</div>
            <DualAmount
              usd={summary.titheBalanceDue.usd}
              tzs={summary.titheBalanceDue.tzs}
              mode={displayMode}
              className={`text-xl font-bold ${
                hasRemainingMonthTithe
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            />
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400">
          <div>
            All-Time Tithe Accrued:{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
              ${overall.allTimeTitheAccrued.usd.toFixed(2)}
            </span>
          </div>
          <div>
            All-Time Tithe Paid:{' '}
            <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
              ${overall.allTimeTithePaid.usd.toFixed(2)}
            </span>
          </div>
          <div>
            All-Time Offerings &amp; Charity:{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
              ${overall.allTimeOffering.usd.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      {/* Split Ledgers: Tithe vs Offering & Charity */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Tithe Ledger — {getMonthLabel(monthKey)}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {summary.titheCompletionPct}% of monthly {preferences.titheRatePercent}% obligation
                fulfilled
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenNewEntry('tithe', summary.titheBalanceDue.usd)}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              + Add Tithe
            </button>
          </div>

          {titheEntries.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No tithe entries recorded for {getMonthLabel(monthKey)} yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {titheEntries.map((e) => (
                <div key={e.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {e.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {e.date} · {e.counterparty || 'Tithe'} · {e.account}
                    </div>
                  </div>
                  <DualAmount
                    usd={e.amountUSD}
                    tzs={e.amountTZS}
                    mode={displayMode}
                    align="right"
                    className="text-sm font-semibold text-emerald-700 dark:text-emerald-400"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Offering, Charity &amp; Donations — {getMonthLabel(monthKey)}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Total Generosity Rate (Tithe + Offering): {summary.generosityRatePct}% of gains
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenNewEntry('offering')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              + Add Offering
            </button>
          </div>

          {offeringEntries.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No offerings or charitable donations recorded for {getMonthLabel(monthKey)} yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {offeringEntries.map((e) => (
                <div key={e.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {e.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {e.date} · {e.category}
                      {e.counterparty ? ` · ${e.counterparty}` : ''}
                    </div>
                  </div>
                  <DualAmount
                    usd={e.amountUSD}
                    tzs={e.amountTZS}
                    mode={displayMode}
                    align="right"
                    className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
