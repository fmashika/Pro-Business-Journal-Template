import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CurrencyCode } from '../types/finance';

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    creditor: string;
    purpose: string;
    currency: CurrencyCode;
    totalPrincipal: number;
    amountPaid: number;
    dueDate: string;
  }) => Promise<void>;
  defaultDueDate: string;
}

export const DebtModal: React.FC<DebtModalProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultDueDate,
}) => {
  const [creditor, setCreditor] = useState('');
  const [purpose, setPurpose] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [totalPrincipal, setTotalPrincipal] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const principal = Number(totalPrincipal);
    const paid = Number(amountPaid);
    if (!creditor.trim()) {
      setError('Creditor name is required.');
      return;
    }
    if (!Number.isFinite(principal) || principal <= 0) {
      setError('Total principal must be greater than zero.');
      return;
    }
    if (!Number.isFinite(paid) || paid < 0 || paid > principal) {
      setError('Initial paid amount must be between 0 and total principal.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        creditor: creditor.trim(),
        purpose: purpose.trim(),
        currency,
        totalPrincipal: principal,
        amountPaid: paid,
        dueDate,
      });
      setCreditor('');
      setPurpose('');
      setTotalPrincipal('');
      setAmountPaid('0');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save debt account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="debt-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2
            id="debt-modal-title"
            className="font-display text-base font-bold text-slate-900 dark:text-slate-100"
          >
            Add Debt Milestone Account
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

          <div className="grid grid-cols-2 gap-4">
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
                Target Date
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
              {submitting ? 'Saving...' : 'Create Debt Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
