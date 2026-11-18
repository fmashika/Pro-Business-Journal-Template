import React from 'react';
import { DisplayCurrencyMode } from '../types/finance';
import { formatByMode } from '../lib/currency';

interface DualAmountProps {
  usd: number;
  tzs: number;
  mode: DisplayCurrencyMode;
  prefix?: string;
  className?: string;
  secondaryClassName?: string;
  align?: 'left' | 'right';
}

export const DualAmount: React.FC<DualAmountProps> = ({
  usd,
  tzs,
  mode,
  prefix = '',
  className = 'text-slate-900 font-semibold',
  secondaryClassName = 'text-xs text-slate-500',
  align = 'left',
}) => {
  const formatted = formatByMode(usd, tzs, mode);
  return (
    <div className={`font-mono tabular-nums ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div className={className}>
        {prefix}
        {formatted.primary}
      </div>
      {formatted.secondary && (
        <div className={`${secondaryClassName} mt-0.5`}>
          {prefix}
          {formatted.secondary}
        </div>
      )}
    </div>
  );
};
