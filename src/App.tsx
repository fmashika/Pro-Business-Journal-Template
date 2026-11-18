import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { DailyJournalView } from './components/DailyJournalView';
import { DebtModal } from './components/DebtModal';
import { EntryModal } from './components/EntryModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OverviewView } from './components/OverviewView';
import { ReservesDebtView } from './components/ReservesDebtView';
import { SettingsView } from './components/SettingsView';
import { SignInGate } from './components/SignInGate';
import { StewardshipView } from './components/StewardshipView';
import {
  computeDailyCashFlowSeries,
  computeDayOfWeekPatterns,
  computeMonthlySummary,
  computeOverallHealth,
  getMonthLabel,
  shiftMonthKey,
} from './lib/analytics';
import { convertToDual } from './lib/currency';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signOutUser,
  testConnection,
} from './lib/firebase';
import { buildSampleSeedBundle } from './lib/sampleData';
import {
  CurrencyCode,
  DebtAccount,
  DisplayCurrencyMode,
  EmergencyAction,
  EntryType,
  JournalEntry,
  UserPreferences,
} from './types/finance';

type NavTab = 'overview' | 'journal' | 'stewardship' | 'reserves' | 'settings';

const NAV_ITEMS: { key: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'journal', label: 'Daily Journal', icon: BookOpen },
  { key: 'stewardship', label: 'Tithe & Offering', icon: HeartHandshake },
  { key: 'reserves', label: 'Reserves & Debt', icon: ShieldCheck },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function MainWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const todayStr = getTodayDateString();
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [monthKey, setMonthKey] = useState<string>(todayStr.slice(0, 7));

  const [preferences, setPreferences] = useState<UserPreferences>({
    userId: '',
    businessName: 'Pro Business Journal Template',
    exchangeRateTzsPerUsd: 2650,
    displayCurrency: 'BOTH',
    monthlySavingsGoalUsd: 500,
    emergencyTargetMonths: 3,
    titheRatePercent: 10,
  });
  const [displayMode, setDisplayMode] = useState<DisplayCurrencyMode>('BOTH');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [debts, setDebts] = useState<DebtAccount[]>([]);
  const [seedingSample, setSeedingSample] = useState(false);

  // Entry modal state
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [presetType, setPresetType] = useState<EntryType | undefined>(undefined);
  const [presetAmountUsd, setPresetAmountUsd] = useState<number | undefined>(undefined);
  const [presetEmergencyAction, setPresetEmergencyAction] = useState<EmergencyAction | undefined>(
    undefined
  );
  const [presetDebtId, setPresetDebtId] = useState<string | undefined>(undefined);

  // Debt modal state
  const [debtModalOpen, setDebtModalOpen] = useState(false);

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setEntries([]);
        setDebts([]);
        setLoadingData(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    let active = true;
    const uid = user.uid;

    const bootstrapUserDocs = async () => {
      const profileRef = doc(db, 'users', uid, 'private', 'profile');
      try {
        const profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) {
          await setDoc(profileRef, {
            userId: uid,
            displayName: (user.displayName || user.email?.split('@')[0] || 'Journal Owner').slice(
              0,
              100
            ),
            email: (user.email || 'owner@amani-ledger.app').slice(0, 150),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/private/profile`);
      }

      const prefRef = doc(db, 'users', uid, 'settings', 'preferences');
      try {
        const prefSnap = await getDoc(prefRef);
        if (!prefSnap.exists()) {
          await setDoc(prefRef, {
            userId: uid,
            businessName: 'Pro Business Journal Template',
            exchangeRateTzsPerUsd: 2650,
            displayCurrency: 'BOTH',
            monthlySavingsGoalUsd: 500,
            emergencyTargetMonths: 3,
            titheRatePercent: 10,
            updatedAt: serverTimestamp(),
          });
        } else if (prefSnap.data()?.businessName === 'Amani Business Journal') {
          await updateDoc(prefRef, {
            businessName: 'Pro Business Journal Template',
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/settings/preferences`);
      }
    };

    bootstrapUserDocs();

    const prefPath = `users/${uid}/settings/preferences`;
    const unsubPref = onSnapshot(
      doc(db, 'users', uid, 'settings', 'preferences'),
      (snap) => {
        if (!active || !snap.exists()) return;
        const data = snap.data() as UserPreferences;
        setPreferences(data);
        setDisplayMode(data.displayCurrency || 'BOTH');
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, prefPath);
      }
    );

    const entriesPath = `users/${uid}/entries`;
    const entriesQuery = query(collection(db, 'users', uid, 'entries'), where('userId', '==', uid));
    const unsubEntries = onSnapshot(
      entriesQuery,
      (snap) => {
        if (!active) return;
        const list: JournalEntry[] = snap.docs.map((d) => d.data() as JournalEntry);
        setEntries(list);
        setLoadingData(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, entriesPath);
      }
    );

    const debtsPath = `users/${uid}/debts`;
    const debtsQuery = query(collection(db, 'users', uid, 'debts'), where('userId', '==', uid));
    const unsubDebts = onSnapshot(
      debtsQuery,
      (snap) => {
        if (!active) return;
        const list: DebtAccount[] = snap.docs.map((d) => d.data() as DebtAccount);
        setDebts(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, debtsPath);
      }
    );

    return () => {
      active = false;
      unsubPref();
      unsubEntries();
      unsubDebts();
    };
  }, [authReady, user]);

  const prevMonthKey = useMemo(() => shiftMonthKey(monthKey, -1), [monthKey]);

  const summary = useMemo(
    () => computeMonthlySummary(entries, monthKey, preferences.titheRatePercent),
    [entries, monthKey, preferences.titheRatePercent]
  );

  const prevSummary = useMemo(
    () => computeMonthlySummary(entries, prevMonthKey, preferences.titheRatePercent),
    [entries, prevMonthKey, preferences.titheRatePercent]
  );

  const overall = useMemo(
    () => computeOverallHealth(entries, debts, preferences),
    [entries, debts, preferences]
  );

  const dailySeries = useMemo(
    () => computeDailyCashFlowSeries(entries, monthKey),
    [entries, monthKey]
  );

  const dayOfWeek = useMemo(
    () => computeDayOfWeekPatterns(entries, monthKey),
    [entries, monthKey]
  );

  const openNewEntry = (
    typePreset?: EntryType,
    amountUsdPreset?: number,
    emergencyPreset?: EmergencyAction,
    debtIdPreset?: string
  ) => {
    setEditingEntry(null);
    setPresetType(typePreset);
    setPresetAmountUsd(amountUsdPreset);
    setPresetEmergencyAction(emergencyPreset);
    setPresetDebtId(debtIdPreset);
    setEntryModalOpen(true);
  };

  const openEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setPresetType(undefined);
    setPresetAmountUsd(undefined);
    setPresetEmergencyAction(undefined);
    setPresetDebtId(undefined);
    setEntryModalOpen(true);
  };

  const handleSaveEntry = async (payload: {
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
  }) => {
    if (!user) return;
    const uid = user.uid;
    const entryId = payload.id || makeId('entry');
    const entryRef = doc(db, 'users', uid, 'entries', entryId);
    const dual = convertToDual(payload.amount, payload.currency, payload.exchangeRate);
    const entryMonthKey = payload.date.slice(0, 7);

    if (payload.id) {
      // Update existing entry
      try {
        const updateData: Record<string, unknown> = {
          date: payload.date,
          monthKey: entryMonthKey,
          type: payload.type,
          title: payload.title,
          category: payload.category,
          counterparty: payload.counterparty,
          account: payload.account,
          currency: payload.currency,
          amount: payload.amount,
          exchangeRate: payload.exchangeRate,
          amountUSD: dual.amountUSD,
          amountTZS: dual.amountTZS,
          notes: payload.notes,
          updatedAt: serverTimestamp(),
          emergencyAction:
            payload.type === 'emergency' ? payload.emergencyAction || 'fund' : deleteField(),
          debtId: payload.type === 'debt' && payload.debtId ? payload.debtId : deleteField(),
        };
        await updateDoc(entryRef, updateData);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/entries/${entryId}`);
      }
      return;
    }

    // Create new entry (atomic batch if linked to an active debt account)
    const docData: Record<string, unknown> = {
      id: entryId,
      userId: uid,
      date: payload.date,
      monthKey: entryMonthKey,
      type: payload.type,
      title: payload.title,
      category: payload.category,
      counterparty: payload.counterparty,
      account: payload.account,
      currency: payload.currency,
      amount: payload.amount,
      exchangeRate: payload.exchangeRate,
      amountUSD: dual.amountUSD,
      amountTZS: dual.amountTZS,
      notes: payload.notes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (payload.type === 'emergency') {
      docData.emergencyAction = payload.emergencyAction || 'fund';
    }
    if (payload.type === 'debt' && payload.debtId) {
      docData.debtId = payload.debtId;
    }

    try {
      if (payload.type === 'debt' && payload.debtId) {
        const linkedDebt = debts.find((d) => d.id === payload.debtId);
        if (linkedDebt && linkedDebt.status !== 'paid_off') {
          const batch = writeBatch(db);
          batch.set(entryRef, docData);

          const paymentInDebtCurrency =
            linkedDebt.currency === payload.currency
              ? payload.amount
              : linkedDebt.currency === 'USD'
              ? dual.amountUSD
              : dual.amountTZS;

          const nextPaid = Math.min(
            linkedDebt.totalPrincipal,
            Math.round((linkedDebt.amountPaid + paymentInDebtCurrency) * 100) / 100
          );
          const nextStatus = nextPaid >= linkedDebt.totalPrincipal ? 'paid_off' : 'active';

          batch.update(doc(db, 'users', uid, 'debts', linkedDebt.id), {
            amountPaid: nextPaid,
            status: nextStatus,
            updatedAt: serverTimestamp(),
          });

          await batch.commit();
          return;
        }
      }

      await setDoc(entryRef, docData);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${uid}/entries/${entryId}`);
    }
  };

  const handleDeleteEntry = async (entry: JournalEntry) => {
    if (!user) return;
    const uid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', uid, 'entries', entry.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/entries/${entry.id}`);
    }
  };

  const handleSaveDebt = async (payload: {
    creditor: string;
    purpose: string;
    currency: CurrencyCode;
    totalPrincipal: number;
    amountPaid: number;
    dueDate: string;
  }) => {
    if (!user) return;
    const uid = user.uid;
    const debtId = makeId('debt');
    const status = payload.amountPaid >= payload.totalPrincipal ? 'paid_off' : 'active';
    try {
      await setDoc(doc(db, 'users', uid, 'debts', debtId), {
        id: debtId,
        userId: uid,
        creditor: payload.creditor,
        purpose: payload.purpose,
        currency: payload.currency,
        totalPrincipal: payload.totalPrincipal,
        amountPaid: payload.amountPaid,
        exchangeRate: preferences.exchangeRateTzsPerUsd,
        dueDate: payload.dueDate,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${uid}/debts/${debtId}`);
    }
  };

  const handleDeleteDebt = async (debtId: string) => {
    if (!user) return;
    const uid = user.uid;
    try {
      await deleteDoc(doc(db, 'users', uid, 'debts', debtId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/debts/${debtId}`);
    }
  };

  const handleSavePreferences = async (
    next: Omit<UserPreferences, 'userId' | 'updatedAt'>
  ) => {
    if (!user) return;
    const uid = user.uid;
    try {
      await updateDoc(doc(db, 'users', uid, 'settings', 'preferences'), {
        ...next,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/settings/preferences`);
    }
  };

  const handleLoadSampleData = async () => {
    if (!user) return;
    setSeedingSample(true);
    const uid = user.uid;
    const bundle = buildSampleSeedBundle(
      monthKey,
      shiftMonthKey(monthKey, -1),
      preferences.exchangeRateTzsPerUsd
    );

    try {
      const batch = writeBatch(db);
      for (const d of bundle.debts) {
        batch.set(doc(db, 'users', uid, 'debts', d.id), {
          ...d,
          userId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const e of bundle.entries) {
        batch.set(doc(db, 'users', uid, 'entries', e.id), {
          ...e,
          userId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/entries`);
    } finally {
      setSeedingSample(false);
    }
  };

  const handleClearAllData = async () => {
    if (!user) return;
    const uid = user.uid;
    try {
      const batch = writeBatch(db);
      for (const e of entries) {
        batch.delete(doc(db, 'users', uid, 'entries', e.id));
      }
      for (const d of debts) {
        batch.delete(doc(db, 'users', uid, 'debts', d.id));
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/entries`);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-sm text-slate-500">Initializing Pro Business Journal Template...</div>
      </div>
    );
  }

  if (!user) {
    return <SignInGate />;
  }

  const activeNavTitle = NAV_ITEMS.find((i) => i.key === activeTab)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[272px] lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-200">
          <span className="font-display text-[15px] font-bold tracking-tight text-slate-900 whitespace-nowrap block truncate">
            Pro Business Journal Template
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {user.displayName || 'Journal Owner'}
            </div>
            <div className="text-xs text-slate-500 truncate">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={() => signOutUser()}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <span className="font-display text-[15px] font-bold text-slate-900 truncate">
                Pro Business Journal Template
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => signOutUser()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="text-slate-500 truncate hidden sm:inline">
                  {preferences.businessName}
                </span>
                <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
                  /
                </span>
                <h1 className="font-display font-bold text-slate-900 truncate whitespace-nowrap">
                  {activeNavTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Month Selector */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}
                  aria-label="Previous month"
                  className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2.5 text-xs font-semibold text-slate-800 whitespace-nowrap min-w-[110px] text-center">
                  {getMonthLabel(monthKey)}
                </span>
                <button
                  type="button"
                  onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))}
                  aria-label="Next month"
                  className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Display Currency Switch */}
              <div className="hidden sm:flex items-center p-1 bg-slate-100 rounded-lg">
                {(['USD', 'TZS', 'BOTH'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDisplayMode(m)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      displayMode === m
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m === 'BOTH' ? 'USD + TZS' : m}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => openNewEntry()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Entry
              </button>
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-6">
          {loadingData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse"
                  />
                ))}
              </div>
              <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewView
                  monthKey={monthKey}
                  entries={entries}
                  summary={summary}
                  prevSummary={prevSummary}
                  overall={overall}
                  dailySeries={dailySeries}
                  dayOfWeek={dayOfWeek}
                  preferences={preferences}
                  displayMode={displayMode}
                  onOpenNewEntry={(t, amt) => openNewEntry(t, amt)}
                  onNavigate={(tab) => setActiveTab(tab)}
                  onLoadSampleData={handleLoadSampleData}
                  seedingSample={seedingSample}
                />
              )}

              {activeTab === 'journal' && (
                <DailyJournalView
                  monthKey={monthKey}
                  entries={entries}
                  displayMode={displayMode}
                  onOpenNewEntry={(t) => openNewEntry(t)}
                  onEditEntry={openEditEntry}
                  onDeleteEntry={handleDeleteEntry}
                />
              )}

              {activeTab === 'stewardship' && (
                <StewardshipView
                  monthKey={monthKey}
                  entries={entries}
                  summary={summary}
                  overall={overall}
                  preferences={preferences}
                  displayMode={displayMode}
                  onOpenNewEntry={(t, amt) => openNewEntry(t, amt)}
                />
              )}

              {activeTab === 'reserves' && (
                <ReservesDebtView
                  entries={entries}
                  debts={debts}
                  overall={overall}
                  preferences={preferences}
                  displayMode={displayMode}
                  onOpenNewEntry={(t, amt, em, dId) => openNewEntry(t, amt, em, dId)}
                  onOpenNewDebt={() => setDebtModalOpen(true)}
                  onDeleteDebt={handleDeleteDebt}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  preferences={preferences}
                  onSavePreferences={handleSavePreferences}
                  onLoadSampleData={handleLoadSampleData}
                  onClearAllData={handleClearAllData}
                  seedingSample={seedingSample}
                  entryCount={entries.length}
                  debtCount={debts.length}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <EntryModal
        isOpen={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        onSave={handleSaveEntry}
        initialEntry={editingEntry}
        presetType={presetType}
        presetAmountUsd={presetAmountUsd}
        presetEmergencyAction={presetEmergencyAction}
        presetDebtId={presetDebtId}
        defaultDate={
          monthKey === todayStr.slice(0, 7) ? todayStr : `${monthKey}-15`
        }
        defaultExchangeRate={preferences.exchangeRateTzsPerUsd}
        titheRatePercent={preferences.titheRatePercent}
        debts={debts}
      />

      <DebtModal
        isOpen={debtModalOpen}
        onClose={() => setDebtModalOpen(false)}
        onSave={handleSaveDebt}
        defaultDueDate={`${monthKey}-28`}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainWorkspace />
    </ErrorBoundary>
  );
}
