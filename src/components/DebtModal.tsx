import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck2, CheckCircle2, Percent, RotateCcw, X } from 'lucide-react';
import { computeDebtPaymentHabit, computeProjectedPayoff } from '../lib/analytics';
import { formatNativeCurrency } from '../lib/currency';
import { CurrencyCode, DebtAccount, JournalEntry } from '../types/finance';

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    creditor: string;
    purpose: string;
    currency: CurrencyCode;
    totalPrincipal: number;
    amountPaid: number;
    interestRatePct: number;
    dueDate: string;
  }) => Promise<void>;
  defaultDueDate: string;
  initialDebt?: DebtAccount | null;
  entries: JournalEntry[];
  exchangeRate: number;
}

type HabitScope = 'debt_specific' | 'overall_journal' | 'custom';

export const DebtModal: React.FC<DebtModalProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultDueDate,
  initialDebt,
  entries,
  exchangeRate,
}) => {
  const [creditor, setCreditor] = useState('');
  const [purpose, setPurpose] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [totalPrincipal, setTotalPrincipal] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [interestRatePct, setInterestRatePct] = useState('0');
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [habitScope, setHabitScope] = useState<HabitScope>('overall_journal');
  const [customMonthlyPayment, setCustomMonthlyPayment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const habit = useMemo(
    () => computeDebtPaymentHabit(entries, currency, exchangeRate, initialDebt?.id),
    [entries, currency, exchangeRate, initialDebt?.id]
  );

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialDebt) {
      setCreditor(initialDebt.creditor);
      setPurpose(initialDebt.purpose || '');
      setCurrency(initialDebt.currency);
      setTotalPrincipal(String(initialDebt.totalPrincipal));
      setAmountPaid(String(initialDebt.amountPaid));
      setInterestRatePct(String(initialDebt.interestRatePct ?? 0));
      setDueDate(initialDebt.dueDate || defaultDueDate);
      const debtHabit = computeDebtPaymentHabit(
        entries,
        initialDebt.currency,
        exchangeRate,
        initialDebt.id
      );
      if (debtHabit.debtSpecificPaymentCount > 0) {
        setHabitScope('debt_specific');
      } else if (debtHabit.overallPaymentCount > 0) {
        setHabitScope('overall_journal');
      } else {
        setHabitScope('custom');
      }
      setCustomMonthlyPayment('');
    } else {
      setCreditor('');
      setPurpose('');
      setCurrency('USD');
      setTotalPrincipal('');
      setAmountPaid('0');
      setInterestRatePct('0');
      setDueDate(defaultDueDate);
      const overallHabit = computeDebtPaymentHabit(entries, 'USD', exchangeRate);
      setHabitScope(overallHabit.overallPaymentCount > 0 ? 'overall_journal' : 'custom');
      setCustomMonthlyPayment('');
    }
  }, [isOpen, initialDebt, defaultDueDate, entries, exchangeRate]);

  const effectiveMonthlyPayment = useMemo(() => {
    if (habitScope === 'debt_specific') {
      return habit.debtSpecificMonthlyAvgInCurrency;
    }
    if (habitScope === 'overall_journal') {
      return habit.overallMonthlyAvgInCurrency;
    }
    const parsed = Number(customMonthlyPayment);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [habitScope, habit, customMonthlyPayment]);

  const parsedPrincipal = Number(totalPrincipal);
  const parsedPaid = Number(amountPaid);
  const parsedRate = Number(interestRatePct);
  const hasValidPrincipal = Number.isFinite(parsedPrincipal) && parsedPrincipal > 0;
  const cleanPaid = Number.isFinite(parsedPaid) && parsedPaid >= 0 ? parsedPaid : 0;
  const cleanRate = Number.isFinite(parsedRate) && parsedRate >= 0 ? parsedRate : 0;
  const remainingBalance = hasValidPrincipal ? Math.max(0, parsedPrincipal - cleanPaid) : 0;

  const projection = useMemo(() => {
    if (!hasValidPrincipal) return null;
    return computeProjectedPayoff({
      remainingBalance,
      monthlyPayment: effectiveMonthlyPayment,
      annualInterestRatePct: cleanRate,
      currency,
      dueDate,
    });
  }, [hasValidPrincipal, remainingBalance, effectiveMonthlyPayment, cleanRate, currency, dueDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const principal = Number(totalPrincipal);
    const paid = Number(amountPaid);
    const rateVal = interestRatePct.trim() === '' ? 0 : Number(interestRatePct);

    if (!creditor.trim()) {
      setError('Creditor name is required.');
      return;
    }
    if (!Number.isFinite(principal) || principal <= 0) {
      setError('Total principal must be greater than zero.');
      return;
    }
    if (!Number.isFinite(paid) || paid < 0 || paid > principal) {
      setError('Already paid amount must be between 0 and total principal.');
      return;
    }
    if (!Number.isFinite(rateVal) || rateVal < 0 || rateVal > 200) {
      setError('Annual interest rate must be between 0% and 200%.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        id: initialDebt?.id,
        creditor: creditor.trim(),
        purpose: purpose.trim(),
        currency,
        totalPrincipal: principal,
        amountPaid: paid,
        interestRatePct: Math.round(rateVal * 100) / 100,
        dueDate,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save debt account.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasJournalHistory = habit.overallPaymentCount > 0;
  const hasSpecificHistory = habit.debtSpecificPaymentCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="debt-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2
            id="debt-modal-title"
            className="font-display text-base font-bold text-slate-900 dark:text-slate-100"
          >
            {initialDebt ? 'Edit Debt Milestone Account' : 'Add Debt Milestone Account'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-800 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Creditor / Lender
            </label>
            <input
              type="text"
              value={creditor}
              onChange={(e) => setCreditor(e.target.value)}
              maxLength={120}
              placeholder="e.g. Kariakoo Wholesale Suppliers"
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Purpose
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              maxLength={140}
              placeholder="e.g. Inventory credit line or equipment loan"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Currency
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(['USD', 'TZS'] as const).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setCurrency(cur)}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      currency === cur
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Annual Rate (APR %)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="200"
                  value={interestRatePct}
                  onChange={(e) => setInterestRatePct(e.target.value)}
                  placeholder="0"
                  className="w-full pl-3 pr-8 py-2 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <Percent className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Target Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Total Principal ({currency})
              </label>
              <input
                type="number"
                step={currency === 'USD' ? '0.01' : '1'}
                min="1"
                value={totalPrincipal}
                onChange={(e) => setTotalPrincipal(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Already Paid ({currency})
              </label>
              <input
                type="number"
                step={currency === 'USD' ? '0.01' : '1'}
                min="0"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Projected Pay-off Date Panel */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Projected Pay-off Date
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Calculated from your debt payment pace &amp; {cleanRate}% APR
                  </div>
                </div>
              </div>

              {projection && projection.status === 'projected' && (
                <div className="text-right shrink-0">
                  <div className="font-display text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {projection.projectedPayoffMonthLabel}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {projection.monthsToPayoff}{' '}
                    {projection.monthsToPayoff === 1 ? 'month' : 'months'} ({projection.projectedPayoffDate})
                  </div>
                </div>
              )}

              {projection && projection.status === 'paid_off' && (
                <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Paid Off
                </div>
              )}
            </div>

            {/* Payment Habit Basis Controls */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Payment Habit Basis
                </span>
                {hasJournalHistory && habitScope === 'custom' && (
                  <button
                    type="button"
                    onClick={() =>
                      setHabitScope(hasSpecificHistory ? 'debt_specific' : 'overall_journal')
                    }
                    className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Use detected habit
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {hasSpecificHistory && (
                  <button
                    type="button"
                    onClick={() => setHabitScope('debt_specific')}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer tabular-nums ${
                      habitScope === 'debt_specific'
                        ? 'bg-slate-900 dark:bg-emerald-700 text-white border-slate-900 dark:border-emerald-700'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    This Debt ({formatNativeCurrency(habit.debtSpecificMonthlyAvgInCurrency, currency)}/mo)
                  </button>
                )}
                {hasJournalHistory && (
                  <button
                    type="button"
                    onClick={() => setHabitScope('overall_journal')}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer tabular-nums ${
                      habitScope === 'overall_journal'
                        ? 'bg-slate-900 dark:bg-emerald-700 text-white border-slate-900 dark:border-emerald-700'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    Journal Avg ({formatNativeCurrency(habit.overallMonthlyAvgInCurrency, currency)}/mo)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!customMonthlyPayment && habit.recommendedMonthlyPayment > 0) {
                      setCustomMonthlyPayment(String(habit.recommendedMonthlyPayment));
                    }
                    setHabitScope('custom');
                  }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                    habitScope === 'custom'
                      ? 'bg-slate-900 dark:bg-emerald-700 text-white border-slate-900 dark:border-emerald-700'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {hasJournalHistory ? 'Simulate Custom Pace' : 'Planned Monthly Payment'}
                </button>
              </div>

              {habitScope === 'custom' ? (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    step={currency === 'USD' ? '0.01' : '1'}
                    min="0"
                    value={customMonthlyPayment}
                    onChange={(e) => setCustomMonthlyPayment(e.target.value)}
                    placeholder={
                      currency === 'USD' ? 'Monthly payment e.g. 250' : 'Monthly payment e.g. 500000'
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    {currency}/mo
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {habitScope === 'debt_specific'
                    ? `Detected from ${habit.debtSpecificPaymentCount} payment${
                        habit.debtSpecificPaymentCount === 1 ? '' : 's'
                      } linked to this debt (${formatNativeCurrency(
                        habit.debtSpecificTotalPaidInCurrency,
                        currency
                      )} logged).`
                    : `Detected across ${habit.overallPaymentCount} debt repayment${
                        habit.overallPaymentCount === 1 ? '' : 's'
                      } in your journal (${habit.overallActiveMonths} active ${
                        habit.overallActiveMonths === 1 ? 'month' : 'months'
                      }).`}
                </p>
              )}
            </div>

            {/* Projection Outcome Details */}
            {!hasValidPrincipal ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                Enter total principal above to preview your projected pay-off date.
              </p>
            ) : projection?.status === 'no_payment_habit' ? (
              <p className="text-xs text-amber-700 dark:text-amber-400 pt-1">
                {hasJournalHistory
                  ? 'Enter a planned monthly payment above to project your pay-off date.'
                  : 'No debt payments logged in your journal yet. Enter a planned monthly payment above to calculate your pay-off timeline.'}
              </p>
            ) : projection?.status === 'insufficient_payment' ? (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Monthly pace of{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {formatNativeCurrency(projection.monthlyPaymentUsed, currency)}
                  </span>{' '}
                  does not exceed the first month&apos;s interest (~
                  <span className="font-mono font-semibold tabular-nums">
                    {formatNativeCurrency(projection.firstMonthInterest, currency)}
                  </span>
                  ). Increase monthly payments to reduce principal.
                </span>
              </div>
            ) : projection?.status === 'beyond_horizon' ? (
              <p className="text-xs text-amber-700 dark:text-amber-400 pt-1">
                At this pace, payoff extends beyond 50 years. Increasing monthly payments will
                dramatically shorten your timeline.
              </p>
            ) : projection?.status === 'projected' ? (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                    Remaining Principal
                  </span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatNativeCurrency(projection.remainingBalance, currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                    {cleanRate > 0 ? 'Est. Interest + Total' : 'Interest Cost'}
                  </span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {cleanRate > 0
                      ? `${formatNativeCurrency(projection.estimatedTotalInterest, currency)} (${formatNativeCurrency(
                          projection.estimatedTotalPayoffCost,
                          currency
                        )})`
                      : 'Interest-free (0% APR)'}
                  </span>
                </div>

                {projection.dueDateComparison && (
                  <div className="col-span-2 text-[11px] font-medium">
                    {projection.dueDateComparison === 'on_or_before' ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {projection.monthsDeltaVsDueDate !== null &&
                        projection.monthsDeltaVsDueDate < 0
                          ? `On track: ${Math.abs(projection.monthsDeltaVsDueDate)} ${
                              Math.abs(projection.monthsDeltaVsDueDate) === 1 ? 'month' : 'months'
                            } ahead of target due date (${dueDate}).`
                          : `On schedule to finish by your target due date (${dueDate}).`}
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">
                        Projected{' '}
                        {projection.monthsDeltaVsDueDate !== null &&
                        projection.monthsDeltaVsDueDate > 0
                          ? `${projection.monthsDeltaVsDueDate} ${
                              projection.monthsDeltaVsDueDate === 1 ? 'month' : 'months'
                            } past`
                          : 'after'}{' '}
                        target due date ({dueDate}).
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 dark:bg-emerald-700 rounded-lg hover:bg-slate-800 dark:hover:bg-emerald-600 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {submitting
                ? 'Saving...'
                : initialDebt
                ? 'Update Debt Account'
                : 'Create Debt Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
