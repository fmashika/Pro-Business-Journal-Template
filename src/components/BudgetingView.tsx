import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  BudgetStatus,
  MonthlyBudgetReport,
  exportMonthlyBudgetToCSV,
  getMonthLabel,
} from '../lib/analytics';
import { formatTZS, formatUSD } from '../lib/currency';
import {
  CategoryBudget,
  DisplayCurrencyMode,
  UserPreferences,
} from '../types/finance';
import { DualAmount } from './DualAmount';

interface BudgetingViewProps {
  monthKey: string;
  report: MonthlyBudgetReport;
  preferences: UserPreferences;
  displayMode: DisplayCurrencyMode;
  onOpenNewBudget: (presetCategory?: string) => void;
  onEditBudget: (budget: CategoryBudget) => void;
  onDeleteBudget: (budget: CategoryBudget) => Promise<void>;
  onLogSpendingForCategory: (category: string) => void;
}

const STATUS_FILTER_TABS: { key: 'all' | BudgetStatus; label: string }[] = [
  { key: 'all', label: 'All Caps' },
  { key: 'over_budget', label: 'Over Budget' },
  { key: 'near_limit', label: 'Near Limit' },
  { key: 'on_track', label: 'On Track' },
];

export const BudgetingView: React.FC<BudgetingViewProps> = ({
  monthKey,
  report,
  preferences,
  displayMode,
  onOpenNewBudget,
  onEditBudget,
  onDeleteBudget,
  onLogSpendingForCategory,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | BudgetStatus>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return report.rows;
    return report.rows.filter((r) => r.status === statusFilter);
  }, [report.rows, statusFilter]);

  const handleDelete = async (budget: CategoryBudget) => {
    setDeletingId(budget.id);
    try {
      await onDeleteBudget(budget);
    } finally {
      setDeletingId(null);
    }
  };

  const isOverallOver = report.remainingCappedHeadroom.usd < 0;

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <section
        aria-label="Monthly budget summary indicators"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Total Monthly Caps</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {report.rows.length} {report.rows.length === 1 ? 'category' : 'categories'}
            </span>
          </div>
          <DualAmount
            usd={report.totalBudgeted.usd}
            tzs={report.totalBudgeted.tzs}
            mode={displayMode}
            className="text-xl font-bold text-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 tabular-nums">
            {getMonthLabel(monthKey)} spending ceiling
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Actual Spending (Month)</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">
              {report.overallUtilizationPct}% of caps
            </span>
          </div>
          <DualAmount
            usd={report.totalActualAllSpending.usd}
            tzs={report.totalActualAllSpending.tzs}
            mode={displayMode}
            className="text-xl font-bold text-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 tabular-nums">
            Capped:{' '}
            {displayMode === 'TZS'
              ? formatTZS(report.totalActualCapped.tzs)
              : formatUSD(report.totalActualCapped.usd)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>{isOverallOver ? 'Over Budget By' : 'Remaining Headroom'}</span>
            <span
              className={`font-medium ${
                isOverallOver
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {isOverallOver ? 'Exceeded' : 'Available'}
            </span>
          </div>
          <DualAmount
            usd={Math.abs(report.remainingCappedHeadroom.usd)}
            tzs={Math.abs(report.remainingCappedHeadroom.tzs)}
            mode={displayMode}
            prefix={isOverallOver ? '-' : ''}
            className={`text-xl font-bold ${
              isOverallOver
                ? 'text-rose-700 dark:text-rose-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 tabular-nums">
            Uncapped spend:{' '}
            {displayMode === 'TZS'
              ? formatTZS(report.totalActualUncapped.tzs)
              : formatUSD(report.totalActualUncapped.usd)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Cap Health Breakdown</span>
            <span
              className={`font-medium ${
                report.overBudgetCount > 0
                  ? 'text-rose-700 dark:text-rose-400'
                  : report.nearLimitCount > 0
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {report.overBudgetCount > 0
                ? 'Action Needed'
                : report.nearLimitCount > 0
                ? 'Watchlist'
                : 'Healthy'}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {report.onTrackCount} / {report.rows.length} On Track
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 tabular-nums">
            {report.nearLimitCount} near limit · {report.overBudgetCount} over budget
          </p>
        </div>
      </section>

      {/* Budget Caps vs Actuals List */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Category Spending Caps vs. Actuals — {getMonthLabel(monthKey)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Monthly category ceilings compared live against your operating &amp; living spending
              journal entries
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {report.rows.length > 0 && (
              <button
                type="button"
                onClick={() => exportMonthlyBudgetToCSV(report, preferences)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Export Budget CSV
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenNewBudget()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Category Cap
            </button>
          </div>
        </div>

        {/* Status Filter Bar */}
        {report.rows.length > 0 && (
          <div className="mt-4 flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto w-fit max-w-full">
            {STATUS_FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === tab.key
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {report.rows.length === 0 ? (
          <div className="py-12 text-center">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              No Monthly Spending Caps Set Yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-md mx-auto">
              Create monthly spending limits for categories like Inventory &amp; Stock, Rent &amp;
              Utilities, or Transport &amp; Fuel to monitor burn rate against actual journal entries.
            </p>
            <button
              type="button"
              onClick={() => onOpenNewBudget()}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Set First Category Cap
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No category caps match this status filter for {getMonthLabel(monthKey)}.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 mt-2">
            {filteredRows.map((row) => {
              const { budget, capDual, actualDual, remainingDual, utilizationPct, status, txCount } =
                row;
              const isOver = status === 'over_budget';
              const isNear = status === 'near_limit';
              const barColor = isOver
                ? 'bg-rose-600 dark:bg-rose-500'
                : isNear
                ? 'bg-amber-500 dark:bg-amber-400'
                : 'bg-emerald-600 dark:bg-emerald-500';

              return (
                <div key={budget.id} className="py-5 first:pt-5 last:pb-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {budget.category}
                        </h3>
                        <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            isOver
                              ? 'text-rose-700 dark:text-rose-400'
                              : isNear
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {isOver ? (
                            <ShieldAlert className="w-3.5 h-3.5" />
                          ) : isNear ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          {isOver ? 'Over Budget' : isNear ? 'Near Limit' : 'On Track'}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {txCount} {txCount === 1 ? 'expense' : 'expenses'}
                        </span>
                      </div>
                      {budget.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {budget.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <div className="text-right">
                        <DualAmount
                          usd={actualDual.usd}
                          tzs={actualDual.tzs}
                          mode={displayMode}
                          align="right"
                          className={`text-sm font-semibold ${
                            isOver
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        />
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                          of {displayMode === 'TZS' ? formatTZS(capDual.tzs) : formatUSD(capDual.usd)}{' '}
                          cap ({utilizationPct}%)
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onLogSpendingForCategory(budget.category)}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          + Log Spend
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditBudget(budget)}
                          aria-label={`Edit cap for ${budget.category}`}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(budget)}
                          disabled={deletingId === budget.id}
                          aria-label={`Delete cap for ${budget.category}`}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Progress Track with Threshold Marker */}
                  <div>
                    <div className="relative w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${Math.min(100, utilizationPct)}%` }}
                      />
                      <div
                        title={`Alert threshold: ${budget.alertThresholdPct}%`}
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-400/70 dark:bg-slate-500/70"
                        style={{ left: `${Math.min(99, budget.alertThresholdPct)}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs">
                      <span
                        className={`font-mono tabular-nums font-medium ${
                          isOver
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isOver
                          ? `Over cap by ${
                              displayMode === 'TZS'
                                ? formatTZS(Math.abs(remainingDual.tzs))
                                : formatUSD(Math.abs(remainingDual.usd))
                            }`
                          : `${
                              displayMode === 'TZS'
                                ? formatTZS(remainingDual.tzs)
                                : formatUSD(remainingDual.usd)
                            } remaining`}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        Alert at {budget.alertThresholdPct}% · Native cap:{' '}
                        {budget.currency === 'TZS'
                          ? formatTZS(budget.monthlyLimit)
                          : formatUSD(budget.monthlyLimit)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Uncapped Spending Categories Detected in This Month's Journal */}
      {report.uncappedCategories.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Uncapped Spending in {getMonthLabel(monthKey)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Journal spending categories from this month without a configured monthly cap yet
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {report.uncappedCategories.map((item) => (
              <div
                key={item.category}
                className="py-3.5 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {item.category}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {item.txCount} {item.txCount === 1 ? 'journal entry' : 'journal entries'} in{' '}
                    {getMonthLabel(monthKey)}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <DualAmount
                    usd={item.actualDual.usd}
                    tzs={item.actualDual.tzs}
                    mode={displayMode}
                    align="right"
                    className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => onOpenNewBudget(item.category)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Set Cap
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
