import React, { useState } from 'react';
import { CheckCircle2, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { OverallHealthMetrics } from '../lib/analytics';
import { convertToDual, formatNativeCurrency } from '../lib/currency';
import {
  DebtAccount,
  DisplayCurrencyMode,
  JournalEntry,
  UserPreferences,
} from '../types/finance';
import { DualAmount } from './DualAmount';

interface ReservesDebtViewProps {
  entries: JournalEntry[];
  debts: DebtAccount[];
  overall: OverallHealthMetrics;
  preferences: UserPreferences;
  displayMode: DisplayCurrencyMode;
  onOpenNewEntry: (
    presetType: JournalEntry['type'],
    presetAmountUsd?: number,
    presetEmergencyAction?: 'fund' | 'use',
    presetDebtId?: string
  ) => void;
  onOpenNewDebt: () => void;
  onDeleteDebt: (debtId: string) => Promise<void>;
}

const MILESTONES = [25, 50, 75, 100];

export const ReservesDebtView: React.FC<ReservesDebtViewProps> = ({
  entries,
  debts,
  overall,
  preferences,
  displayMode,
  onOpenNewEntry,
  onOpenNewDebt,
  onDeleteDebt,
}) => {
  const [deletingDebtId, setDeletingDebtId] = useState<string | null>(null);

  const emergencyUses = entries
    .filter((e) => e.type === 'emergency' && e.emergencyAction === 'use')
    .sort((a, b) => b.date.localeCompare(a.date));

  const emergencyDeposits = entries
    .filter((e) => e.type === 'emergency' && e.emergencyAction !== 'use')
    .sort((a, b) => b.date.localeCompare(a.date));

  const investmentEntries = entries
    .filter((e) => e.type === 'investment')
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleDeleteDebt = async (id: string) => {
    setDeletingDebtId(id);
    try {
      await onDeleteDebt(id);
    } finally {
      setDeletingDebtId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Summary Strip: Emergency Net Reserve, Savings, Investments, Debt Remaining */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Net Emergency Reserve</span>
            <span className="text-emerald-700 font-medium">
              {overall.emergencyRunwayMonths} mo runway
            </span>
          </div>
          <DualAmount
            usd={overall.emergencyReserveNet.usd}
            tzs={overall.emergencyReserveNet.tzs}
            mode={displayMode}
            className="text-xl font-bold text-slate-900"
          />
          <p className="text-xs text-slate-500 mt-2.5 tabular-nums">
            {emergencyDeposits.length} deposits · {emergencyUses.length} emergency uses
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Cumulative Savings</span>
            <span className="text-blue-700 font-medium">Reserved</span>
          </div>
          <DualAmount
            usd={overall.totalSavingsAllTime.usd}
            tzs={overall.totalSavingsAllTime.tzs}
            mode={displayMode}
            className="text-xl font-bold text-slate-900"
          />
          <p className="text-xs text-slate-500 mt-2.5">
            Goal: ${preferences.monthlySavingsGoalUsd.toLocaleString()}/mo
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Total Investments</span>
            <span className="text-blue-700 font-medium">Deployed</span>
          </div>
          <DualAmount
            usd={overall.totalInvestedAllTime.usd}
            tzs={overall.totalInvestedAllTime.tzs}
            mode={displayMode}
            className="text-xl font-bold text-slate-900"
          />
          <p className="text-xs text-slate-500 mt-2.5">
            {investmentEntries.length} investment entries logged
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Remaining Debt Balance</span>
            <span className="text-slate-700 font-medium">{overall.debtPayoffPct}% paid</span>
          </div>
          <DualAmount
            usd={overall.totalDebtRemaining.usd}
            tzs={overall.totalDebtRemaining.tzs}
            mode={displayMode}
            className="text-xl font-bold text-slate-900"
          />
          <p className="text-xs text-slate-500 mt-2.5">{debts.length} tracked debt accounts</p>
        </div>
      </section>

      {/* Debt Repayment Milestones */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Debt Repayment Milestones
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Track principal reduction across 25%, 50%, 75%, and 100% payoff checkpoints
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenNewDebt}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Debt Account
          </button>
        </div>

        {debts.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No debts tracked. Add a supplier credit, loan, or equipment line to monitor payoff
            milestones.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {debts.map((debt) => {
              const pct = Math.min(
                100,
                Math.round((debt.amountPaid / Math.max(1, debt.totalPrincipal)) * 1000) / 10
              );
              const remaining = Math.max(0, debt.totalPrincipal - debt.amountPaid);
              const remainingDual = convertToDual(
                remaining,
                debt.currency,
                preferences.exchangeRateTzsPerUsd
              );
              const isPaidOff = debt.status === 'paid_off' || remaining <= 0.001;

              return (
                <div key={debt.id} className="py-5 first:pt-5 last:pb-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{debt.creditor}</h3>
                        <span className="text-xs text-slate-400">·</span>
                        <span
                          className={`text-xs font-semibold ${
                            isPaidOff ? 'text-emerald-700' : 'text-slate-600'
                          }`}
                        >
                          {isPaidOff ? 'Paid Off (100% Milestone)' : `Due ${debt.dueDate}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {debt.purpose || 'Tracked debt facility'} · Principal:{' '}
                        <span className="font-mono tabular-nums">
                          {formatNativeCurrency(debt.totalPrincipal, debt.currency)}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <DualAmount
                        usd={remainingDual.amountUSD}
                        tzs={remainingDual.amountTZS}
                        mode={displayMode}
                        align="right"
                        className="text-sm font-semibold text-slate-900"
                      />
                      {!isPaidOff && (
                        <button
                          type="button"
                          onClick={() => onOpenNewEntry('debt', undefined, undefined, debt.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Record Payment
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteDebt(debt.id)}
                        disabled={deletingDebtId === debt.id}
                        aria-label={`Delete debt ${debt.creditor}`}
                        className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress & Milestone Markers */}
                  <div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isPaidOff ? 'bg-emerald-600' : 'bg-slate-900'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="font-mono tabular-nums text-slate-600">
                        {formatNativeCurrency(debt.amountPaid, debt.currency)} paid ({pct}%)
                      </span>
                      <div className="flex items-center gap-3">
                        {MILESTONES.map((m) => {
                          const reached = pct >= m;
                          return (
                            <span
                              key={m}
                              className={`inline-flex items-center gap-1 font-mono tabular-nums ${
                                reached ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                              }`}
                            >
                              {reached && <CheckCircle2 className="w-3 h-3" />}
                              {m}%
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Emergency Uses Tracking + Investments */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Emergency Uses Tracking Log
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every emergency withdrawal tracked separately from normal operating spend
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenNewEntry('emergency', undefined, 'fund')}
                className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                + Fund Reserve
              </button>
              <button
                type="button"
                onClick={() => onOpenNewEntry('emergency', undefined, 'use')}
                className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                + Log Use
              </button>
            </div>
          </div>

          {emergencyUses.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No emergency withdrawals logged yet. Keep building your reserve buffer.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {emergencyUses.map((e) => (
                <div key={e.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {e.title}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {e.date} · {e.category} · {e.account}
                    </div>
                    {e.notes && <p className="text-xs text-slate-600 mt-1">{e.notes}</p>}
                  </div>
                  <DualAmount
                    usd={e.amountUSD}
                    tzs={e.amountTZS}
                    mode={displayMode}
                    prefix="-"
                    align="right"
                    className="text-sm font-semibold text-amber-700"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Investment &amp; Capital Growth Log
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Long-term capital deployed into funds, treasury bills, and expansion
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenNewEntry('investment')}
              className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer whitespace-nowrap"
            >
              + Log Investment
            </button>
          </div>

          {investmentEntries.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No investments logged yet. Record your first capital allocation.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {investmentEntries.map((e) => (
                <div key={e.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{e.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {e.date} · {e.category} · {e.counterparty || e.account}
                    </div>
                    {e.notes && <p className="text-xs text-slate-600 mt-1">{e.notes}</p>}
                  </div>
                  <DualAmount
                    usd={e.amountUSD}
                    tzs={e.amountTZS}
                    mode={displayMode}
                    align="right"
                    className="text-sm font-semibold text-blue-700"
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
