import { useState } from 'react';
import type { ChartBar } from '../../domain/stats';
import type { PaletteName } from '../../domain/types';
import { useWidth } from '../../hooks/useWidth';

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Single-series bar chart of completion rates (0..1). One hue (the habit's colour),
 * thin bars with 4px rounded tops anchored to the baseline, recessive grid, a hover
 * tooltip per bar, and an optional table view of the same numbers.
 */
export function BarChart({
  title,
  bars,
  palette,
  showTable = false,
  height = 150,
}: {
  title: string;
  bars: ChartBar[];
  palette: PaletteName;
  showTable?: boolean;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const axisW = 34;
  const bottomH = 20;
  const topPad = 8;
  const plotW = Math.max(width - axisW, 50);
  const plotH = height - bottomH - topPad;
  const slot = plotW / bars.length;
  const barW = Math.max(4, Math.min(24, slot * 0.55));
  const y = (v: number) => topPad + plotH * (1 - v);

  const withData = bars.filter((b) => b.value !== null);
  const best = withData.reduce<ChartBar | null>(
    (a, b) => (!a || b.value! > a.value! ? b : a),
    null,
  );
  const summary = best
    ? `${title}. Highest: ${best.label}, ${pct(best.value!)}.`
    : `${title}. No data yet.`;

  const hovered = hover === null ? null : bars[hover]!;

  return (
    <figure className={`palette-${palette} min-w-0`}>
      <figcaption className="mb-2 text-sm font-semibold">{title}</figcaption>
      <div ref={ref} className="relative">
        <svg width={width} height={height} role="img" aria-label={summary} className="block">
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line
                x1={axisW}
                x2={width}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? 'var(--muted)' : 'var(--border)'}
                strokeOpacity={t === 0 ? 0.6 : 1}
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : '2 3'}
              />
              <text x={axisW - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--muted)">
                {pct(t)}
              </text>
            </g>
          ))}
          {bars.map((b, i) => {
            const cx = axisW + slot * i + slot / 2;
            const v = b.value ?? 0;
            const h = plotH * Math.min(v, 1);
            const r = Math.min(4, barW / 2, h);
            const x0 = cx - barW / 2;
            const yTop = topPad + plotH - h;
            const base = topPad + plotH;
            return (
              <g key={b.key}>
                {h > 0 && (
                  <path
                    d={`M${x0},${base} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${base} Z`}
                    fill="var(--heat-3)"
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                )}
                <text
                  x={cx}
                  y={height - 5}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--muted)"
                  opacity={b.value === null ? 0.5 : 1}
                >
                  {b.label}
                </text>
                {/* Hit target: the whole column, larger than the bar. */}
                <rect
                  x={axisW + slot * i}
                  y={topPad}
                  width={slot}
                  height={plotH + bottomH}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => setHover(hover === i ? null : i)}
                />
              </g>
            );
          })}
        </svg>
        {hovered && hover !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-fg px-2 py-1 text-xs whitespace-nowrap text-bg shadow-lg"
            style={{
              left: Math.min(Math.max(axisW + slot * hover + slot / 2, 50), width - 50),
              top: y(Math.min(hovered.value ?? 0, 1)) - 6,
            }}
          >
            {hovered.label}: {hovered.value === null ? 'nothing due' : pct(hovered.value)}
          </div>
        )}
      </div>
      {showTable && (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-medium">
                {title.startsWith('By weekday') ? 'Day' : 'Month'}
              </th>
              <th className="py-1 text-right font-medium">Completion</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.key} className="border-t border-line">
                <td className="py-1">{b.label}</td>
                <td className="py-1 text-right tabular-nums">
                  {b.value === null ? '–' : pct(b.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}
