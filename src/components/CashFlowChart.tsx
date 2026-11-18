import React, { useState } from 'react';
import { DailyCashFlowPoint } from '../lib/analytics';
import { formatTZS, formatUSD } from '../lib/currency';
import { DisplayCurrencyMode } from '../types/finance';

interface CashFlowChartProps {
  series: DailyCashFlowPoint[];
  displayMode: DisplayCurrencyMode;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ series, displayMode }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const useTzsScale = displayMode === 'TZS';

  const maxMagnitude = Math.max(
    10,
    ...series.map((p) =>
      useTzsScale ? Math.max(p.inflowTZS, p.outflowTZS) : Math.max(p.inflowUSD, p.outflowUSD)
    )
  );

  const width = 820;
  const height = 240;
  const padLeft = 58;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const slotW = series.length > 0 ? plotW / series.length : plotW;
  const barW = Math.max(4, Math.min(11, slotW * 0.34));

  // Cumulative net line bounds
  const cumValues = series.map((p) => (useTzsScale ? p.cumulativeNetTZS : p.cumulativeNetUSD));
  const minCum = Math.min(0, ...cumValues);
  const maxCum = Math.max(10, ...cumValues);
  const cumRange = maxCum - minCum || 1;

  const cumLinePoints = series
    .map((p, idx) => {
      const val = useTzsScale ? p.cumulativeNetTZS : p.cumulativeNetUSD;
      const x = padLeft + idx * slotW + slotW / 2;
      const y = padTop + plotH - ((val - minCum) / cumRange) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const hovered = hoveredIdx !== null ? series[hoveredIdx] : null;

  const formatAxisTick = (val: number) => {
    if (useTzsScale) {
      if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `${Math.round(val / 1_000)}K`;
      return `${Math.round(val)}`;
    }
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
    return `$${Math.round(val)}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
            Daily Inflows (Money Gained)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
            Daily Outflows (Spend, Debt, Uses, Giving)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-0.5 bg-slate-900 dark:bg-slate-100 inline-block" />
            Cumulative Net Trend
          </span>
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300 min-h-[20px]">
          {hovered ? (
            <span>
              Day {hovered.dayNumber} ({hovered.date}) · In:{' '}
              {useTzsScale ? formatTZS(hovered.inflowTZS) : formatUSD(hovered.inflowUSD)} · Out:{' '}
              {useTzsScale ? formatTZS(hovered.outflowTZS) : formatUSD(hovered.outflowUSD)} · Cum:{' '}
              {useTzsScale
                ? formatTZS(hovered.cumulativeNetTZS)
                : formatUSD(hovered.cumulativeNetUSD)}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">
              Hover any day bar to inspect daily cash flow
            </span>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[620px] select-none"
          role="img"
          aria-label="Daily cash flow chart showing inflows, outflows, and cumulative net trend"
        >
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + plotH * (1 - ratio);
            const tickVal = maxMagnitude * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth="1"
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono"
                >
                  {formatAxisTick(tickVal)}
                </text>
              </g>
            );
          })}

          {/* Bars per day */}
          {series.map((p, idx) => {
            const inVal = useTzsScale ? p.inflowTZS : p.inflowUSD;
            const outVal = useTzsScale ? p.outflowTZS : p.outflowUSD;
            const inH = (inVal / maxMagnitude) * plotH;
            const outH = (outVal / maxMagnitude) * plotH;
            const centerX = padLeft + idx * slotW + slotW / 2;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={p.date}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <rect
                  x={padLeft + idx * slotW}
                  y={padTop}
                  width={slotW}
                  height={plotH}
                  className={isHovered ? 'fill-slate-100 dark:fill-slate-800/80' : 'fill-transparent'}
                />
                {inVal > 0 && (
                  <rect
                    x={centerX - barW - 1}
                    y={padTop + plotH - inH}
                    width={barW}
                    height={Math.max(2, inH)}
                    rx="1.5"
                    fill="#059669"
                    opacity={isHovered ? 1 : 0.88}
                  />
                )}
                {outVal > 0 && (
                  <rect
                    x={centerX + 1}
                    y={padTop + plotH - outH}
                    width={barW}
                    height={Math.max(2, outH)}
                    rx="1.5"
                    fill="#E11D48"
                    opacity={isHovered ? 1 : 0.82}
                  />
                )}
                {(p.dayNumber === 1 || p.dayNumber % 5 === 0 || p.dayNumber === series.length) && (
                  <text
                    x={centerX}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                  >
                    {p.dayNumber}
                  </text>
                )}
              </g>
            );
          })}

          {/* Cumulative Net Trend Line */}
          {series.length > 1 && (
            <polyline
              fill="none"
              className="stroke-slate-900 dark:stroke-slate-100 pointer-events-none"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={cumLinePoints}
            />
          )}
        </svg>
      </div>
    </div>
  );
};
