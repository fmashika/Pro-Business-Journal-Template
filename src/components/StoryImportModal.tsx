import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  FileText,
  Loader2,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { convertToDual, formatTZS, formatUSD } from '../lib/currency';
import {
  CurrencyCode,
  DEFAULT_ACCOUNTS,
  DebtAccount,
  ENTRY_TYPE_META,
  EmergencyAction,
  EntryType,
  FINANCIAL_MARKET_CATEGORIES,
} from '../types/finance';

export interface StoryDraftEntry {
  tempId: string;
  selected: boolean;
  date: string;
  hasExplicitDate: boolean;
  hasExplicitAmount: boolean;
  hasExplicitPurpose: boolean;
  type: EntryType;
  emergencyAction?: EmergencyAction;
  title: string;
  category: string;
  counterparty: string;
  account: string;
  currency: CurrencyCode;
  amount: number;
  debtId?: string;
  notes: string;
  sourceExcerpt: string;
}

interface StoryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBatch: (
    entries: Array<{
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
    }>
  ) => Promise<void>;
  defaultMonthKey: string;
  todayDate: string;
  defaultExchangeRate: number;
  titheRatePercent: number;
  debts: DebtAccount[];
  isGuest: boolean;
}

const EXAMPLE_STORY =
  'In October 15 given a job of website building which salary is 180,000 TZS, Tithe 18,000 TZS, after that in October 20 I invested to forex trading, total investment 25,000 TZS, Saving 10,000 TZS, Emergence 10,000 TZS, uses Bundles 10,000 TZS, October 25 Helping friend 20,000 TZS, October 29 25,000 Cooking Gas exchange';

type PillarChoice =
  | 'income'
  | 'spending'
  | 'saving'
  | 'emergency_fund'
  | 'emergency_use'
  | 'investment'
  | 'debt'
  | 'tithe'
  | 'offering';

function toPillarChoice(type: EntryType, emergencyAction?: EmergencyAction): PillarChoice {
  if (type === 'emergency') {
    return emergencyAction === 'use' ? 'emergency_use' : 'emergency_fund';
  }
  return type;
}

