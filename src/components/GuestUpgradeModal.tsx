import React, { useState } from 'react';
import { ArrowRight, Lock, X } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

interface GuestUpgradeModalProps {
  isOpen: boolean;
  actionLabel?: string;
  onClose: () => void;
  onSignedIn: () => void;
}

export const GuestUpgradeModal: React.FC<GuestUpgradeModalProps> = ({
  isOpen,
  actionLabel,
  onClose,
  onSignedIn,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      onSignedIn();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-upgrade-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-200 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="guest-upgrade-title"
                className="font-display text-base font-bold text-slate-900 dark:text-slate-100"
              >
                Open an Account to Edit
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Guest preview is read-only
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {actionLabel
            ? `To ${actionLabel.toLowerCase()}, sign in with your Google account.`
            : 'Sign in with your Google account to create, edit, delete, or save your own business transactions and settings.'}{' '}
          Your personal ledger will be stored privately under your account.
        </p>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-800 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
          >
            Keep Browsing as Guest
          </button>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <span>{loading ? 'Connecting...' : 'Sign In with Google'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
