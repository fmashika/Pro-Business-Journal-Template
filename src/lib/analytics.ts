import {
  CategoryBudget,
  CurrencyCode,
  DebtAccount,
  JournalEntry,
  UserPreferences,
} from '../types/finance';
import { convertToDual } from './currency';

export interface DualTotal {
  usd: number;
  tzs: number;
}

export interface MonthlySummary {
  monthKey: string;
  income: DualTotal;
  spending: DualTotal;
  saving: DualTotal;
  emergencyFunded: DualTotal;
  emergencyUsed: DualTotal;
  investment: DualTotal;
  debtRepaid: DualTotal;
  tithePaid: DualTotal;
  titheAccrued: DualTotal;
  titheBalanceDue: DualTotal;
  offering: DualTotal;
  totalOutflows: DualTotal;
  netCashFlow: DualTotal;
  savingsRatePct: number;
  investmentRatePct: number;
  spendingRatioPct: number;
  generosityRatePct: number;
  titheCompletionPct: number;
  entryCount: number;
}

export interface DailyCashFlowPoint {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  inflowUSD: number;
  outflowUSD: number;
  inflowTZS: number;
  outflowTZS: number;
  netUSD: number;
  netTZS: number;
  cumulativeNetUSD: number;
  cumulativeNetTZS: number;
}

export interface DayOfWeekPattern {
  dayIndex: number; // 0 Sun .. 6 Sat
  dayLabel: string;
  inflowUSD: number;
  outflowUSD: number;
  inflowTZS: number;
  outflowTZS: number;
  txCount: number;
}

export interface OverallHealthMetrics {
  emergencyReserveNet: DualTotal;
  emergencyUsesTotal: DualTotal;
  emergencyFundedTotal: DualTotal;
  emergencyRunwayMonths: number;
  totalSavingsAllTime: DualTotal;
  totalInvestedAllTime: DualTotal;
  allTimeTitheAccrued: DualTotal;
  allTimeTithePaid: DualTotal;
  allTimeTitheDue: DualTotal;
  allTimeOffering: DualTotal;
  totalDebtRemaining: DualTotal;
  totalDebtPaid: DualTotal;
  totalDebtPrincipal: DualTotal;
  debtPayoffPct: number;
}

export type BudgetStatus = 'on_track' | 'near_limit' | 'over_budget';

export interface BudgetComparisonRow {
  budget: CategoryBudget;
  capDual: DualTotal;
  actualDual: DualTotal;
  remainingDual: DualTotal;
  utilizationPct: number;
  status: BudgetStatus;
  txCount: number;
}

export interface UncappedSpendingCategory {
  category: string;
  actualDual: DualTotal;
  txCount: number;
}

export interface MonthlyBudgetReport {
  monthKey: string;
  rows: BudgetComparisonRow[];
  uncappedCategories: UncappedSpendingCategory[];
  totalBudgeted: DualTotal;
  totalActualAllSpending: DualTotal;
  totalActualCapped: DualTotal;
  totalActualUncapped: DualTotal;
  remainingCappedHeadroom: DualTotal;
  overallUtilizationPct: number;
  onTrackCount: number;
  nearLimitCount: number;
  overBudgetCount: number;
}

export interface DebtPaymentHabit {
  overallMonthlyAvgInCurrency: number;
  overallPaymentCount: number;
  overallActiveMonths: number;
  overallTotalPaidInCurrency: number;
  debtSpecificMonthlyAvgInCurrency: number;
  debtSpecificPaymentCount: number;
  debtSpecificActiveMonths: number;
  debtSpecificTotalPaidInCurrency: number;
  recommendedMonthlyPayment: number;
  recommendedSource: 'debt_specific' | 'overall_journal' | 'none';
}

export interface PayoffProjection {
  status:
    | 'paid_off'
    | 'projected'
    | 'insufficient_payment'
    | 'no_payment_habit'
    | 'beyond_horizon';
  remainingBalance: number;
  monthlyPaymentUsed: number;
  annualInterestRatePct: number;
  monthsToPayoff: number | null;
  projectedPayoffDate: string | null; // YYYY-MM-DD
  projectedPayoffMonthLabel: string | null; // e.g. "May 2027"
  estimatedTotalInterest: number;
  estimatedTotalPayoffCost: number;
  firstMonthInterest: number;
  dueDateComparison: 'on_or_before' | 'after' | 'already_paid' | null;
  monthsDeltaVsDueDate: number | null; // negative = early, positive = late
}

function zeroDual(): DualTotal {
  return { usd: 0, tzs: 0 };
}

function addDual(a: DualTotal, usd: number, tzs: number): DualTotal {
  return {
    usd: Math.round((a.usd + usd) * 100) / 100,
    tzs: Math.round(a.tzs + tzs),
  };
}

