import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { convertToDual, formatTZS, formatUSD } from '../lib/currency';
import {
  CategoryBudget,
  CurrencyCode,
  ENTRY_TYPE_META,
  FINANCIAL_MARKET_CATEGORIES,
} from '../types/finance';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    category: string;
    currency: CurrencyCode;
    monthlyLimit: number;
    alertThresholdPct: number;
    notes: string;
  }) => Promise<void>;
  initialBudget?: CategoryBudget | null;
  presetCategory?: string;
  existingCategories: string[];
  journalCategories: string[];
  exchangeRate: number;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialBudget,
  presetCategory,
  existingCategories,
  journalCategories,
  exchangeRate,
}) => {
  const [categoryMode, setCategoryMode] = useState<'preset' | 'custom'>('preset');
  const [selectedCategory, setSelectedCategory] = useState(
    ENTRY_TYPE_META.spending.defaultCategories[0]
  );
  const [customCategory, setCustomCategory] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [alertThresholdPct, setAlertThresholdPct] = useState('80');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableCategories = useMemo(() => {
    const combined = new Set<string>([
      ...ENTRY_TYPE_META.spending.defaultCategories,
      ...FINANCIAL_MARKET_CATEGORIES,
      ...journalCategories,
    ]);
    return Array.from(combined);
  }, [journalCategories]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialBudget) {
      if (availableCategories.includes(initialBudget.category)) {
        setCategoryMode('preset');
        setSelectedCategory(initialBudget.category);
        setCustomCategory('');
      } else {
        setCategoryMode('custom');
        setCustomCategory(initialBudget.category);
      }
      setCurrency(initialBudget.currency);
      setMonthlyLimit(String(initialBudget.monthlyLimit));
      setAlertThresholdPct(String(initialBudget.alertThresholdPct));
      setNotes(initialBudget.notes);
    } else {
      const targetCat = presetCategory || availableCategories[0];
      if (availableCategories.includes(targetCat)) {
        setCategoryMode('preset');
        setSelectedCategory(targetCat);
        setCustomCategory('');
      } else {
        setCategoryMode('custom');
        setCustomCategory(targetCat);
      }
      setCurrency('USD');
      setMonthlyLimit('');
      setAlertThresholdPct('80');
      setNotes('');
    }
  }, [isOpen, initialBudget, presetCategory, availableCategories]);

  if (!isOpen) return null;

  const parsedLimit = Number(monthlyLimit);
  const parsedThreshold = Number(alertThresholdPct);
  const dualPreview =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? convertToDual(parsedLimit, currency, exchangeRate)
      : { amountUSD: 0, amountTZS: 0 };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalCategory = (categoryMode === 'custom' ? customCategory : selectedCategory).trim();
    if (!finalCategory) {
      setError('Please select or enter a spending category.');
      return;
    }
    if (finalCategory.length > 60) {
      setError('Category name must be 60 characters or fewer.');
      return;
    }

    const duplicateExists = existingCategories.some(
      (c) =>
        c.toLowerCase() === finalCategory.toLowerCase() &&
        (!initialBudget || initialBudget.category.toLowerCase() !== finalCategory.toLowerCase())
    );
    if (duplicateExists) {
      setError(
        `A monthly cap for "${finalCategory}" already exists. Edit the existing cap instead.`
      );
      return;
    }

    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setError('Monthly spending cap must be greater than zero.');
      return;
    }
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 50 || parsedThreshold > 100) {
      setError('Warning threshold must be between 50% and 100%.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        ...(initialBudget ? { id: initialBudget.id } : {}),
        category: finalCategory,
        currency,
        monthlyLimit: parsedLimit,
        alertThresholdPct: Math.round(parsedThreshold),
        notes: notes.trim().slice(0, 300),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save category budget.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2
              id="budget-modal-title"
              className="font-display text-base font-bold text-slate-900 dark:text-slate-100"
            >
              {initialBudget ? 'Edit Monthly Spending Cap' : 'Set Monthly Category Cap'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compare actual monthly journal spending against this category ceiling.
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Spending Category
              </label>
              <button
                type="button"
                onClick={() =>
                  setCategoryMode((prev) => (prev === 'preset' ? 'custom' : 'preset'))
                }
                className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {categoryMode === 'preset' ? 'Enter custom category' : 'Choose from list'}
              </button>
            </div>

            {categoryMode === 'preset' ? (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <optgroup label="Operating &amp; Living Spending">
                  {ENTRY_TYPE_META.spending.defaultCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
                {journalCategories.filter(
                  (c) =>
                    !ENTRY_TYPE_META.spending.defaultCategories.includes(c) &&
                    !FINANCIAL_MARKET_CATEGORIES.includes(c)
                ).length > 0 && (
                  <optgroup label="Custom Categories in Journal">
                    {journalCategories
                      .filter(
                        (c) =>
                          !ENTRY_TYPE_META.spending.defaultCategories.includes(c) &&
                          !FINANCIAL_MARKET_CATEGORIES.includes(c)
                      )
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </optgroup>
                )}
                <optgroup label="Financial Markets &amp; Trading">
                  {FINANCIAL_MARKET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              </select>
            ) : (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                maxLength={60}
                placeholder="e.g. Software Subscriptions"
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Cap Currency
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
                Warning At (%)
              </label>
              <input
                type="number"
                min="50"
                max="100"
                step="5"
                value={alertThresholdPct}
                onChange={(e) => setAlertThresholdPct(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Monthly Spending Cap ({currency})
            </label>
            <input
              type="number"
              step={currency === 'USD' ? '0.01' : '1'}
              min="0.01"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              placeholder={currency === 'USD' ? '500.00' : '1500000'}
              required
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {dualPreview.amountUSD > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between gap-2">
              <span>Converted Cap:</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100 font-semibold">
                {formatUSD(dualPreview.amountUSD)} · {formatTZS(dualPreview.amountTZS)}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Cap Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={300}
              placeholder="e.g. Monthly wholesale inventory budget target..."
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
              {submitting ? 'Saving...' : initialBudget ? 'Save Cap' : 'Create Cap'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
