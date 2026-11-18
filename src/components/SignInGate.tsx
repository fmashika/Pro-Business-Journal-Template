import React, { useState } from 'react';
import { ArrowRight, BookOpen, ShieldCheck, TrendingUp, Wallet } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

export const SignInGate: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in could not be completed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Pro Business Journal Template
          </span>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <span className="whitespace-nowrap shrink-0">USD &amp; TZS Accounting</span>
            <span className="whitespace-nowrap shrink-0">Cash Flow Analytics</span>
            <span className="whitespace-nowrap shrink-0">10% Tithe &amp; Stewardship</span>
          </div>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
          >
            {loading ? 'Connecting...' : 'Sign In'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <p className="text-xs font-medium text-emerald-700 tracking-wide">
            Day-to-Day Business &amp; Stewardship Journal
          </p>
          <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
            Clarity across every shilling, dollar, and stewardship commitment.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-xl">
            Record daily business transactions in both USD and TZS, reveal cash flow patterns through
            detailed monthly summaries, track emergency fund uses, reach debt payoff milestones, and
            automatically calculate your 10% tithe and freewill offerings.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleSignIn}
              disabled={loading}
              className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{loading ? 'Signing in with Google...' : 'Continue with Google'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500">
              Private, encrypted per-account cloud ledger
            </span>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">
              {error}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
          <div className="p-6 flex items-start gap-4">
            <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Dual-Currency Daily Journal (USD &amp; TZS)
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Log income, operating spending, savings, and accounts in USD or TZS with instant
                equivalent conversion.
              </p>
            </div>
          </div>

          <div className="p-6 flex items-start gap-4">
            <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Monthly Summaries &amp; Cash Flow Patterns
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Inspect daily inflow vs outflow curves, day-of-week velocity, savings rates, and
                emergency runway.
              </p>
            </div>
          </div>

          <div className="p-6 flex items-start gap-4">
            <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                10% Tithe &amp; Offering Accountability
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Automatically calculates 10% of total money gained and separates tithe fulfillment
                from offerings and charity.
              </p>
            </div>
          </div>

          <div className="p-6 flex items-start gap-4">
            <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Emergency Uses, Investments &amp; Debt Milestones
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Track every emergency drawdown separately from savings while hitting 25%, 50%, 75%,
                and 100% debt payoff milestones.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
