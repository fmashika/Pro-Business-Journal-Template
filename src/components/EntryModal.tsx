import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { convertToDual, formatTZS, formatUSD } from '../lib/currency';
import {
  CurrencyCode,
  DEFAULT_ACCOUNTS,
  DebtAccount,
  ENTRY_TYPE_META,
  EmergencyAction,
  EntryType,
  FINANCIAL_MARKET_CATEGORIES,
  JournalEntry,
} from '../types/finance';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    date: string;
    type: EntryType;
    emergencyAction?: EmergencyAction;
    title: string;
    category: string;
    counterparty: string;
    account: string;
    currency: CurrencyCode;
    amount: number;
    exchangeRate: number;
    debtId?: string;
    notes: string;
  }) => Promise<void>;
  initialEntry?: JournalEntry | null;
  presetType?: EntryType;
  presetCategory?: string;
  presetAmountUsd?: number;
  presetEmergencyAction?: EmergencyAction;
  presetDebtId?: string;
  defaultDate: string;
  defaultExchangeRate: number;
  titheRatePercent: number;
  debts: DebtAccount[];
}

export const EntryModal: React.FC<EntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEntry,
  presetType,
  presetCategory,
  presetAmountUsd,
  presetEmergencyAction,
  presetDebtId,
  defaultDate,
  defaultExchangeRate,
  titheRatePercent,
  debts,
}) => {
  const [date, setDate] = useState(defaultDate);
  const [type, setType] = useState<EntryType>('income');
  const [emergencyAction, setEmergencyAction] = useState<EmergencyAction>('fund');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Client Sales');
  const [counterparty, setCounterparty] = useState('');
  const [account, setAccount] = useState(DEFAULT_ACCOUNTS[0]);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [amount, setAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState(String(defaultExchangeRate));
  const [debtId, setDebtId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialEntry) {
      setDate(initialEntry.date);
      setType(initialEntry.type);
      setEmergencyAction(initialEntry.emergencyAction || 'fund');
      setTitle(initialEntry.title);
      setCategory(initialEntry.category);
      setCounterparty(initialEntry.counterparty);
      setAccount(initialEntry.account);
      setCurrency(initialEntry.currency);
      setAmount(String(initialEntry.amount));
      setExchangeRate(String(initialEntry.exchangeRate));
      setDebtId(initialEntry.debtId || '');
      setNotes(initialEntry.notes);
    } else {
      const nextType = presetType || 'income';
      setDate(defaultDate);
      setType(nextType);
      setEmergencyAction(presetEmergencyAction || 'fund');
      setTitle(nextType === 'tithe' && presetAmountUsd ? `${titheRatePercent}% Tithe Settlement` : '');
      setCategory(
        presetCategory
          ? presetCategory
          : nextType === 'emergency' && presetEmergencyAction === 'use'
          ? 'Equipment Breakdown'
          : ENTRY_TYPE_META[nextType].defaultCategories[0]
      );
      setCounterparty('');
      setAccount(DEFAULT_ACCOUNTS[0]);
      setCurrency('USD');
      setAmount(presetAmountUsd && presetAmountUsd > 0 ? presetAmountUsd.toFixed(2) : '');
      setExchangeRate(String(defaultExchangeRate));
      setDebtId(presetDebtId || '');
      setNotes('');
    }
  }, [
    isOpen,
    initialEntry,
    presetType,
    presetCategory,
    presetAmountUsd,
    presetEmergencyAction,
    presetDebtId,
    defaultDate,
    defaultExchangeRate,
    titheRatePercent,
  ]);

  if (!isOpen) return null;

  const parsedAmount = Number(amount);
  const parsedRate = Number(exchangeRate) > 0 ? Number(exchangeRate) : defaultExchangeRate;
  const dualPreview =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? convertToDual(parsedAmount, currency, parsedRate)
      : { amountUSD: 0, amountTZS: 0 };

  const activeDebts = debts.filter((d) => d.status !== 'paid_off' || d.id === debtId);

  const handleTypeChange = (nextType: EntryType) => {
    setType(nextType);
    setCategory(ENTRY_TYPE_META[nextType].defaultCategories[0]);
    if (nextType !== 'debt') setDebtId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Please enter a short description or title.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      setError('Exchange rate must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        ...(initialEntry ? { id: initialEntry.id } : {}),
        date,
        type,
        ...(type === 'emergency' ? { emergencyAction } : {}),
        title: title.trim(),
        category: category.trim() || ENTRY_TYPE_META[type].defaultCategories[0],
        counterparty: counterparty.trim(),
        account,
        currency,
        amount: parsedAmount,
        exchangeRate: parsedRate,
        ...(type === 'debt' && debtId ? { debtId } : {}),
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save journal entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2
              id="entry-modal-title"
              className="font-display text-base font-bold text-slate-900 dark:text-slate-100"
            >
              {initialEntry ? 'Edit Journal Entry' : 'Record Daily Transaction'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {ENTRY_TYPE_META[type].description}
            </p>
          </div>
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

          {/* Entry Type Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Transaction Pillar
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(Object.keys(ENTRY_TYPE_META) as EntryType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    type === t
                      ? 'bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {ENTRY_TYPE_META[t].shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Emergency Action Sub-selector */}
          {type === 'emergency' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Emergency Action
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmergencyAction('fund');
                    setCategory('Emergency Fund Deposit');
                  }}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border cursor-pointer ${
                    emergencyAction === 'fund'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Build Emergency Reserve (+)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmergencyAction('use');
                    setCategory('Equipment Breakdown');
                  }}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border cursor-pointer ${
                    emergencyAction === 'use'
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Emergency Use / Drawdown (-)
                </button>
              </div>
            </div>
          )}

          {/* Debt Account Selector */}
          {type === 'debt' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Link to Debt Milestone Account (Optional)
              </label>
              <select
                value={debtId}
                onChange={(e) => setDebtId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="">General Debt Payment (Unlinked)</option>
                {activeDebts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.creditor} — {d.purpose} ({d.currency})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <optgroup label={`${ENTRY_TYPE_META[type].shortLabel} Categories`}>
                  {ENTRY_TYPE_META[type].defaultCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {category &&
                    !ENTRY_TYPE_META[type].defaultCategories.includes(category) &&
                    !FINANCIAL_MARKET_CATEGORIES.includes(category) && (
                      <option value={category}>{category}</option>
                    )}
                </optgroup>
                {type !== 'investment' && (
                  <optgroup label="Financial Markets &amp; Trading">
                    {FINANCIAL_MARKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Transaction Title / Description
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="e.g. Client retainer, Inventory restock, Tithe transfer"
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Currency & Amount */}
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
                Amount ({currency})
              </label>
              <input
                type="number"
                step={currency === 'USD' ? '0.01' : '1'}
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={currency === 'USD' ? '0.00' : '0'}
                required
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Rate (TZS / USD)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Live Dual-Currency Conversion & Tithe Impact Preview */}
          {dualPreview.amountUSD > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono tabular-nums">
                Equivalent:{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {formatUSD(dualPreview.amountUSD)}
                </strong>{' '}
                ·{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {formatTZS(dualPreview.amountTZS)}
                </strong>
              </span>
              {type === 'income' && (
                <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                  +{titheRatePercent}% Tithe:{' '}
                  {formatUSD((dualPreview.amountUSD * titheRatePercent) / 100)}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Counterparty / Client / Recipient
              </label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                maxLength={100}
                placeholder="e.g. Serengeti Camps, Local Church"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Account / Payment Rail
              </label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {DEFAULT_ACCOUNTS.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Journal Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Context on business purpose, cash flow impact, or milestone note..."
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
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
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {submitting ? 'Saving...' : initialEntry ? 'Save Changes' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
