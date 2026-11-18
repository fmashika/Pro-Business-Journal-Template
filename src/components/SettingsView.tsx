import React, { useEffect, useState } from 'react';
import { Check, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { DisplayCurrencyMode, UserPreferences } from '../types/finance';

interface SettingsViewProps {
  preferences: UserPreferences;
  onSavePreferences: (next: Omit<UserPreferences, 'userId' | 'updatedAt'>) => Promise<void>;
  onLoadSampleData: () => Promise<void>;
  onClearAllData: () => Promise<void>;
  seedingSample: boolean;
  entryCount: number;
  debtCount: number;
  isGuest?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  onSavePreferences,
  onLoadSampleData,
  onClearAllData,
  seedingSample,
  entryCount,
  debtCount,
  isGuest = false,
}) => {
  const [businessName, setBusinessName] = useState(preferences.businessName);
  const [rate, setRate] = useState(String(preferences.exchangeRateTzsPerUsd));
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrencyMode>(
    preferences.displayCurrency
  );
  const [savingsGoal, setSavingsGoal] = useState(String(preferences.monthlySavingsGoalUsd));
  const [emergencyMonths, setEmergencyMonths] = useState(
    String(preferences.emergencyTargetMonths)
  );
  const [titheRate, setTitheRate] = useState(String(preferences.titheRatePercent));

  useEffect(() => {
    setBusinessName(preferences.businessName);
    setRate(String(preferences.exchangeRateTzsPerUsd));
    setDisplayCurrency(preferences.displayCurrency);
    setSavingsGoal(String(preferences.monthlySavingsGoalUsd));
    setEmergencyMonths(String(preferences.emergencyTargetMonths));
    setTitheRate(String(preferences.titheRatePercent));
  }, [preferences]);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedRate = Number(rate);
    const parsedSavings = Number(savingsGoal);
    const parsedMonths = Number(emergencyMonths);
    const parsedTithe = Number(titheRate);

    if (!Number.isFinite(parsedRate) || parsedRate <= 0) return;

    if (isGuest) {
      await onSavePreferences({
        businessName: businessName.trim() || 'Pro Business Journal Template',
        exchangeRateTzsPerUsd: parsedRate,
        displayCurrency,
        monthlySavingsGoalUsd: Number.isFinite(parsedSavings) && parsedSavings >= 0 ? parsedSavings : 500,
        emergencyTargetMonths:
          Number.isFinite(parsedMonths) && parsedMonths >= 1 && parsedMonths <= 24 ? parsedMonths : 3,
        titheRatePercent:
          Number.isFinite(parsedTithe) && parsedTithe >= 0 && parsedTithe <= 100 ? parsedTithe : 10,
      });
      return;
    }

    setSaving(true);
    try {
      await onSavePreferences({
        businessName: businessName.trim() || 'Pro Business Journal Template',
        exchangeRateTzsPerUsd: parsedRate,
        displayCurrency,
        monthlySavingsGoalUsd: Number.isFinite(parsedSavings) && parsedSavings >= 0 ? parsedSavings : 500,
        emergencyTargetMonths:
          Number.isFinite(parsedMonths) && parsedMonths >= 1 && parsedMonths <= 24 ? parsedMonths : 3,
        titheRatePercent:
          Number.isFinite(parsedTithe) && parsedTithe >= 0 && parsedTithe <= 100 ? parsedTithe : 10,
      });
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await onClearAllData();
      setConfirmClear(false);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
      >
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            Journal, Dual-Currency &amp; Stewardship Settings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure your USD to TZS conversion benchmark, monthly targets, and tithe percentage.
          </p>
        </div>

        {isGuest && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200">
            Guest Mode (Read-Only): You can inspect settings here, and sign in with Google anytime
            to save your own preferences.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Business / Journal Name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              maxLength={100}
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Exchange Rate (TZS per 1 USD)
            </label>
            <input
              type="number"
              step="1"
              min="100"
              max="100000"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Default Display Currency
            </label>
            <select
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value as DisplayCurrencyMode)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="BOTH">Both USD &amp; TZS</option>
              <option value="USD">USD Primary</option>
              <option value="TZS">TZS Primary</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Tithe Rate (% of Total Money Gained)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={titheRate}
              onChange={(e) => setTitheRate(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Monthly Savings Target (USD Equivalent)
            </label>
            <input
              type="number"
              step="10"
              min="0"
              value={savingsGoal}
              onChange={(e) => setSavingsGoal(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Emergency Runway Target (Months)
            </label>
            <input
              type="number"
              step="1"
              min="1"
              max="24"
              value={emergencyMonths}
              onChange={(e) => setEmergencyMonths(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-slate-900 dark:bg-emerald-700 rounded-lg hover:bg-slate-800 dark:hover:bg-emerald-600 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>

          {savedToast && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="w-4 h-4" />
              Settings updated
            </span>
          )}
        </div>
      </form>

      {/* Data Tools */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Journal Data Management
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            Currently storing {entryCount} journal entries and {debtCount} debt accounts in your
            cloud ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onLoadSampleData}
            disabled={seedingSample}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {seedingSample ? 'Loading Sample Data...' : 'Load Sample USD & TZS Dataset'}
          </button>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => (isGuest ? onClearAllData() : setConfirmClear(true))}
              disabled={entryCount === 0 && debtCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Journal Records
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                {clearing ? 'Clearing...' : 'Confirm Delete All'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
