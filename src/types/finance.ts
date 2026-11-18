export type CurrencyCode = 'USD' | 'TZS';
export type DisplayCurrencyMode = 'USD' | 'TZS' | 'BOTH';

export type EntryType =
  | 'income'
  | 'spending'
  | 'saving'
  | 'emergency'
  | 'investment'
  | 'debt'
  | 'tithe'
  | 'offering';

export type EmergencyAction = 'fund' | 'use';

export interface JournalEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  type: EntryType;
  emergencyAction?: EmergencyAction;
  title: string;
  category: string;
  counterparty: string;
  account: string;
  currency: CurrencyCode;
  amount: number;
  exchangeRate: number;
  amountUSD: number;
  amountTZS: number;
  debtId?: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DebtAccount {
  id: string;
  userId: string;
  creditor: string;
  purpose: string;
  currency: CurrencyCode;
  totalPrincipal: number;
  amountPaid: number;
  exchangeRate: number;
  dueDate: string; // YYYY-MM-DD
  status: 'active' | 'paid_off';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPreferences {
  userId: string;
  businessName: string;
  exchangeRateTzsPerUsd: number;
  displayCurrency: DisplayCurrencyMode;
  monthlySavingsGoalUsd: number;
  emergencyTargetMonths: number;
  titheRatePercent: number;
  updatedAt?: unknown;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EntryTypeMeta {
  type: EntryType;
  label: string;
  shortLabel: string;
  direction: 'inflow' | 'outflow' | 'allocation';
  description: string;
  defaultCategories: string[];
}

export const ENTRY_TYPE_META: Record<EntryType, EntryTypeMeta> = {
  income: {
    type: 'income',
    label: 'Business Income / Gain',
    shortLabel: 'Income',
    direction: 'inflow',
    description: 'Sales, client retainers, services, or revenue gained (accrues 10% tithe).',
    defaultCategories: ['Client Sales', 'Product Revenue', 'Consulting', 'Commission', 'Dividend / Return', 'Other Gain'],
  },
  spending: {
    type: 'spending',
    label: 'Operating & Living Spending',
    shortLabel: 'Spending',
    direction: 'outflow',
    description: 'Daily business expenses, inventory, rent, utilities, transport, and personal spending.',
    defaultCategories: ['Inventory & Stock', 'Rent & Utilities', 'Transport & Fuel', 'Staff & Labor', 'Marketing', 'Supplies & Ops', 'Living & Meals'],
  },
  saving: {
    type: 'saving',
    label: 'Savings Allocation',
    shortLabel: 'Saving',
    direction: 'allocation',
    description: 'Planned cash reserves set aside for business stability or future goals.',
    defaultCategories: ['Business Reserve', 'Tax Reserve', 'Equipment Sinking Fund', 'Personal Savings'],
  },
  emergency: {
    type: 'emergency',
    label: 'Emergency Reserve & Uses',
    shortLabel: 'Emergency',
    direction: 'allocation',
    description: 'Build your emergency safety buffer or log an urgent emergency use drawdown.',
    defaultCategories: ['Emergency Fund Deposit', 'Equipment Breakdown', 'Medical Emergency', 'Urgent Repair', 'Supply Disruption'],
  },
  investment: {
    type: 'investment',
    label: 'Investment & Growth',
    shortLabel: 'Investment',
    direction: 'allocation',
    description: 'Capital deployed into treasury bills, mutual funds, stocks, or business expansion.',
    defaultCategories: ['UTT AMIS / Funds', 'Treasury Bills', 'Business Expansion', 'Equities / Bonds', 'Real Estate'],
  },
  debt: {
    type: 'debt',
    label: 'Debt Repayment',
    shortLabel: 'Debt Payment',
    direction: 'outflow',
    description: 'Principal or installment payments toward tracked business or personal debts.',
    defaultCategories: ['Supplier Credit', 'Business Loan', 'Equipment Financing', 'Line of Credit', 'Personal Debt'],
  },
  tithe: {
    type: 'tithe',
    label: 'Tithe (10% of Gains)',
    shortLabel: 'Tithe',
    direction: 'outflow',
    description: 'Sacred 10% tithe set apart from total money gained.',
    defaultCategories: ['Monthly 10% Tithe', 'Tithe Settlement', 'Firstfruits Tithe'],
  },
  offering: {
    type: 'offering',
    label: 'Offering & Charity',
    shortLabel: 'Offering',
    direction: 'outflow',
    description: 'Freewill offerings, charitable donations, community support, and generosity.',
    defaultCategories: ['Weekly Offering', 'Community Charity', 'Thanksgiving Offering', 'Education / Aid Donation'],
  },
};

export const DEFAULT_ACCOUNTS = [
  'Bank USD',
  'Bank TZS',
  'M-Pesa Business',
  'Tigo Pesa / Airtel',
  'Cash Till (TZS)',
  'Cash Vault (USD)',
];
