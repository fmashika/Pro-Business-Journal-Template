import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_ENTRY_TYPES = [
  'income',
  'spending',
  'saving',
  'emergency',
  'investment',
  'debt',
  'tithe',
  'offering',
] as const;

type ParsedEntryType = (typeof ALLOWED_ENTRY_TYPES)[number];

const DEFAULT_ACCOUNTS = [
  'Bank USD',
  'Bank TZS',
  'M-Pesa Business',
  'Tigo Pesa / Airtel',
  'Cash Till (TZS)',
  'Cash Vault (USD)',
];

const DEFAULT_CATEGORIES: Record<ParsedEntryType, string[]> = {
  income: [
    'Client Sales',
    'Product Revenue',
    'Consulting',
    'Commission',
    'Trading Profit / Gain',
    'Dividend / Yield',
    'Other Gain',
  ],
  spending: [
    'Inventory & Stock',
    'Rent & Utilities',
    'Transport & Fuel',
    'Staff & Labor',
    'Marketing',
    'Supplies & Ops',
    'Broker & Exchange Fees',
    'Trading Loss / Drawdown',
    'Living & Meals',
  ],
  saving: [
    'Business Reserve',
    'Tax Reserve',
    'Equipment Sinking Fund',
    'Personal Savings',
  ],
  emergency: [
    'Emergency Fund Deposit',
    'Equipment Breakdown',
    'Medical Emergency',
    'Urgent Repair',
    'Supply Disruption',
  ],
  investment: [
    'Crypto Trading',
    'Stock Market / Equities',
    'Forex Trading',
    'Commodities & Metals',
    'Indices & ETFs',
    'Options & Derivatives',
    'Futures & CFDs',
    'Bonds & Treasury Bills',
    'UTT AMIS / Mutual Funds',
    'Money Market & REITs',
    'Business Expansion',
    'Real Estate',
  ],
  debt: [
    'Supplier Credit',
    'Business Loan',
    'Equipment Financing',
    'Line of Credit',
    'Personal Debt',
  ],
  tithe: ['Monthly 10% Tithe', 'Tithe Settlement', 'Firstfruits Tithe'],
  offering: [
    'Weekly Offering',
    'Community Charity',
    'Thanksgiving Offering',
    'Education / Aid Donation',
  ],
};

interface DebtHint {
  id: string;
  creditor: string;
  purpose: string;
  currency: 'USD' | 'TZS';
}

interface RawParsedItem {
  date?: string;
  hasExplicitDate?: boolean;
  hasExplicitAmount?: boolean;
  hasExplicitPurpose?: boolean;
  type?: string;
  emergencyAction?: string;
  title?: string;
  category?: string;
  counterparty?: string;
  account?: string;
  currency?: string;
  amount?: number;
  debtId?: string;
  notes?: string;
  sourceExcerpt?: string;
}

