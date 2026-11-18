/**
 * Payload-First Security Test Cases for Amani Ledger Firestore Rules
 * Documents verification expectations for the Dirty Dozen adversarial payloads.
 */

export interface SecurityTestCase {
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED' | 'ALLOWED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: SecurityTestCase[] = [
  {
    name: '01. Shadow Field Injection on JournalEntry',
    path: '/users/user123/entries/entry1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      id: 'entry1',
      userId: 'user123',
      date: '2026-11-18',
      monthKey: '2026-11',
      type: 'income',
      title: 'Client Retainer',
      category: 'Consulting',
      counterparty: 'Acme TZ',
      account: 'Bank USD',
      currency: 'USD',
      amount: 1000,
      exchangeRate: 2650,
      amountUSD: 1000,
      amountTZS: 2650000,
      notes: '',
      isAdmin: true,
    },
  },
  {
    name: '02. Identity Spoofing across userId',
    path: '/users/victim999/entries/entry2',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '03. Unverified Email Write',
    path: '/users/user123/entries/entry3',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '04. Path Variable ID Poisoning',
    path: '/users/user123/entries/invalid$id!space',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '05. Client Timestamp Forgery',
    path: '/users/user123/entries/entry5',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '06. Immutable createdAt Tampering on Update',
    path: '/users/user123/entries/entry1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '07. Negative Amount Poisoning',
    path: '/users/user123/entries/entry7',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '08. Orphaned Debt Reference',
    path: '/users/user123/entries/entry8',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '09. Terminal Debt State Tampering (already paid_off)',
    path: '/users/user123/debts/debt_paid',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. String Length Exhaustion (notes > 500 chars)',
    path: '/users/user123/entries/entry10',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Invalid Enum Value',
    path: '/users/user123/entries/entry11',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Unauthorized Collection List',
    path: '/users/victim999/entries',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
];
