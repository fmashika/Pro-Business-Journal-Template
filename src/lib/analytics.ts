import { DebtAccount, JournalEntry, UserPreferences } from '../types/finance';

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
