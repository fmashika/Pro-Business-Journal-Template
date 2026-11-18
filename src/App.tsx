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
  Lock,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import { DailyJournalView } from './components/DailyJournalView';
import { DebtModal } from './components/DebtModal';
import { EntryModal } from './components/EntryModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GuestUpgradeModal } from './components/GuestUpgradeModal';
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
  signInWithGoogle,
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
  const [isGuest, setIsGuest] = useState(false);
  const [guestPromptAction, setGuestPromptAction] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('pro_journal_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('pro_journal_theme', theme);
    } catch {
      // Ignore storage failures in restricted contexts
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

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
      if (u) {
        setIsGuest(false);
        setGuestPromptAction(null);
      } else {
        setEntries([]);
        setDebts([]);
        setLoadingData(false);
      }
    });
    return () => unsub();
  }, []);

  const handleEnterGuest = () => {
    const curMonth = todayStr.slice(0, 7);
    const prevMonth = shiftMonthKey(curMonth, -1);
    const bundle = buildSampleSeedBundle(curMonth, prevMonth, 2650);
    setEntries(bundle.entries.map((e) => ({ ...e, userId: 'guest' })));
    setDebts(bundle.debts.map((d) => ({ ...d, userId: 'guest' })));
    setPreferences({
      userId: 'guest',
      businessName: 'Pro Business Journal Template',
      exchangeRateTzsPerUsd: 2650,
      displayCurrency: 'BOTH',
      monthlySavingsGoalUsd: 500,
      emergencyTargetMonths: 3,
      titheRatePercent: 10,
    });
    setDisplayMode('BOTH');
    setMonthKey(curMonth);
    setActiveTab('overview');
    setIsGuest(true);
    setLoadingData(false);
  };

  const handleExitGuest = () => {
    setIsGuest(false);
    setEntries([]);
    setDebts([]);
    setGuestPromptAction(null);
  };

  const handleGuestSignIn = async () => {
    await signInWithGoogle();
  };

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
    if (isGuest || !user) {
      setGuestPromptAction('record a new transaction');
      return;
    }
    setEditingEntry(null);
    setPresetType(typePreset);
    setPresetAmountUsd(amountUsdPreset);
    setPresetEmergencyAction(emergencyPreset);
    setPresetDebtId(debtIdPreset);
    setEntryModalOpen(true);
  };

  const openEditEntry = (entry: JournalEntry) => {
    if (isGuest || !user) {
      setGuestPromptAction('edit this journal entry');
      return;
    }
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
    if (isGuest || !user) {
      setGuestPromptAction('delete this journal entry');
      return;
    }
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
    if (isGuest || !user) {
      setGuestPromptAction('add a debt account');
      return;
    }
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
    if (isGuest || !user) {
      setGuestPromptAction('delete a debt account');
      return;
    }
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
    if (isGuest || !user) {
      setGuestPromptAction('save journal settings');
      return;
    }
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
    if (isGuest || !user) {
      setGuestPromptAction('load sample data into a personal account');
      return;
    }
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
    if (isGuest || !user) {
      setGuestPromptAction('clear journal records');
      return;
    }
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
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-center transition-colors">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Initializing Pro Business Journal Template...
        </div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return (
      <SignInGate
        onEnterGuest={handleEnterGuest}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  const activeNavTitle = NAV_ITEMS.find((i) => i.key === activeTab)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[272px] lg:shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen transition-colors">
        <div className="px-5 py-5 border-b border-slate-200 dark:border-slate-800">
          <span className="font-display text-[15px] font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap block truncate">
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
                    ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          {isGuest ? (
            <>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Guest Preview
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Read-only · No account
                </div>
              </div>
              <button
                type="button"
                onClick={handleGuestSignIn}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                Start Saving Today!
              </button>
              <button
                type="button"
                onClick={handleExitGuest}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                Exit Guest Preview
              </button>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {user?.displayName || 'Journal Owner'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user?.email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOutUser()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white dark:bg-slate-900 h-full flex flex-col border-r border-slate-200 dark:border-slate-800 z-10">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="font-display text-[15px] font-bold text-slate-900 dark:text-slate-100 truncate">
                Pro Business Journal Template
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation"
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg cursor-pointer"
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
                        ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              {isGuest ? (
                <>
                  <button
                    type="button"
                    onClick={handleGuestSignIn}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Start Saving Today!
                  </button>
                  <button
                    type="button"
                    onClick={handleExitGuest}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    Exit Guest Preview
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                className="lg:hidden p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="text-slate-500 dark:text-slate-400 truncate hidden sm:inline">
                  {preferences.businessName}
                </span>
                <span
                  aria-hidden="true"
                  className="text-slate-300 dark:text-slate-600 hidden sm:inline"
                >
                  /
                </span>
                <h1 className="font-display font-bold text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">
                  {activeNavTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              {/* Month Selector */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}
                  aria-label="Previous month"
                  className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-md cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap min-w-[110px] text-center">
                  {getMonthLabel(monthKey)}
                </span>
                <button
                  type="button"
                  onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))}
                  aria-label="Next month"
                  className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-md cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Display Currency Switch */}
              <div className="hidden sm:flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(['USD', 'TZS', 'BOTH'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDisplayMode(m)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      displayMode === m
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {m === 'BOTH' ? 'USD + TZS' : m}
                  </button>
                ))}
              </div>

              {/* Light / Dark Mode Switcher Icon */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => openNewEntry()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isGuest ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                Log Entry
              </button>
            </div>
          </div>
        </header>

        {isGuest && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900/70">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Guest Preview (Read-Only) · View all reports and cash flow patterns freely. Open a
                  Google account to add, edit, or save entries.
                </span>
              </div>
              <button
                type="button"
                onClick={handleGuestSignIn}
                className="px-3 py-1 font-semibold text-white bg-slate-900 dark:bg-emerald-700 rounded-md hover:bg-slate-800 dark:hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Sign In to Edit
              </button>
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-6">
          {loadingData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse"
                  />
                ))}
              </div>
              <div className="h-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
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
                  onOpenNewDebt={() => {
                    if (isGuest || !user) {
                      setGuestPromptAction('add a debt account');
                      return;
                    }
                    setDebtModalOpen(true);
                  }}
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
                  isGuest={isGuest}
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

      <GuestUpgradeModal
        isOpen={guestPromptAction !== null}
        actionLabel={guestPromptAction || undefined}
        onClose={() => setGuestPromptAction(null)}
        onSignedIn={() => {
          setIsGuest(false);
          setGuestPromptAction(null);
        }}
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