interface RawParsedResponse {
  detectedLanguage?: string;
  summaryNote?: string;
  missingInfoWarnings?: string[];
  entries?: RawParsedItem[];
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isValidIsoDate(val: unknown): val is string {
  if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d
  );
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const retryable = status === 429 || (typeof status === 'number' && status >= 500);
      if (!retryable || attempt === maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/api/journal/parse-story', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error:
        'Gemini API key is not configured on the server. Please configure GEMINI_API_KEY in Settings > Secrets.',
    });
    return;
  }

  const body = req.body as {
    story?: unknown;
    defaultMonthKey?: unknown;
    todayDate?: unknown;
    defaultCurrency?: unknown;
    debts?: unknown;
  };

  const story = typeof body.story === 'string' ? body.story.trim() : '';
  if (!story) {
    res.status(400).json({ error: 'Please write or paste your journal story first.' });
    return;
  }
  if (story.length > 6000) {
    res.status(400).json({
      error: 'Story is too long (maximum 6,000 characters per batch). Please split it into two parts.',
    });
    return;
  }

  const todayDate = isValidIsoDate(body.todayDate)
    ? body.todayDate
    : new Date().toISOString().slice(0, 10);
  const defaultMonthKey =
    typeof body.defaultMonthKey === 'string' && /^\d{4}-\d{2}$/.test(body.defaultMonthKey)
      ? body.defaultMonthKey
      : todayDate.slice(0, 7);
  const defaultYear = defaultMonthKey.slice(0, 4);
  const defaultCurrency: 'USD' | 'TZS' =
    body.defaultCurrency === 'USD' ? 'USD' : 'TZS';

  const debts: DebtHint[] = Array.isArray(body.debts)
    ? body.debts
        .filter((d): d is DebtHint => Boolean(d && typeof d === 'object'))
        .slice(0, 20)
        .map((d) => ({
          id: String(d.id || '').slice(0, 128),
          creditor: String(d.creditor || '').slice(0, 120),
          purpose: String(d.purpose || '').slice(0, 140),
          currency: d.currency === 'USD' ? 'USD' : 'TZS',
        }))
    : [];

  const systemInstruction = `You are a bilingual (any language: English, Swahili, Sheng, etc.) financial bookkeeper and journal translator for a dual-currency (USD & TZS) business and stewardship ledger.

Your job is to read a user's narrative story describing their financial activities and break it down into discrete, accurate journal transactions.

RULES:
1. Understand ANY language or casual phrasing the user writes (English, Swahili, mixed Swahili-English, abbreviations like "Tsh", "sh", "elfu", "k", "USD", "$", "Bundles", "Emergence", etc.).
2. A single sentence or paragraph often contains MULTIPLE transactions on the same date or across dates. Split EVERY distinct monetary activity into its own entry.
   - Example: "in October 15 given a job of website building which salary is 180,000 TZS, Tithe 18,000 TZS" -> TWO entries on ${defaultYear}-10-15: (1) income 180,000 TZS "Website Building Job Salary", (2) tithe 18,000 TZS "Tithe on Website Job".
   - Example: "in October 20 I invested to forex trading, total investment 25,000 TZS, Saving 10,000 TZS, Emergence 10,000 TZS, uses Bundles 10,000 TZS" -> FOUR entries on ${defaultYear}-10-20: investment 25,000 TZS (category "Forex Trading"), saving 10,000 TZS, emergency (fund) 10,000 TZS, spending 10,000 TZS ("Internet / Data Bundles").
   - Example: "October 25 Helping friend 20,000 TZS" -> offering 20,000 TZS ("Helping Friend", category "Community Charity").
   - Example: "October 29 25,000 Cooking Gas exchange" -> spending 25,000 TZS ("Cooking Gas Exchange", category "Living & Meals").
3. Date Resolution:
   - Reference default year: ${defaultYear}, active month: ${defaultMonthKey}, today's date: ${todayDate}.
   - If a month and day are stated without a year (e.g. "October 15", "Oct 20", "tarehe 5 Oktoba"), use year ${defaultYear} unless context clearly indicates otherwise.
   - Subsequent items in the same clause/sentence inherit the most recently stated date until a new date appears, and still count as having a resolved date (hasExplicitDate = true if inherited from the clause's date or explicitly stated; false ONLY if the entire story has no date for that item, in which case default to ${todayDate}).
4. Pillar Classification (type):
   - "income": salary, job paid, sales, client payment, revenue, profit, dividend, money received/gained.
   - "spending": operating expenses, bundles/airtime/internet, gas, food, transport, rent, utilities, stock/inventory, fees, general uses/purchases.
   - "saving": cash set aside into savings/reserve.
   - "emergency": emergency fund deposits (emergencyAction = "fund") OR urgent emergency withdrawals/repairs/medical uses (emergencyAction = "use"). If the user simply writes "Emergence 10,000" alongside Saving/Investment, treat it as emergencyAction = "fund"; if it describes an urgent breakdown, hospital, or emergency spend, treat it as emergencyAction = "use".
   - "investment": stocks, crypto, forex trading, commodities, ETFs, UTT AMIS, mutual funds, bonds, business expansion, real estate.
   - "debt": loan or credit repayment. If the creditor matches one of the user's tracked debt accounts, set debtId to its id.
   - "tithe": 10% tithe / zaka / sadaka ya fungu la kumi.
   - "offering": offerings, charity, helping a friend/family in need, donations, gifts, sadaka.
5. Currency & Amount:
   - Detect USD ($, USD, dollars) vs TZS (TZS, Tsh, sh, or default ${defaultCurrency} when unspecified).
   - Convert shorthand like "25k" to 25000, "180,000" to 180000.
   - If an item mentions an activity/purpose without an amount, set amount = 0, hasExplicitAmount = false, and add a clear warning in missingInfoWarnings asking the user for the price/amount.
   - If an item has an amount without a clear purpose, set hasExplicitPurpose = false and add a warning in missingInfoWarnings.
   - If no date could be determined anywhere for an item, set hasExplicitDate = false and add a warning in missingInfoWarnings.
6. Categories & Accounts:
   - Choose the closest matching category from these lists: ${JSON.stringify(DEFAULT_CATEGORIES)}.
   - Choose the best account from: ${JSON.stringify(DEFAULT_ACCOUNTS)} (defaulting to "M-Pesa Business" or "Cash Till (TZS)" for TZS, and "Bank USD" for USD unless stated otherwise).
   - Keep title concise and clear in English (preserving key specific nouns like "Cooking Gas Exchange", "Website Building Job", "Bundles").`;

  const userPrompt = `Active Debt Accounts (for optional debtId matching): ${JSON.stringify(debts)}

User's Journal Story:
"""
${story}
"""`;

  try {
    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedLanguage: {
                type: Type.STRING,
                description: 'Detected language(s) of the story, e.g. English, Swahili, or Mixed.',
              },
              summaryNote: {
                type: Type.STRING,
                description: 'One-sentence summary of the extracted journal activities.',
              },
              missingInfoWarnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'Warnings for any transaction in the story missing a date, price/amount, or purpose.',
              },
              entries: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING, description: 'YYYY-MM-DD format.' },
                    hasExplicitDate: { type: Type.BOOLEAN },
                    hasExplicitAmount: { type: Type.BOOLEAN },
                    hasExplicitPurpose: { type: Type.BOOLEAN },
                    type: {
                      type: Type.STRING,
                      enum: [...ALLOWED_ENTRY_TYPES],
                    },
                    emergencyAction: {
                      type: Type.STRING,
                      enum: ['fund', 'use'],
                    },
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    counterparty: { type: Type.STRING },
                    account: { type: Type.STRING },
                    currency: { type: Type.STRING, enum: ['USD', 'TZS'] },
                    amount: { type: Type.NUMBER },
                    debtId: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    sourceExcerpt: { type: Type.STRING },
                  },
                  required: [
                    'date',
                    'hasExplicitDate',
                    'hasExplicitAmount',
                    'hasExplicitPurpose',
                    'type',
                    'title',
                    'category',
                    'account',
                    'currency',
                    'amount',
                    'sourceExcerpt',
                  ],
                },
              },
            },
            required: ['detectedLanguage', 'summaryNote', 'missingInfoWarnings', 'entries'],
          },
        },
      })
    );

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText) as RawParsedResponse;
    const validDebtIds = new Set(debts.map((d) => d.id));

    const normalizedEntries = (Array.isArray(parsed.entries) ? parsed.entries : []).map(
      (item) => {
        const type: ParsedEntryType = ALLOWED_ENTRY_TYPES.includes(
          item.type as ParsedEntryType
        )
          ? (item.type as ParsedEntryType)
          : 'spending';

        const currency: 'USD' | 'TZS' = item.currency === 'USD' ? 'USD' : 'TZS';
        const date = isValidIsoDate(item.date) ? item.date : todayDate;
        const allowedCats = DEFAULT_CATEGORIES[type];
        const rawCat = String(item.category || '').trim().slice(0, 60);
        const category = rawCat || allowedCats[0];
        const rawAccount = String(item.account || '').trim().slice(0, 60);
        const account = DEFAULT_ACCOUNTS.includes(rawAccount)
          ? rawAccount
          : currency === 'USD'
          ? 'Bank USD'
          : 'M-Pesa Business';
        const rawAmount = Number(item.amount);
        const amount =
          Number.isFinite(rawAmount) && rawAmount > 0
            ? currency === 'USD'
              ? Math.round(rawAmount * 100) / 100
              : Math.round(rawAmount)
            : 0;
        const emergencyAction: 'fund' | 'use' | undefined =
          type === 'emergency'
            ? item.emergencyAction === 'use'
              ? 'use'
              : 'fund'
            : undefined;
        const debtId =
          type === 'debt' && item.debtId && validDebtIds.has(item.debtId)
            ? item.debtId
            : undefined;

        return {
          date,
          hasExplicitDate: Boolean(item.hasExplicitDate) && isValidIsoDate(item.date),
          hasExplicitAmount: Boolean(item.hasExplicitAmount) && amount > 0,
          hasExplicitPurpose:
            Boolean(item.hasExplicitPurpose) && Boolean(String(item.title || '').trim()),
          type,
          ...(emergencyAction ? { emergencyAction } : {}),
          title: (String(item.title || '').trim() || category).slice(0, 140),
          category,
          counterparty: String(item.counterparty || '').trim().slice(0, 100),
          account,
          currency,
          amount,
          ...(debtId ? { debtId } : {}),
          notes: String(item.notes || '').trim().slice(0, 500),
          sourceExcerpt: String(item.sourceExcerpt || '').trim().slice(0, 140),
        };
      }
    );

    res.json({
      detectedLanguage: String(parsed.detectedLanguage || 'Detected'),
      summaryNote: String(parsed.summaryNote || ''),
      missingInfoWarnings: Array.isArray(parsed.missingInfoWarnings)
        ? parsed.missingInfoWarnings.map((w) => String(w)).filter(Boolean)
        : [],
      entries: normalizedEntries,
    });
  } catch (err) {
    console.error('Story parse error:', err);
    const status = (err as { status?: number })?.status;
    if (status === 400 || status === 403) {
      res.status(status).json({
        error:
          'Unable to authenticate with Gemini API. Please check GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }
    if (status === 429) {
      res.status(429).json({
        error: 'Gemini API rate limit reached. Please wait a moment and try again.',
      });
      return;
    }
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Failed to translate your story into journal entries.',
    });
  }
});

async function startServer() {
  const port = Number(process.env.PORT || 3000);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
