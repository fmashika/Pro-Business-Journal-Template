import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMessage = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        displayMessage = `${parsed.error} (${parsed.operationType || 'operation'} on ${parsed.path || 'database'})`;
      }
    } catch {
      // Not a JSON-encoded FirestoreErrorInfo
    }
    return { hasError: true, message: displayMessage };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8">
            <div className="flex items-center gap-3 text-rose-700 dark:text-rose-400 mb-4">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Unable to Complete Ledger Action
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-emerald-700 rounded-lg hover:bg-slate-800 dark:hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Journal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