export const StoryImportModal: React.FC<StoryImportModalProps> = ({
  isOpen,
  onClose,
  onSaveBatch,
  defaultMonthKey,
  todayDate,
  defaultExchangeRate,
  titheRatePercent,
  debts,
  isGuest,
}) => {
  const [story, setStory] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>('TZS');
  const [exchangeRate, setExchangeRate] = useState(String(defaultExchangeRate));
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [summaryNote, setSummaryNote] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<StoryDraftEntry[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setExchangeRate(String(defaultExchangeRate));
  }, [isOpen, defaultExchangeRate]);

  const parsedRate =
    Number(exchangeRate) > 0 ? Number(exchangeRate) : defaultExchangeRate;

  const selectedDrafts = useMemo(
    () => drafts.filter((d) => d.selected),
    [drafts]
  );

  const invalidSelectedCount = useMemo(
    () =>
      selectedDrafts.filter(
        (d) => !d.title.trim() || !Number.isFinite(d.amount) || d.amount <= 0 || !d.date
      ).length,
    [selectedDrafts]
  );

  const batchStats = useMemo(() => {
    let inflowUsd = 0;
    let inflowTzs = 0;
    let outflowUsd = 0;
    let outflowTzs = 0;

    for (const d of selectedDrafts) {
      if (!Number.isFinite(d.amount) || d.amount <= 0) continue;
      const dual = convertToDual(d.amount, d.currency, parsedRate);
      if (d.type === 'income') {
        inflowUsd += dual.amountUSD;
        inflowTzs += dual.amountTZS;
      } else if (
        d.type === 'spending' ||
        d.type === 'debt' ||
        d.type === 'tithe' ||
        d.type === 'offering' ||
        (d.type === 'emergency' && d.emergencyAction === 'use')
      ) {
        outflowUsd += dual.amountUSD;
        outflowTzs += dual.amountTZS;
      }
    }

    return {
      inflowUsd: Math.round(inflowUsd * 100) / 100,
      inflowTzs: Math.round(inflowTzs),
      outflowUsd: Math.round(outflowUsd * 100) / 100,
      outflowTzs: Math.round(outflowTzs),
      titheAccruedUsd:
        Math.round(((inflowUsd * Math.max(0, titheRatePercent)) / 100) * 100) / 100,
    };
  }, [selectedDrafts, parsedRate, titheRatePercent]);

  if (!isOpen) return null;

  const handleTranslate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = story.trim();
    if (!trimmed) {
      setError('Please write your financial story before translating.');
      return;
    }

    setError(null);
    setParsing(true);
    try {
      const response = await fetch('/api/journal/parse-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: trimmed,
          defaultMonthKey,
          todayDate,
          defaultCurrency,
          debts: debts
            .filter((d) => d.status !== 'paid_off')
            .map((d) => ({
              id: d.id,
              creditor: d.creditor,
              purpose: d.purpose,
              currency: d.currency,
            })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to translate your story.');
      }

      const items: StoryDraftEntry[] = Array.isArray(data.entries)
        ? data.entries.map(
            (
              raw: Omit<StoryDraftEntry, 'tempId' | 'selected'>,
              idx: number
            ) => ({
              tempId: `draft_${Date.now()}_${idx}`,
              selected: true,
              date: raw.date || todayDate,
              hasExplicitDate: Boolean(raw.hasExplicitDate),
              hasExplicitAmount: Boolean(raw.hasExplicitAmount) && Number(raw.amount) > 0,
              hasExplicitPurpose: Boolean(raw.hasExplicitPurpose) && Boolean(raw.title),
              type: raw.type || 'spending',
              emergencyAction: raw.emergencyAction,
              title: raw.title || '',
              category:
                raw.category ||
                ENTRY_TYPE_META[raw.type || 'spending'].defaultCategories[0],
              counterparty: raw.counterparty || '',
              account: raw.account || DEFAULT_ACCOUNTS[2],
              currency: raw.currency === 'USD' ? 'USD' : 'TZS',
              amount: Number(raw.amount) > 0 ? Number(raw.amount) : 0,
              debtId: raw.debtId,
              notes: raw.notes || '',
              sourceExcerpt: raw.sourceExcerpt || '',
            })
          )
        : [];

      if (items.length === 0) {
        setError(
          'No clear monetary activities were detected. Please include a date, amount/price, and purpose for each transaction.'
        );
      }

      setDetectedLanguage(data.detectedLanguage || null);
      setSummaryNote(data.summaryNote || null);
      setWarnings(Array.isArray(data.missingInfoWarnings) ? data.missingInfoWarnings : []);
      setDrafts(items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to translate story right now.'
      );
    } finally {
      setParsing(false);
    }
  };

  const updateDraft = (tempId: string, patch: Partial<StoryDraftEntry>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d))
    );
  };

  const handlePillarChange = (draft: StoryDraftEntry, choice: PillarChoice) => {
    if (choice === 'emergency_fund' || choice === 'emergency_use') {
      const action: EmergencyAction = choice === 'emergency_use' ? 'use' : 'fund';
      updateDraft(draft.tempId, {
        type: 'emergency',
        emergencyAction: action,
        category:
          action === 'use' ? 'Equipment Breakdown' : 'Emergency Fund Deposit',
        debtId: undefined,
      });
    } else {
      updateDraft(draft.tempId, {
        type: choice,
        emergencyAction: undefined,
        category: ENTRY_TYPE_META[choice].defaultCategories[0],
        debtId: choice === 'debt' ? draft.debtId : undefined,
      });
    }
  };

  const removeDraft = (tempId: string) => {
    setDrafts((prev) => prev.filter((d) => d.tempId !== tempId));
  };

  const toggleAll = (selected: boolean) => {
    setDrafts((prev) => prev.map((d) => ({ ...d, selected })));
  };

  const handleSaveSelected = async () => {
    setError(null);
    if (selectedDrafts.length === 0) {
      setError('Select at least one translated activity to save.');
      return;
    }
    if (invalidSelectedCount > 0) {
      setError(
        'Every selected entry must have a date, purpose/title, and an amount greater than zero.'
      );
      return;
    }

    setSaving(true);
    try {
      await onSaveBatch(
        selectedDrafts.map((d) => ({
          date: d.date,
          type: d.type,
          ...(d.type === 'emergency'
            ? { emergencyAction: d.emergencyAction || 'fund' }
            : {}),
          title: d.title.trim().slice(0, 140),
          category:
            d.category.trim().slice(0, 60) ||
            ENTRY_TYPE_META[d.type].defaultCategories[0],
          counterparty: d.counterparty.trim().slice(0, 100),
          account: d.account || DEFAULT_ACCOUNTS[0],
          currency: d.currency,
          amount: d.amount,
          exchangeRate: parsedRate,
          ...(d.type === 'debt' && d.debtId ? { debtId: d.debtId } : {}),
          notes:
            d.notes.trim().slice(0, 500) ||
            (d.sourceExcerpt ? `From story: "${d.sourceExcerpt}"` : '').slice(0, 500),
        }))
      );
      if (!isGuest) {
        setStory('');
        setDrafts([]);
        setWarnings([]);
        setDetectedLanguage(null);
        setSummaryNote(null);
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save translated entries.'
      );
    } finally {
      setSaving(false);
    }
  };

  const activeDebts = debts.filter((d) => d.status !== 'paid_off');

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h2
                id="story-modal-title"
                className="font-display text-base font-bold text-slate-900 dark:text-slate-100 truncate"
              >
                Story-to-Journal AI Translator
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Write how you spent, earned, saved, tithed, or invested in any language — we mark every activity automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Story Composer */}
          <form onSubmit={handleTranslate} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="journal-story-input"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Your Financial Story (include Date · Price/Amount · Purpose)
              </label>
              <button
                type="button"
                onClick={() => setStory(EXAMPLE_STORY)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                Try Example Story
              </button>
            </div>

            <textarea
              id="journal-story-input"
              rows={4}
              maxLength={6000}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Example: In October 15 given a job of website building which salary is 180,000 TZS, Tithe 18,000 TZS, after that in October 20 I invested to forex trading 25,000 TZS, Saving 10,000 TZS, Emergence 10,000 TZS, uses Bundles 10,000 TZS, October 25 Helping friend 20,000 TZS, October 29 25,000 Cooking Gas exchange"
              className="w-full px-3.5 py-3 text-sm leading-relaxed border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white dark:focus:bg-slate-900"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span>Default Currency:</span>
                  <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {(['TZS', 'USD'] as const).map((cur) => (
                      <button
                        key={cur}
                        type="button"
                        onClick={() => setDefaultCurrency(cur)}
                        className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          defaultCurrency === cur
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {cur}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span>Rate:</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    aria-label="Exchange rate TZS per USD"
                    className="w-20 px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <span>TZS/USD</span>
                </div>

                <span className="font-mono tabular-nums">
                  {story.length.toLocaleString()} / 6,000
                </span>
              </div>

              <button
                type="submit"
                disabled={parsing || !story.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-700 rounded-lg hover:bg-slate-800 dark:hover:bg-emerald-600 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Translating Story...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Translate Story to Journal
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Missing Information Warnings */}
          {warnings.length > 0 && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Review Incomplete Details (Date, Price, or Purpose)
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-amber-800 dark:text-amber-300">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Translated Activities Review */}
          {drafts.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    Marked Journal Activities ({drafts.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {detectedLanguage && <span>Language: {detectedLanguage}</span>}
                    {detectedLanguage && summaryNote && <span aria-hidden="true"> · </span>}
                    {summaryNote && <span>{summaryNote}</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => toggleAll(true)}
                    className="px-2.5 py-1 font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    Select All
                  </button>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                    /
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleAll(false)}
                    className="px-2.5 py-1 font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {drafts.map((draft, index) => {
                  const pillarValue = toPillarChoice(draft.type, draft.emergencyAction);
                  const dual =
                    Number.isFinite(draft.amount) && draft.amount > 0
                      ? convertToDual(draft.amount, draft.currency, parsedRate)
                      : { amountUSD: 0, amountTZS: 0 };
                  const needsAmount = !Number.isFinite(draft.amount) || draft.amount <= 0;
                  const needsTitle = !draft.title.trim();

                  return (
                    <div
                      key={draft.tempId}
                      className={`rounded-xl border p-3.5 transition-colors space-y-3 ${
                        draft.selected
                          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                          : 'bg-slate-50/70 dark:bg-slate-950/40 border-slate-200/70 dark:border-slate-800 opacity-65'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft(draft.tempId, { selected: !draft.selected })
                            }
                            aria-label={`Toggle activity ${index + 1}`}
                            className="text-emerald-700 dark:text-emerald-400 cursor-pointer shrink-0"
                          >
                            {draft.selected ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                            #{index + 1}
                          </span>
                          {draft.sourceExcerpt && (
                            <span className="text-xs italic text-slate-500 dark:text-slate-400 truncate">
                              &ldquo;{draft.sourceExcerpt}&rdquo;
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs shrink-0">
                          {!draft.hasExplicitDate && (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">
                              Date inferred
                            </span>
                          )}
                          {needsAmount && (
                            <span className="text-rose-700 dark:text-rose-400 font-medium">
                              Needs amount
                            </span>
                          )}
                          {needsTitle && (
                            <span className="text-rose-700 dark:text-rose-400 font-medium">
                              Needs purpose
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeDraft(draft.tempId)}
                            aria-label={`Remove item ${index + 1}`}
                            className="p-1 text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        {/* Pillar */}
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Pillar
                          </label>
                          <select
                            value={pillarValue}
                            onChange={(e) =>
                              handlePillarChange(draft, e.target.value as PillarChoice)
                            }
                            className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          >
                            <option value="income">Income (+)</option>
                            <option value="spending">Spending (-)</option>
                            <option value="saving">Saving</option>
                            <option value="emergency_fund">Emergency Reserve (+)</option>
                            <option value="emergency_use">Emergency Use (-)</option>
                            <option value="investment">Investment / Market</option>
                            <option value="debt">Debt Repayment</option>
                            <option value="tithe">Tithe (10%)</option>
                            <option value="offering">Offering / Charity</option>
                          </select>
                        </div>

                        {/* Date */}
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            value={draft.date}
                            onChange={(e) =>
                              updateDraft(draft.tempId, {
                                date: e.target.value,
                                hasExplicitDate: true,
                              })
                            }
                            className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </div>

                        {/* Category */}
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Category
                          </label>
                          <select
                            value={draft.category}
                            onChange={(e) =>
                              updateDraft(draft.tempId, { category: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          >
                            <optgroup label={`${ENTRY_TYPE_META[draft.type].shortLabel} Categories`}>
                              {ENTRY_TYPE_META[draft.type].defaultCategories.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                              {draft.category &&
                                !ENTRY_TYPE_META[draft.type].defaultCategories.includes(
                                  draft.category
                                ) &&
                                !FINANCIAL_MARKET_CATEGORIES.includes(draft.category) && (
                                  <option value={draft.category}>{draft.category}</option>
                                )}
                            </optgroup>
                            {draft.type !== 'investment' && (
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

                        {/* Account */}
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Account
                          </label>
                          <select
                            value={draft.account}
                            onChange={(e) =>
                              updateDraft(draft.tempId, { account: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          >
                            {DEFAULT_ACCOUNTS.map((acc) => (
                              <option key={acc} value={acc}>
                                {acc}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Title / Purpose */}
                        <div className="sm:col-span-6">
                          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Purpose / Title
                          </label>
                          <input
                            type="text"
                            maxLength={140}
                            value={draft.title}
                            onChange={(e) =>
                              updateDraft(draft.tempId, {
                                title: e.target.value,
                                hasExplicitPurpose: Boolean(e.target.value.trim()),
                              })
                            }
                            placeholder="Describe purpose of money"
                            className={`w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                              needsTitle
                                ? 'border-rose-400 dark:border-rose-600'
                                : 'border-slate-200 dark:border-slate-700'
                            }`}
                          />
                        </div>

                        {/* Currency + Amount */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Currency
                          </label>
                          <select
                            value={draft.currency}
                            onChange={(e) =>
                              updateDraft(draft.tempId, {
                                currency: e.target.value as CurrencyCode,
                              })
                            }
                            className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          >
                            <option value="TZS">TZS</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Amount ({draft.currency})
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step={draft.currency === 'USD' ? '0.01' : '1'}
                              value={draft.amount || ''}
                              onChange={(e) =>
                                updateDraft(draft.tempId, {
                                  amount: Number(e.target.value) || 0,
                                  hasExplicitAmount: Number(e.target.value) > 0,
                                })
                              }
                              className={`w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                                needsAmount
                                  ? 'border-rose-400 dark:border-rose-600'
                                  : 'border-slate-200 dark:border-slate-700'
                              }`}
                            />
                            {dual.amountUSD > 0 && (
                              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {draft.currency === 'TZS'
                                  ? formatUSD(dual.amountUSD)
                                  : formatTZS(dual.amountTZS)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Optional Debt Link */}
                        {draft.type === 'debt' && activeDebts.length > 0 && (
                          <div className="sm:col-span-12">
                            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                              Link to Tracked Debt Account (Optional)
                            </label>
                            <select
                              value={draft.debtId || ''}
                              onChange={(e) =>
                                updateDraft(draft.tempId, {
                                  debtId: e.target.value || undefined,
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            >
                              <option value="">General Debt Payment (Unlinked)</option>
                              {activeDebts.map((debt) => (
                                <option key={debt.id} value={debt.id}>
                                  {debt.creditor} — {debt.purpose} ({debt.currency})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            {drafts.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedDrafts.length} selected
                </span>
                {batchStats.inflowTzs > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-mono">
                      In: +{formatTZS(batchStats.inflowTzs)} ({formatUSD(batchStats.inflowUsd)})
                    </span>
                  </>
                )}
                {batchStats.outflowTzs > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-rose-700 dark:text-rose-400 font-mono">
                      Out: -{formatTZS(batchStats.outflowTzs)} ({formatUSD(batchStats.outflowUsd)})
                    </span>
                  </>
                )}
                {batchStats.titheAccruedUsd > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                      {titheRatePercent}% Tithe impact: {formatUSD(batchStats.titheAccruedUsd)}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <span>
                {isGuest
                  ? 'Guest Preview: translate stories freely; sign in to save to your journal.'
                  : 'Write or paste your daily/weekly notes above to translate them into entries.'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
            {drafts.length > 0 && (
              <button
                type="button"
                onClick={handleSaveSelected}
                disabled={saving || selectedDrafts.length === 0}
                className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                {saving
                  ? 'Saving Entries...'
                  : isGuest
                  ? `Sign In to Save (${selectedDrafts.length})`
                  : `Save ${selectedDrafts.length} ${
                      selectedDrafts.length === 1 ? 'Entry' : 'Entries'
                    } to Journal`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
