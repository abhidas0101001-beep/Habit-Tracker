import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { addDaysKey, formatLong, type DateKey } from '../../domain/dates';
import { buildGrid } from '../../domain/grid';
import { level } from '../../domain/levels';
import type { PaletteName, WeekStart } from '../../domain/types';

export interface HeatmapProps {
  /** date → completion ratio (0..1). Missing dates count as 0. */
  data: Map<DateKey, number>;
  endDate: DateKey;
  weeks?: number;
  /** Days before this date are not drawn (e.g. Jan 1 when showing a calendar year). */
  startDate?: DateKey;
  weekStart: WeekStart;
  palette: PaletteName;
  /** Unscheduled days get a faded "rest day" style so they don't look like misses. */
  isScheduled?: (date: DateKey) => boolean;
  onCellClick?: (date: DateKey) => void;
  /** Text for tooltips and screen readers. */
  describe?: (date: DateKey, ratio: number) => string;
  showLabels?: boolean;
  label: string;
  maxCell?: number;
}

const MIN_CELL = 10;
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function defaultDescribe(date: DateKey, ratio: number): string {
  return `${formatLong(date)}: ${ratio >= 1 ? 'done' : ratio > 0 ? `${Math.round(ratio * 100)}%` : 'not done'}`;
}

export function Heatmap({
  data,
  endDate,
  weeks = 53,
  startDate,
  weekStart,
  palette,
  isScheduled,
  onCellClick,
  describe = defaultDescribe,
  showLabels = true,
  label,
  maxCell = 14,
}: HeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);
  const [focused, setFocused] = useState<DateKey>(endDate);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  const grid = useMemo(() => buildGrid(endDate, weeks, weekStart), [endDate, weeks, weekStart]);

  // Size cells to the container; below MIN_CELL the grid scrolls horizontally instead.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const labelW = showLabels ? 30 : 0;
  const topH = showLabels ? 16 : 0;
  const gap = 3;
  const available = width || 720;
  const cell = Math.max(
    MIN_CELL,
    Math.min(maxCell, Math.floor((available - labelW) / weeks) - gap),
  );
  const step = cell + gap;
  const svgW = labelW + weeks * step - gap;
  const svgH = topH + 7 * step - gap;

  // Keep the most recent week (today) in view on narrow screens.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [svgW, endDate]);

  const visible = useCallback(
    (date: DateKey) => date <= endDate && (!startDate || date >= startDate),
    [endDate, startDate],
  );

  // Keep the roving focus target inside the visible range.
  const focusTarget = visible(focused) ? focused : endDate;

  const moveFocus = (date: DateKey) => {
    if (!visible(date)) return;
    const first = grid.columns[0]![0]!.date;
    if (date < first) return;
    setFocused(date);
    svgRef.current?.querySelector<SVGRectElement>(`[data-date="${date}"]`)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<SVGRectElement>, date: DateKey) => {
    const moves: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -7,
      ArrowRight: 7,
    };
    if (e.key in moves) {
      e.preventDefault();
      moveFocus(addDaysKey(date, moves[e.key]!));
    } else if (e.key === 'Home') {
      e.preventDefault();
      const first = grid.columns.flat().find((d) => visible(d.date));
      if (first) moveFocus(first.date);
    } else if (e.key === 'End') {
      e.preventDefault();
      moveFocus(endDate);
    } else if ((e.key === 'Enter' || e.key === ' ') && onCellClick) {
      e.preventDefault();
      onCellClick(date);
    }
  };

  const showTip = (target: Element, text: string) => {
    const r = target.getBoundingClientRect();
    setTip({ text, x: r.left + r.width / 2, y: r.top });
  };

  return (
    <div className={`palette-${palette} relative`}>
      <div ref={scrollRef} className="overflow-x-auto overscroll-x-contain pb-1">
        <svg
          ref={svgRef}
          width={svgW}
          height={svgH}
          role="group"
          aria-label={label}
          className="block select-none"
        >
          {showLabels &&
            grid.monthLabels
              // Skip a trailing label that would be clipped at the right edge.
              .filter((m) => labelW + m.column * step + 22 <= svgW)
              .map((m) => (
                <text
                  key={`${m.column}-${m.label}`}
                  x={labelW + m.column * step}
                  y={10}
                  fontSize={10}
                  fill="var(--muted)"
                  aria-hidden
                >
                  {m.label}
                </text>
              ))}
          {showLabels &&
            Array.from({ length: 7 }, (_, row) => {
              const wd = (weekStart + row) % 7;
              if (wd !== 1 && wd !== 3 && wd !== 5) return null;
              return (
                <text
                  key={row}
                  x={0}
                  y={topH + row * step + cell - 1}
                  fontSize={10}
                  fill="var(--muted)"
                  aria-hidden
                >
                  {WEEKDAY_NAMES[wd]}
                </text>
              );
            })}
          {grid.columns.map((column, w) =>
            column.map((day, row) => {
              if (!visible(day.date)) return null;
              const ratio = data.get(day.date) ?? 0;
              const lvl = level(ratio);
              const rest = isScheduled ? !isScheduled(day.date) : false;
              const text = describe(day.date, ratio) + (rest && lvl === 0 ? ' (rest day)' : '');
              return (
                <rect
                  key={day.date}
                  data-date={day.date}
                  data-level={lvl}
                  className="heat-cell"
                  x={labelW + w * step}
                  y={topH + row * step}
                  width={cell}
                  height={cell}
                  rx={2}
                  fill={`var(--heat-${lvl})`}
                  opacity={rest && lvl === 0 ? 0.4 : 1}
                  stroke={day.date === endDate ? 'var(--muted)' : undefined}
                  strokeWidth={day.date === endDate ? 1 : undefined}
                  role={onCellClick ? 'button' : 'img'}
                  aria-label={text}
                  tabIndex={day.date === focusTarget ? 0 : -1}
                  style={{ cursor: onCellClick ? 'pointer' : undefined }}
                  onClick={() => onCellClick?.(day.date)}
                  onKeyDown={(e) => onKeyDown(e, day.date)}
                  onFocus={(e) => {
                    setFocused(day.date);
                    showTip(e.currentTarget, text);
                  }}
                  onBlur={() => setTip(null)}
                  onPointerEnter={(e) =>
                    e.pointerType === 'mouse' && showTip(e.currentTarget, text)
                  }
                  onPointerLeave={() => setTip(null)}
                />
              );
            }),
          )}
        </svg>
      </div>
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-fg px-2 py-1 text-xs whitespace-nowrap text-bg shadow-lg"
          style={{
            left: Math.min(Math.max(tip.x, 90), window.innerWidth - 90),
            top: tip.y - 6,
          }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}

export function HeatmapLegend({ palette }: { palette: PaletteName }) {
  return (
    <div className={`palette-${palette} flex items-center gap-1 text-xs text-muted`} aria-hidden>
      <span className="mr-1">Less</span>
      {[0, 1, 2, 3, 4].map((l) => (
        <span
          key={l}
          className="inline-block h-[10px] w-[10px] rounded-[2px]"
          style={{ background: `var(--heat-${l})` }}
        />
      ))}
      <span className="ml-1">More</span>
    </div>
  );
}
