import { DebtAccount, JournalEntry } from '../types/finance';
import { convertToDual } from './currency';

export interface SampleSeedBundle {
  debts: Omit<DebtAccount, 'userId' | 'createdAt' | 'updatedAt'>[];
  entries: Omit<JournalEntry, 'userId' | 'createdAt' | 'updatedAt'>[];
}

export function buildSampleSeedBundle(
  currentMonthKey: string,
  prevMonthKey: string,
  exchangeRate = 2650
): SampleSeedBundle {
  const debts: SampleSeedBundle['debts'] = [
    {
      id: 'debt_supplier_credit',
      creditor: 'Kariakoo Wholesale Suppliers',
      purpose: 'Q4 Core Inventory Stock Facility',
      currency: 'TZS',
      totalPrincipal: 6000000,
      amountPaid: 4200000,
      exchangeRate,
      dueDate: `${currentMonthKey}-28`,
      status: 'active',
    },
    {
      id: 'debt_equipment_solar',
      creditor: 'EastAfrica Green Finance',
      purpose: 'Solar Backup & Cold Storage Unit',
      currency: 'USD',
      totalPrincipal: 2400,
      amountPaid: 1350,
      exchangeRate,
      dueDate: '2027-02-15',
      status: 'active',
    },
    {
      id: 'debt_pos_terminal',
      creditor: 'CRDB Micro-Equipment Line',
      purpose: 'POS Terminal & Receipt Printers',
      currency: 'TZS',
      totalPrincipal: 1200000,
      amountPaid: 1200000,
      exchangeRate,
      dueDate: `${prevMonthKey}-25`,
      status: 'paid_off',
    },
  ];

  const mkEntry = (
    id: string,
    date: string,
    type: JournalEntry['type'],
    title: string,
    category: string,
    counterparty: string,
    account: string,
    currency: 'USD' | 'TZS',
    amount: number,
    notes: string,
    extra?: { emergencyAction?: 'fund' | 'use'; debtId?: string }
  ): Omit<JournalEntry, 'userId' | 'createdAt' | 'updatedAt'> => {
    const dual = convertToDual(amount, currency, exchangeRate);
    return {
      id,
      date,
      monthKey: date.slice(0, 7),
      type,
      ...(extra?.emergencyAction ? { emergencyAction: extra.emergencyAction } : {}),
      ...(extra?.debtId ? { debtId: extra.debtId } : {}),
      title,
      category,
      counterparty,
      account,
      currency,
      amount,
      exchangeRate,
      amountUSD: dual.amountUSD,
      amountTZS: dual.amountTZS,
      notes,
    };
  };

  const entries: SampleSeedBundle['entries'] = [
    // Previous Month Sample (for MoM comparison & cumulative emergency/tithe)
    mkEntry(
      'sample_prev_01',
      `${prevMonthKey}-04`,
      'income',
      'Export Supply Contract Milestone',
      'Client Sales',
      'Zanzibar Eco Lodge',
      'Bank USD',
      'USD',
      2800,
      'Settled Phase 1 wholesale delivery invoice.'
    ),
    mkEntry(
      'sample_prev_02',
      `${prevMonthKey}-07`,
      'income',
      'Weekly Retail Store Sales',
      'Product Revenue',
      'Walk-in & M-Pesa Customers',
      'M-Pesa Business',
      'TZS',
      3180000,
      'Strong week 1 retail demand.'
    ),
    mkEntry(
      'sample_prev_03',
      `${prevMonthKey}-10`,
      'spending',
      'Shop & Warehouse Monthly Rent',
      'Rent & Utilities',
      'Msasani Property Group',
      'Bank TZS',
      'TZS',
      1450000,
      'Monthly lease and water bill.'
    ),
    mkEntry(
      'sample_prev_04',
      `${prevMonthKey}-14`,
      'emergency',
      'Emergency Reserve Monthly Deposit',
      'Emergency Fund Deposit',
      'Emergency Vault',
      'Bank USD',
      'USD',
      600,
      'Building 3-month business resilience buffer.',
      { emergencyAction: 'fund' }
    ),
    mkEntry(
      'sample_prev_05',
      `${prevMonthKey}-18`,
      'saving',
      'Q4 Tax & Equipment Reserve',
      'Business Reserve',
      'CRDB Savings Account',
      'Bank TZS',
      'TZS',
      950000,
      'Set aside for quarterly VAT and store upgrades.'
    ),
    mkEntry(
      'sample_prev_06',
      `${prevMonthKey}-20`,
      'debt',
      'Final POS Terminal Payoff',
      'Equipment Financing',
      'CRDB Micro-Equipment Line',
      'Bank TZS',
      'TZS',
      400000,
      'Reached 100% paid off milestone on POS hardware.',
      { debtId: 'debt_pos_terminal' }
    ),
    mkEntry(
      'sample_prev_07',
      `${prevMonthKey}-24`,
      'tithe',
      'October 10% Tithe Remittance',
      'Monthly 10% Tithe',
      'Local Fellowship',
      'Bank USD',
      'USD',
      400,
      '10% tithe honored on October business inflows.'
    ),
    mkEntry(
      'sample_prev_08',
      `${prevMonthKey}-26`,
      'offering',
      'Youth Entrepreneurship Scholarship Gift',
      'Community Charity',
      'Dar Community Trust',
      'M-Pesa Business',
      'TZS',
      250000,
      'Freewill offering supporting local vocational students.'
    ),

    // Current Month Sample (Detailed Day-to-Day Journal)
    mkEntry(
      'sample_cur_01',
      `${currentMonthKey}-02`,
      'income',
      'Hospitality Group Wholesale Order',
      'Client Sales',
      'Serengeti Safari Camps',
      'Bank USD',
      'USD',
      1950,
      'Paid upfront via wire transfer.'
    ),
    mkEntry(
      'sample_cur_02',
      `${currentMonthKey}-03`,
      'spending',
      'Wholesale Stock Replenishment',
      'Inventory & Stock',
      'Kariakoo Wholesale Suppliers',
      'M-Pesa Business',
      'TZS',
      1850000,
      'Fast-moving dry goods and packaging restock.'
    ),
    mkEntry(
      'sample_cur_03',
      `${currentMonthKey}-05`,
      'income',
      'Daily Retail & Online Till',
      'Product Revenue',
      'Retail Customers',
      'M-Pesa Business',
      'TZS',
      1620000,
      'High weekend retail turnover.'
    ),
    mkEntry(
      'sample_cur_04',
      `${currentMonthKey}-06`,
      'emergency',
      'Emergency Reserve Top-Up',
      'Emergency Fund Deposit',
      'Emergency Vault',
      'Bank USD',
      'USD',
      450,
      'Allocated 15% of early-month surplus to emergency fund.',
      { emergencyAction: 'fund' }
    ),
    mkEntry(
      'sample_cur_05',
      `${currentMonthKey}-08`,
      'spending',
      'Staff Allowances & Delivery Logistics',
      'Staff & Labor',
      'Operations Team',
      'Cash Till (TZS)',
      'TZS',
      920000,
      'Bi-weekly courier and warehouse assistant pay.'
    ),
    mkEntry(
      'sample_cur_06',
      `${currentMonthKey}-09`,
      'emergency',
      'Cold Storage Compressor Emergency Repair',
      'Equipment Breakdown',
      'Dar Cooling Technicians',
      'M-Pesa Business',
      'TZS',
      480000,
      'Urgent overnight compressor replacement to protect perishable inventory.',
      { emergencyAction: 'use' }
    ),
    mkEntry(
      'sample_cur_07',
      `${currentMonthKey}-11`,
      'income',
      'B2B Consulting & Procurement Retainer',
      'Consulting',
      'Arusha Fresh Co.',
      'Bank USD',
      'USD',
      1100,
      'Monthly supply-chain advisory fee.'
    ),
    mkEntry(
      'sample_cur_08',
      `${currentMonthKey}-12`,
      'investment',
      'UTT AMIS Liquid Fund Contribution',
      'UTT AMIS / Funds',
      'UTT AMIS Tanzania',
      'Bank TZS',
      'TZS',
      1100000,
      'Compounding liquid unit trust allocation.'
    ),
    mkEntry(
      'sample_cur_09',
      `${currentMonthKey}-13`,
      'debt',
      'Supplier Credit Installment #3',
      'Supplier Credit',
      'Kariakoo Wholesale Suppliers',
      'Bank TZS',
      'TZS',
      900000,
      'Crossed 70% repayment milestone ahead of schedule.',
      { debtId: 'debt_supplier_credit' }
    ),
    mkEntry(
      'sample_cur_10',
      `${currentMonthKey}-14`,
      'saving',
      'Business Expansion Sinking Fund',
      'Business Reserve',
      'Reserve Account',
      'Bank USD',
      'USD',
      350,
      'Saved toward second retail kiosk deposit.'
    ),
    mkEntry(
      'sample_cur_11',
      `${currentMonthKey}-15`,
      'income',
      'Mid-Month Retail & M-Pesa Sales',
      'Product Revenue',
      'Retail Customers',
      'M-Pesa Business',
      'TZS',
      2140000,
      'Mid-month restock sell-through.'
    ),
    mkEntry(
      'sample_cur_12',
      `${currentMonthKey}-16`,
      'debt',
      'Solar Backup Unit Monthly Installment',
      'Equipment Financing',
      'EastAfrica Green Finance',
      'Bank USD',
      'USD',
      250,
      'Passed 50% principal payoff milestone.',
      { debtId: 'debt_equipment_solar' }
    ),
    mkEntry(
      'sample_cur_13',
      `${currentMonthKey}-17`,
      'tithe',
      'Mid-Month 10% Tithe Transfer',
      'Monthly 10% Tithe',
      'Local Fellowship',
      'Bank USD',
      'USD',
      320,
      'Partial tithe remitted on November gains; balance tracked automatically.'
    ),
    mkEntry(
      'sample_cur_14',
      `${currentMonthKey}-18`,
      'offering',
      'Thanksgiving & Orphanage Support Offering',
      'Community Charity',
      'Msimbazi Children Home',
      'M-Pesa Business',
      'TZS',
      310000,
      'Freewill offering and food staples donation.'
    ),
  ];

  return { debts, entries };
}
