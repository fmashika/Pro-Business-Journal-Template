import React, { useMemo, useState } from 'react';
import { Download, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { exportMonthToCSV, getMonthLabel } from '../lib/analytics';
import { formatNativeCurrency, formatTZS, formatUSD } from '../lib/currency';
import {
  CurrencyCode,
  DisplayCurrencyMode,
  ENTRY_TYPE_META,
  EntryType,
  JournalEntry,
} from '../types/finance';
import { DualAmount } from './DualAmount';

interface DailyJournalViewProps {
  monthKey: string;
  entries: JournalEntry[];
  displayMode: DisplayCurrencyMode;
  onOpenNewEntry: (presetType?: EntryType) => void;
  onOpenStoryImport: () => void;
  onEditEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (entry: JournalEntry) => Promise<void>;
}

const FILTER_TABS: { key: 'all' | EntryType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'income', label: 'Income' },
  { key: 'spending', label: 'Spending' },
  { key: 'saving', label: 'Savings' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'investment', label: 'Investment' },
  { key: 'debt', label: 'Debt' },
  { key: 'tithe', label: 'Tithe' },
  { key: 'offering', label: 'Offering' },
];

export const DailyJournalView: React.FC<DailyJournalViewProps> = ({
  monthKey,
  entries,
  displayMode,
  onOpenNewEntry,
  onOpenStoryImport,
  onEditEntry,
  onDeleteEntry,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | EntryType>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | CurrencyCode>('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => e.monthKey === monthKey)
      .filter((e) => (typeFilter === 'all' ? true : e.type === typeFilter))
      .filter((e) => (currencyFilter === 'ALL' ? true : e.currency === currencyFilter))
      .filter((e) => {
        if (!q) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.counterparty.toLowerCase().includes(q) ||
          e.account.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, monthKey, typeFilter, currencyFilter, search]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const e of filtered) {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const handleDelete = async (entry: JournalEntry) => {
    setDeletingId(entry.id);
    try {
      await onDeleteEntry(entry);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDayHeader = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, merchant, account, or notes..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white dark:focus:bg-slate-800"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['ALL', 'USD', 'TZS'] as const).map((cur) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => setCurrencyFilter(cur)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    currencyFilter === cur
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {cur === 'ALL' ? 'All Currencies' : cur}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => exportMonthToCSV(entries, monthKey)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>

            <button
              type="button"
              onClick={onOpenStoryImport}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              Story Entry
            </button>

            <button
              type="button"
              onClick={() => onOpenNewEntry()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              New Entry
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTypeFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                typeFilter === tab.key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Day-by-Day Journal */}
      {groupedByDay.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center transition-colors">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            No Journal Entries Found for {getMonthLabel(monthKey)}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            {search || typeFilter !== 'all' || currencyFilter !== 'ALL'
              ? 'Try clearing your search or filter tabs to see all recorded transactions.'
              : 'Record your first daily business transaction, expense, saving, or tithe for this month.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenStoryImport}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              Write Story Entry
            </button>
            <button
              type="button"
              onClick={() => onOpenNewEntry()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Log Journal Entry
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDay.map(([date, dayEntries]) => {
            const dayInUSD = dayEntries
              .filter((e) => e.type === 'income')
              .reduce((s, e) => s + e.amountUSD, 0);
            const dayInTZS = dayEntries
              .filter((e) => e.type === 'income')
              .reduce((s, e) => s + e.amountTZS, 0);
            const dayOutUSD = dayEntries
              .filter(
                (e) =>
                  e.type === 'spending' ||
                  e.type === 'debt' ||
                  e.type === 'tithe' ||
                  e.type === 'offering' ||
                  (e.type === 'emergency' && e.emergencyAction === 'use')
              )
              .reduce((s, e) => s + e.amountUSD, 0);
            const dayOutTZS = dayEntries
              .filter(
                (e) =>
                  e.type === 'spending' ||
                  e.type === 'debt' ||
                  e.type === 'tithe' ||
                  e.type === 'offering' ||
                  (e.type === 'emergency' && e.emergencyAction === 'use')
              )
              .reduce((s, e) => s + e.amountTZS, 0);

            return (
              <div
                key={date}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-colors"
              >
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <span>{formatDayHeader(date)}</span>
                    <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
                      ·
                    </span>
                    <span className="font-normal text-slate-500 dark:text-slate-400">
                      {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                    {dayInUSD > 0 && (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        +{displayMode === 'TZS' ? formatTZS(dayInTZS) : formatUSD(dayInUSD)}
                      </span>
                    )}
                    {dayOutUSD > 0 && (
                      <span className="text-rose-700 dark:text-rose-400 font-medium">
                        -{displayMode === 'TZS' ? formatTZS(dayOutTZS) : formatUSD(dayOutUSD)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dayEntries.map((entry) => {
                    const meta = ENTRY_TYPE_META[entry.type];
                    const isEmergencyUse =
                      entry.type === 'emergency' && entry.emergencyAction === 'use';
                    const isInflow = entry.type === 'income';
                    return (
                      <div
                        key={entry.id}
                        className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {entry.title}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                              Native: {formatNativeCurrency(entry.amount, entry.currency)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
                            <span
                              className={
                                isEmergencyUse
                                  ? 'text-amber-700 dark:text-amber-400 font-medium'
                                  : isInflow
                                  ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                                  : 'text-slate-700 dark:text-slate-300 font-medium'
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
                          {entry.notes && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                              {entry.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
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

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditEntry(entry)}
                              aria-label={`Edit ${entry.title}`}
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry)}
                              disabled={deletingId === entry.id}
                              aria-label={`Delete ${entry.title}`}
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
