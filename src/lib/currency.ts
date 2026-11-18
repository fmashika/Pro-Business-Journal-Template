import { CurrencyCode, DisplayCurrencyMode } from '../types/finance';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdCompactFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const tzsFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

export function formatUSD(amount: number, compact = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  if (compact && Math.abs(safe) >= 1000) {
    return usdCompactFormatter.format(safe);
  }
  return usdFormatter.format(safe);
}

export function formatTZS(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const sign = safe < 0 ? '-' : '';
  return `${sign}TZS ${tzsFormatter.format(Math.abs(safe))}`;
}

export function convertToDual(
  amount: number,
  currency: CurrencyCode,
  exchangeRateTzsPerUsd: number
): { amountUSD: number; amountTZS: number } {
  const rate = exchangeRateTzsPerUsd > 0 ? exchangeRateTzsPerUsd : 2650;
  if (currency === 'USD') {
    const amountUSD = Math.round(amount * 100) / 100;
    const amountTZS = Math.round(amount * rate);
    return { amountUSD, amountTZS };
  }
  const amountTZS = Math.round(amount);
  const amountUSD = Math.round((amount / rate) * 100) / 100;
  return { amountUSD, amountTZS };
}

export function formatByMode(
  amountUSD: number,
  amountTZS: number,
  mode: DisplayCurrencyMode
): { primary: string; secondary?: string } {
  if (mode === 'USD') {
    return { primary: formatUSD(amountUSD) };
  }
  if (mode === 'TZS') {
    return { primary: formatTZS(amountTZS) };
  }
  return {
    primary: formatUSD(amountUSD),
    secondary: formatTZS(amountTZS),
  };
}

export function formatNativeCurrency(amount: number, currency: CurrencyCode): string {
  return currency === 'USD' ? formatUSD(amount) : formatTZS(amount);
}