export function getMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  const nextY = dt.getUTCFullYear();
  const nextM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${nextY}-${nextM}`;
}

export function getDaysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function computeMonthlySummary(
  entries: JournalEntry[],
  monthKey: string,
  titheRatePercent = 10
): MonthlySummary {
  const monthEntries = entries.filter((e) => e.monthKey === monthKey);
  const titheRate = Math.max(0, titheRatePercent) / 100;

  let income = zeroDual();
  let spending = zeroDual();
  let saving = zeroDual();
  let emergencyFunded = zeroDual();
  let emergencyUsed = zeroDual();
  let investment = zeroDual();
  let debtRepaid = zeroDual();
  let tithePaid = zeroDual();
  let offering = zeroDual();

  for (const e of monthEntries) {
    switch (e.type) {
      case 'income':
        income = addDual(income, e.amountUSD, e.amountTZS);
        break;
      case 'spending':
        spending = addDual(spending, e.amountUSD, e.amountTZS);
        break;
      case 'saving':
        saving = addDual(saving, e.amountUSD, e.amountTZS);
        break;
      case 'emergency':
        if (e.emergencyAction === 'use') {
          emergencyUsed = addDual(emergencyUsed, e.amountUSD, e.amountTZS);
        } else {
          emergencyFunded = addDual(emergencyFunded, e.amountUSD, e.amountTZS);
        }
        break;
      case 'investment':
        investment = addDual(investment, e.amountUSD, e.amountTZS);
        break;
      case 'debt':
        debtRepaid = addDual(debtRepaid, e.amountUSD, e.amountTZS);
        break;
      case 'tithe':
        tithePaid = addDual(tithePaid, e.amountUSD, e.amountTZS);
        break;
      case 'offering':
        offering = addDual(offering, e.amountUSD, e.amountTZS);
        break;
    }
  }

  const titheAccrued: DualTotal = {
    usd: Math.round(income.usd * titheRate * 100) / 100,
    tzs: Math.round(income.tzs * titheRate),
  };

  const titheBalanceDue: DualTotal = {
    usd: Math.max(0, Math.round((titheAccrued.usd - tithePaid.usd) * 100) / 100),
    tzs: Math.max(0, Math.round(titheAccrued.tzs - tithePaid.tzs)),
  };

  // True cash outflows include operating spending, emergency uses drawn, debt repayments, tithe, and offerings
  const totalOutflows: DualTotal = {
    usd:
      Math.round(
        (spending.usd + emergencyUsed.usd + debtRepaid.usd + tithePaid.usd + offering.usd) * 100
      ) / 100,
    tzs: Math.round(
      spending.tzs + emergencyUsed.tzs + debtRepaid.tzs + tithePaid.tzs + offering.tzs
    ),
  };

  // Net cash flow remaining after cash outflows (before/after capital allocations)
  const netCashFlow: DualTotal = {
    usd: Math.round((income.usd - totalOutflows.usd) * 100) / 100,
    tzs: Math.round(income.tzs - totalOutflows.tzs),
  };

  const denom = income.usd > 0 ? income.usd : 0;
  const savingsRatePct =
    denom > 0 ? Math.round(((saving.usd + emergencyFunded.usd) / denom) * 1000) / 10 : 0;
  const investmentRatePct = denom > 0 ? Math.round((investment.usd / denom) * 1000) / 10 : 0;
  const spendingRatioPct = denom > 0 ? Math.round((spending.usd / denom) * 1000) / 10 : 0;
  const generosityRatePct =
    denom > 0 ? Math.round(((tithePaid.usd + offering.usd) / denom) * 1000) / 10 : 0;
  const titheCompletionPct =
    titheAccrued.usd > 0
      ? Math.min(100, Math.round((tithePaid.usd / titheAccrued.usd) * 1000) / 10)
      : 100;

  return {
    monthKey,
    income,
    spending,
    saving,
    emergencyFunded,
    emergencyUsed,
    investment,
    debtRepaid,
    tithePaid,
    titheAccrued,
    titheBalanceDue,
    offering,
    totalOutflows,
    netCashFlow,
    savingsRatePct,
    investmentRatePct,
    spendingRatioPct,
    generosityRatePct,
    titheCompletionPct,
    entryCount: monthEntries.length,
  };
}

export function computeDailyCashFlowSeries(
  entries: JournalEntry[],
  monthKey: string
): DailyCashFlowPoint[] {
  const daysCount = getDaysInMonth(monthKey);
  const monthEntries = entries.filter((e) => e.monthKey === monthKey);
  const byDate = new Map<string, { inU: number; outU: number; inT: number; outT: number }>();

  for (const e of monthEntries) {
    const cur = byDate.get(e.date) || { inU: 0, outU: 0, inT: 0, outT: 0 };
    if (e.type === 'income') {
      cur.inU += e.amountUSD;
      cur.inT += e.amountTZS;
    } else if (
      e.type === 'spending' ||
      e.type === 'debt' ||
      e.type === 'tithe' ||
      e.type === 'offering' ||
      (e.type === 'emergency' && e.emergencyAction === 'use')
    ) {
      cur.outU += e.amountUSD;
      cur.outT += e.amountTZS;
    }
    byDate.set(e.date, cur);
  }

  const points: DailyCashFlowPoint[] = [];
  let cumU = 0;
  let cumT = 0;

  for (let d = 1; d <= daysCount; d++) {
    const date = `${monthKey}-${String(d).padStart(2, '0')}`;
    const v = byDate.get(date) || { inU: 0, outU: 0, inT: 0, outT: 0 };
    const netU = Math.round((v.inU - v.outU) * 100) / 100;
    const netT = Math.round(v.inT - v.outT);
    cumU = Math.round((cumU + netU) * 100) / 100;
    cumT = Math.round(cumT + netT);

    points.push({
      date,
      dayNumber: d,
      inflowUSD: Math.round(v.inU * 100) / 100,
      outflowUSD: Math.round(v.outU * 100) / 100,
      inflowTZS: Math.round(v.inT),
      outflowTZS: Math.round(v.outT),
      netUSD: netU,
      netTZS: netT,
      cumulativeNetUSD: cumU,
      cumulativeNetTZS: cumT,
    });
  }

  return points;
}

export function computeDayOfWeekPatterns(
  entries: JournalEntry[],
  monthKey: string
): DayOfWeekPattern[] {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const buckets: DayOfWeekPattern[] = labels.map((dayLabel, dayIndex) => ({
    dayIndex,
    dayLabel,
    inflowUSD: 0,
    outflowUSD: 0,
    inflowTZS: 0,
    outflowTZS: 0,
    txCount: 0,
  }));

  for (const e of entries) {
    if (e.monthKey !== monthKey) continue;
    const [y, m, d] = e.date.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const idx = dt.getUTCDay();
    const b = buckets[idx];
    b.txCount += 1;
    if (e.type === 'income') {
      b.inflowUSD += e.amountUSD;
      b.inflowTZS += e.amountTZS;
    } else if (
      e.type === 'spending' ||
      e.type === 'debt' ||
      e.type === 'tithe' ||
      e.type === 'offering' ||
      (e.type === 'emergency' && e.emergencyAction === 'use')
    ) {
      b.outflowUSD += e.amountUSD;
      b.outflowTZS += e.amountTZS;
    }
  }

  // Return Mon -> Sun order for business week readability
  return [buckets[1], buckets[2], buckets[3], buckets[4], buckets[5], buckets[6], buckets[0]];
}

export function computeOverallHealth(
  entries: JournalEntry[],
  debts: DebtAccount[],
  preferences: UserPreferences
): OverallHealthMetrics {
  const rate = preferences.exchangeRateTzsPerUsd > 0 ? preferences.exchangeRateTzsPerUsd : 2650;
  const titheRate = Math.max(0, preferences.titheRatePercent) / 100;

  let emergencyFundedTotal = zeroDual();
  let emergencyUsesTotal = zeroDual();
  let totalSavingsAllTime = zeroDual();
  let totalInvestedAllTime = zeroDual();
  let allTimeIncome = zeroDual();
  let allTimeTithePaid = zeroDual();
  let allTimeOffering = zeroDual();

  const spendingByMonth = new Map<string, number>();

  for (const e of entries) {
    if (e.type === 'income') {
      allTimeIncome = addDual(allTimeIncome, e.amountUSD, e.amountTZS);
    } else if (e.type === 'spending') {
      spendingByMonth.set(e.monthKey, (spendingByMonth.get(e.monthKey) || 0) + e.amountUSD);
    } else if (e.type === 'saving') {
      totalSavingsAllTime = addDual(totalSavingsAllTime, e.amountUSD, e.amountTZS);
    } else if (e.type === 'emergency') {
      if (e.emergencyAction === 'use') {
        emergencyUsesTotal = addDual(emergencyUsesTotal, e.amountUSD, e.amountTZS);
      } else {
        emergencyFundedTotal = addDual(emergencyFundedTotal, e.amountUSD, e.amountTZS);
      }
    } else if (e.type === 'investment') {
      totalInvestedAllTime = addDual(totalInvestedAllTime, e.amountUSD, e.amountTZS);
    } else if (e.type === 'tithe') {
      allTimeTithePaid = addDual(allTimeTithePaid, e.amountUSD, e.amountTZS);
    } else if (e.type === 'offering') {
      allTimeOffering = addDual(allTimeOffering, e.amountUSD, e.amountTZS);
    }
  }

  const emergencyReserveNet: DualTotal = {
    usd: Math.round((emergencyFundedTotal.usd - emergencyUsesTotal.usd) * 100) / 100,
    tzs: Math.round(emergencyFundedTotal.tzs - emergencyUsesTotal.tzs),
  };

  const monthSpends = Array.from(spendingByMonth.values());
  const avgMonthlySpendUsd =
    monthSpends.length > 0 ? monthSpends.reduce((a, b) => a + b, 0) / monthSpends.length : 0;
  const emergencyRunwayMonths =
    avgMonthlySpendUsd > 0
      ? Math.max(0, Math.round((emergencyReserveNet.usd / avgMonthlySpendUsd) * 10) / 10)
      : 0;

  const allTimeTitheAccrued: DualTotal = {
    usd: Math.round(allTimeIncome.usd * titheRate * 100) / 100,
    tzs: Math.round(allTimeIncome.tzs * titheRate),
  };

  const allTimeTitheDue: DualTotal = {
    usd: Math.max(0, Math.round((allTimeTitheAccrued.usd - allTimeTithePaid.usd) * 100) / 100),
    tzs: Math.max(0, Math.round(allTimeTitheAccrued.tzs - allTimeTithePaid.tzs)),
  };

  let totalDebtPrincipal = zeroDual();
  let totalDebtPaid = zeroDual();

  for (const d of debts) {
    const principalUsd = d.currency === 'USD' ? d.totalPrincipal : d.totalPrincipal / rate;
    const principalTzs = d.currency === 'TZS' ? d.totalPrincipal : d.totalPrincipal * rate;
    const paidUsd = d.currency === 'USD' ? d.amountPaid : d.amountPaid / rate;
    const paidTzs = d.currency === 'TZS' ? d.amountPaid : d.amountPaid * rate;

    totalDebtPrincipal = addDual(totalDebtPrincipal, principalUsd, principalTzs);
    totalDebtPaid = addDual(totalDebtPaid, paidUsd, paidTzs);
  }

  const totalDebtRemaining: DualTotal = {
    usd: Math.max(0, Math.round((totalDebtPrincipal.usd - totalDebtPaid.usd) * 100) / 100),
    tzs: Math.max(0, Math.round(totalDebtPrincipal.tzs - totalDebtPaid.tzs)),
  };

  const debtPayoffPct =
    totalDebtPrincipal.usd > 0
      ? Math.min(100, Math.round((totalDebtPaid.usd / totalDebtPrincipal.usd) * 1000) / 10)
      : 0;

  return {
    emergencyReserveNet,
    emergencyUsesTotal,
    emergencyFundedTotal,
    emergencyRunwayMonths,
    totalSavingsAllTime,
    totalInvestedAllTime,
    allTimeTitheAccrued,
    allTimeTithePaid,
    allTimeTitheDue,
    allTimeOffering,
    totalDebtRemaining,
    totalDebtPaid,
    totalDebtPrincipal,
    debtPayoffPct,
  };
}

export function exportMonthToCSV(entries: JournalEntry[], monthKey: string): void {
  const rows = entries
    .filter((e) => e.monthKey === monthKey)
    .sort((a, b) => a.date.localeCompare(b.date));

  const headers = [
    'Date',
    'Type',
    'Emergency Action',
    'Title',
    'Category',
    'Counterparty',
    'Account',
    'Native Currency',
    'Native Amount',
    'Exchange Rate (TZS/USD)',
    'USD Equivalent',
    'TZS Equivalent',
    'Notes',
  ];

  const escapeCsv = (val: string | number | undefined) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.date,
        r.type,
        r.emergencyAction || '',
        r.title,
        r.category,
        r.counterparty,
        r.account,
        r.currency,
        r.amount,
        r.exchangeRate,
        r.amountUSD.toFixed(2),
        Math.round(r.amountTZS),
        r.notes,
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pro-business-journal-entries-${monthKey}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportMonthlySummaryToCSV(
  summary: MonthlySummary,
  overall: OverallHealthMetrics,
  preferences: UserPreferences
): void {
  const escapeCsv = (val: string | number | undefined) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const monthLabel = getMonthLabel(summary.monthKey);
  const pctOfIncome = (usd: number) =>
    summary.income.usd > 0
      ? `${(Math.round((usd / summary.income.usd) * 1000) / 10).toFixed(1)}%`
      : '0.0%';

  const rows: (string | number)[][] = [
    ['Journal Name', preferences.businessName, '', '', ''],
    ['Report Period', monthLabel, '', '', ''],
    ['Month Key', summary.monthKey, '', '', ''],
    ['Exchange Rate (TZS per 1 USD)', preferences.exchangeRateTzsPerUsd, '', '', ''],
    ['Tithe Rate (%)', `${preferences.titheRatePercent}%`, '', '', ''],
    ['Entries Recorded', summary.entryCount, '', '', ''],
    ['', '', '', '', ''],
    ['Section', 'Metric', 'USD Amount', 'TZS Amount', 'Percentage / Notes'],
    ['Cash Flow', 'Total Money Gained (Income)', summary.income.usd.toFixed(2), Math.round(summary.income.tzs), '100.0% of gains'],
    ['Cash Flow', 'Total Cash Outflows', summary.totalOutflows.usd.toFixed(2), Math.round(summary.totalOutflows.tzs), pctOfIncome(summary.totalOutflows.usd)],
    ['Cash Flow', 'Net Cash Flow (Surplus / Deficit)', summary.netCashFlow.usd.toFixed(2), Math.round(summary.netCashFlow.tzs), summary.netCashFlow.usd >= 0 ? 'Surplus' : 'Deficit'],
    ['Pillars', 'Operating & Living Spending', summary.spending.usd.toFixed(2), Math.round(summary.spending.tzs), `${summary.spendingRatioPct}% of gains`],
    ['Pillars', 'Savings Allocated', summary.saving.usd.toFixed(2), Math.round(summary.saving.tzs), pctOfIncome(summary.saving.usd)],
    ['Pillars', 'Emergency Reserve Funded', summary.emergencyFunded.usd.toFixed(2), Math.round(summary.emergencyFunded.tzs), pctOfIncome(summary.emergencyFunded.usd)],
    ['Pillars', 'Emergency Uses Drawn', summary.emergencyUsed.usd.toFixed(2), Math.round(summary.emergencyUsed.tzs), pctOfIncome(summary.emergencyUsed.usd)],
    ['Pillars', 'Investments Deployed', summary.investment.usd.toFixed(2), Math.round(summary.investment.tzs), `${summary.investmentRatePct}% of gains`],
    ['Pillars', 'Debt Principal Repaid', summary.debtRepaid.usd.toFixed(2), Math.round(summary.debtRepaid.tzs), pctOfIncome(summary.debtRepaid.usd)],
    ['Stewardship', `Tithe Accrued (${preferences.titheRatePercent}% of Gains)`, summary.titheAccrued.usd.toFixed(2), Math.round(summary.titheAccrued.tzs), `${preferences.titheRatePercent}% mandate`],
    ['Stewardship', 'Tithe Paid This Month', summary.tithePaid.usd.toFixed(2), Math.round(summary.tithePaid.tzs), `${summary.titheCompletionPct}% settled`],
    ['Stewardship', 'Tithe Balance Remaining', summary.titheBalanceDue.usd.toFixed(2), Math.round(summary.titheBalanceDue.tzs), summary.titheBalanceDue.usd <= 0.01 ? 'Settled' : 'Balance Due'],
    ['Stewardship', 'Offering & Charity Given', summary.offering.usd.toFixed(2), Math.round(summary.offering.tzs), `${summary.generosityRatePct}% total generosity rate`],
    ['Health', 'Monthly Savings & Reserve Rate', '', '', `${summary.savingsRatePct}% (20% benchmark)`],
    ['Health', 'Net Emergency Reserve (All-Time)', overall.emergencyReserveNet.usd.toFixed(2), Math.round(overall.emergencyReserveNet.tzs), `${overall.emergencyRunwayMonths} mo runway`],
    ['Health', 'Remaining Debt Balance (All-Time)', overall.totalDebtRemaining.usd.toFixed(2), Math.round(overall.totalDebtRemaining.tzs), `${overall.debtPayoffPct}% repaid`],
  ];

  const csvContent = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pro-business-journal-summary-${summary.monthKey}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function computeMonthlyBudgetReport(
  entries: JournalEntry[],
  budgets: CategoryBudget[],
  monthKey: string,
  exchangeRate = 2650
): MonthlyBudgetReport {
  const rate = exchangeRate > 0 ? exchangeRate : 2650;
  const spendingByCategory = new Map<string, { usd: number; tzs: number; count: number }>();
  let totalActualAllSpending = zeroDual();

  for (const e of entries) {
    if (e.monthKey !== monthKey || e.type !== 'spending') continue;
    totalActualAllSpending = addDual(totalActualAllSpending, e.amountUSD, e.amountTZS);
    const cur = spendingByCategory.get(e.category) || { usd: 0, tzs: 0, count: 0 };
    cur.usd = Math.round((cur.usd + e.amountUSD) * 100) / 100;
    cur.tzs = Math.round(cur.tzs + e.amountTZS);
    cur.count += 1;
    spendingByCategory.set(e.category, cur);
  }

  const budgetedCategories = new Set<string>();
  let totalBudgeted = zeroDual();
  let totalActualCapped = zeroDual();
  let onTrackCount = 0;
  let nearLimitCount = 0;
  let overBudgetCount = 0;

  const rows: BudgetComparisonRow[] = budgets
    .map((budget) => {
      budgetedCategories.add(budget.category.toLowerCase());
      const capConverted = convertToDual(budget.monthlyLimit, budget.currency, rate);
      const capDual: DualTotal = {
        usd: capConverted.amountUSD,
        tzs: capConverted.amountTZS,
      };
      const spent = spendingByCategory.get(budget.category) || { usd: 0, tzs: 0, count: 0 };
      const actualDual: DualTotal = { usd: spent.usd, tzs: spent.tzs };
      const remainingDual: DualTotal = {
        usd: Math.round((capDual.usd - actualDual.usd) * 100) / 100,
        tzs: Math.round(capDual.tzs - actualDual.tzs),
      };
      const utilizationPct =
        capDual.usd > 0 ? Math.round((actualDual.usd / capDual.usd) * 1000) / 10 : 0;

      let status: BudgetStatus = 'on_track';
      if (utilizationPct > 100) {
        status = 'over_budget';
        overBudgetCount += 1;
      } else if (utilizationPct >= budget.alertThresholdPct) {
        status = 'near_limit';
        nearLimitCount += 1;
      } else {
        onTrackCount += 1;
      }

      totalBudgeted = addDual(totalBudgeted, capDual.usd, capDual.tzs);
      totalActualCapped = addDual(totalActualCapped, actualDual.usd, actualDual.tzs);

      return {
        budget,
        capDual,
        actualDual,
        remainingDual,
        utilizationPct,
        status,
        txCount: spent.count,
      };
    })
    .sort((a, b) => b.utilizationPct - a.utilizationPct);

  const uncappedCategories: UncappedSpendingCategory[] = [];
  let totalActualUncapped = zeroDual();

  for (const [category, spent] of spendingByCategory.entries()) {
    if (!budgetedCategories.has(category.toLowerCase())) {
      uncappedCategories.push({
        category,
        actualDual: { usd: spent.usd, tzs: spent.tzs },
        txCount: spent.count,
      });
      totalActualUncapped = addDual(totalActualUncapped, spent.usd, spent.tzs);
    }
  }
  uncappedCategories.sort((a, b) => b.actualDual.usd - a.actualDual.usd);

  const remainingCappedHeadroom: DualTotal = {
    usd: Math.round((totalBudgeted.usd - totalActualCapped.usd) * 100) / 100,
    tzs: Math.round(totalBudgeted.tzs - totalActualCapped.tzs),
  };

  const overallUtilizationPct =
    totalBudgeted.usd > 0
      ? Math.round((totalActualCapped.usd / totalBudgeted.usd) * 1000) / 10
      : 0;

  return {
    monthKey,
    rows,
    uncappedCategories,
    totalBudgeted,
    totalActualAllSpending,
    totalActualCapped,
    totalActualUncapped,
    remainingCappedHeadroom,
    overallUtilizationPct,
    onTrackCount,
    nearLimitCount,
    overBudgetCount,
  };
}

export function exportMonthlyBudgetToCSV(
  report: MonthlyBudgetReport,
  preferences: UserPreferences
): void {
  const escapeCsv = (val: string | number | undefined) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows: (string | number)[][] = [
    ['Journal Name', preferences.businessName, '', '', '', '', '', ''],
    ['Budget Period', getMonthLabel(report.monthKey), '', '', '', '', '', ''],
    ['Exchange Rate (TZS/USD)', preferences.exchangeRateTzsPerUsd, '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    [
      'Category',
      'Cap Currency',
      'Monthly Cap (USD)',
      'Monthly Cap (TZS)',
      'Actual Spent (USD)',
      'Actual Spent (TZS)',
      'Remaining / Over (USD)',
      'Utilization %',
      'Status',
    ],
    ...report.rows.map((r) => [
      r.budget.category,
      r.budget.currency,
      r.capDual.usd.toFixed(2),
      Math.round(r.capDual.tzs),
      r.actualDual.usd.toFixed(2),
      Math.round(r.actualDual.tzs),
      r.remainingDual.usd.toFixed(2),
      `${r.utilizationPct}%`,
      r.status === 'over_budget'
        ? 'Over Budget'
        : r.status === 'near_limit'
        ? 'Near Limit'
        : 'On Track',
    ]),
  ];

  const csvContent = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pro-business-budget-${report.monthKey}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function entryAmountInCurrency(
  entry: JournalEntry,
  targetCurrency: CurrencyCode,
  exchangeRate: number
): number {
  if (entry.currency === targetCurrency) {
    return entry.amount;
  }
  const dual = convertToDual(entry.amount, entry.currency, entry.exchangeRate || exchangeRate);
  return targetCurrency === 'USD' ? dual.amountUSD : dual.amountTZS;
}

function monthSpanCount(monthKeys: string[]): number {
  if (monthKeys.length === 0) return 0;
  const sorted = [...monthKeys].sort();
  const [startY, startM] = sorted[0].split('-').map(Number);
  const [endY, endM] = sorted[sorted.length - 1].split('-').map(Number);
  if (!startY || !startM || !endY || !endM) return new Set(monthKeys).size;
  return Math.max(1, (endY - startY) * 12 + (endM - startM) + 1);
}

function roundForCurrency(value: number, currency: CurrencyCode): number {
  return currency === 'USD' ? Math.round(value * 100) / 100 : Math.round(value);
}

export function computeDebtPaymentHabit(
  entries: JournalEntry[],
  targetCurrency: CurrencyCode,
  exchangeRate = 2650,
  debtId?: string
): DebtPaymentHabit {
  const rate = exchangeRate > 0 ? exchangeRate : 2650;
  const debtEntries = entries.filter((e) => e.type === 'debt');

  const overallMonths: string[] = [];
  let overallTotal = 0;
  for (const e of debtEntries) {
    overallTotal += entryAmountInCurrency(e, targetCurrency, rate);
    if (e.monthKey) overallMonths.push(e.monthKey);
  }
  const overallSpan = monthSpanCount(overallMonths);
  const overallDistinctMonths = new Set(overallMonths).size;
  const overallMonthlyAvgInCurrency =
    overallSpan > 0 ? roundForCurrency(overallTotal / overallSpan, targetCurrency) : 0;

  const specificEntries = debtId ? debtEntries.filter((e) => e.debtId === debtId) : [];
  const specificMonths: string[] = [];
  let specificTotal = 0;
  for (const e of specificEntries) {
    specificTotal += entryAmountInCurrency(e, targetCurrency, rate);
    if (e.monthKey) specificMonths.push(e.monthKey);
  }
  const specificSpan = monthSpanCount(specificMonths);
  const specificDistinctMonths = new Set(specificMonths).size;
  const debtSpecificMonthlyAvgInCurrency =
    specificSpan > 0 ? roundForCurrency(specificTotal / specificSpan, targetCurrency) : 0;

  let recommendedMonthlyPayment = 0;
  let recommendedSource: DebtPaymentHabit['recommendedSource'] = 'none';
  if (specificEntries.length > 0 && debtSpecificMonthlyAvgInCurrency > 0) {
    recommendedMonthlyPayment = debtSpecificMonthlyAvgInCurrency;
    recommendedSource = 'debt_specific';
  } else if (debtEntries.length > 0 && overallMonthlyAvgInCurrency > 0) {
    recommendedMonthlyPayment = overallMonthlyAvgInCurrency;
    recommendedSource = 'overall_journal';
  }

  return {
    overallMonthlyAvgInCurrency,
    overallPaymentCount: debtEntries.length,
    overallActiveMonths: overallDistinctMonths,
    overallTotalPaidInCurrency: roundForCurrency(overallTotal, targetCurrency),
    debtSpecificMonthlyAvgInCurrency,
    debtSpecificPaymentCount: specificEntries.length,
    debtSpecificActiveMonths: specificDistinctMonths,
    debtSpecificTotalPaidInCurrency: roundForCurrency(specificTotal, targetCurrency),
    recommendedMonthlyPayment,
    recommendedSource,
  };
}

function addCalendarMonths(baseDate: Date, monthsToAdd: number): Date {
  const targetYear = baseDate.getUTCFullYear();
  const targetMonth = baseDate.getUTCMonth() + monthsToAdd;
  const day = baseDate.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDayOfTargetMonth)));
}

export function computeProjectedPayoff(params: {
  remainingBalance: number;
  monthlyPayment: number;
  annualInterestRatePct: number;
  currency: CurrencyCode;
  dueDate?: string;
  asOfDate?: Date;
}): PayoffProjection {
  const {
    remainingBalance,
    monthlyPayment,
    annualInterestRatePct,
    currency,
    dueDate,
    asOfDate,
  } = params;

  const cleanRemaining = Math.max(0, remainingBalance);
  const cleanRatePct = Math.max(0, annualInterestRatePct);
  const monthlyRate = cleanRatePct / 100 / 12;
  const firstMonthInterest = roundForCurrency(cleanRemaining * monthlyRate, currency);

  if (cleanRemaining <= 0.005) {
    return {
      status: 'paid_off',
      remainingBalance: 0,
      monthlyPaymentUsed: monthlyPayment,
      annualInterestRatePct: cleanRatePct,
      monthsToPayoff: 0,
      projectedPayoffDate: null,
      projectedPayoffMonthLabel: 'Paid Off',
      estimatedTotalInterest: 0,
      estimatedTotalPayoffCost: 0,
      firstMonthInterest: 0,
      dueDateComparison: 'already_paid',
      monthsDeltaVsDueDate: 0,
    };
  }

  if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) {
    return {
      status: 'no_payment_habit',
      remainingBalance: roundForCurrency(cleanRemaining, currency),
      monthlyPaymentUsed: 0,
      annualInterestRatePct: cleanRatePct,
      monthsToPayoff: null,
      projectedPayoffDate: null,
      projectedPayoffMonthLabel: null,
      estimatedTotalInterest: 0,
      estimatedTotalPayoffCost: roundForCurrency(cleanRemaining, currency),
      firstMonthInterest,
      dueDateComparison: null,
      monthsDeltaVsDueDate: null,
    };
  }

  if (monthlyRate > 0 && monthlyPayment <= cleanRemaining * monthlyRate + 1e-9) {
    return {
      status: 'insufficient_payment',
      remainingBalance: roundForCurrency(cleanRemaining, currency),
      monthlyPaymentUsed: monthlyPayment,
      annualInterestRatePct: cleanRatePct,
      monthsToPayoff: null,
      projectedPayoffDate: null,
      projectedPayoffMonthLabel: null,
      estimatedTotalInterest: 0,
      estimatedTotalPayoffCost: roundForCurrency(cleanRemaining, currency),
      firstMonthInterest,
      dueDateComparison: null,
      monthsDeltaVsDueDate: null,
    };
  }

  let balance = cleanRemaining;
  let months = 0;
  let totalInterest = 0;
  const MAX_MONTHS = 600;

  while (balance > 0.005 && months < MAX_MONTHS) {
    const interest = balance * monthlyRate;
    totalInterest += interest;
    balance = balance + interest - monthlyPayment;
    months += 1;
  }

  if (balance > 0.005) {
    return {
      status: 'beyond_horizon',
      remainingBalance: roundForCurrency(cleanRemaining, currency),
      monthlyPaymentUsed: monthlyPayment,
      annualInterestRatePct: cleanRatePct,
      monthsToPayoff: null,
      projectedPayoffDate: null,
      projectedPayoffMonthLabel: '> 50 yrs',
      estimatedTotalInterest: roundForCurrency(totalInterest, currency),
      estimatedTotalPayoffCost: roundForCurrency(cleanRemaining + totalInterest, currency),
      firstMonthInterest,
      dueDateComparison: 'after',
      monthsDeltaVsDueDate: null,
    };
  }

  const now = asOfDate || new Date();
  const baseUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const payoffDt = addCalendarMonths(baseUtc, months);
  const projectedPayoffDate = payoffDt.toISOString().slice(0, 10);
  const projectedPayoffMonthLabel = payoffDt.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  let dueDateComparison: PayoffProjection['dueDateComparison'] = null;
  let monthsDeltaVsDueDate: number | null = null;
  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const [dy, dm] = dueDate.split('-').map(Number);
    const py = payoffDt.getUTCFullYear();
    const pm = payoffDt.getUTCMonth() + 1;
    const monthDiff = (py - dy) * 12 + (pm - dm);
    monthsDeltaVsDueDate = monthDiff;
    if (projectedPayoffDate <= dueDate || monthDiff <= 0) {
      dueDateComparison = 'on_or_before';
    } else {
      dueDateComparison = 'after';
    }
  }

  return {
    status: 'projected',
    remainingBalance: roundForCurrency(cleanRemaining, currency),
    monthlyPaymentUsed: monthlyPayment,
    annualInterestRatePct: cleanRatePct,
    monthsToPayoff: months,
    projectedPayoffDate,
    projectedPayoffMonthLabel,
    estimatedTotalInterest: roundForCurrency(totalInterest, currency),
    estimatedTotalPayoffCost: roundForCurrency(cleanRemaining + totalInterest, currency),
    firstMonthInterest,
    dueDateComparison,
    monthsDeltaVsDueDate,
  };
}
