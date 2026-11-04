import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { format } from 'date-fns';
import { Heatmap } from '../components/heatmap/Heatmap';
import { Card, HabitBadge, buttonClass } from '../components/ui';
import { LogSheet } from '../components/habits/LogSheet';
import { addValue, toggleDone } from '../data/repo';
import { addDaysKey, fromKey } from '../domain/dates';
import { formatProgress } from '../domain/format';
import { ratioFor } from '../domain/levels';
import { overviewRatios } from '../domain/overview';
import { describeSchedule, isScheduled } from '../domain/schedule';
import { computeStats, weekCompletions } from '../domain/stats';
import type { Habit } from '../domain/types';
import { useSettings } from '../hooks/settings';
import { useHabits, useValuesByHabit } from '../hooks/useData';
import { useToday } from '../hooks/useToday';

export function TodayPage() {
  const today = useToday();
  const habits = useHabits();
  const values = useValuesByHabit();
  const { weekStart } = useSettings();
  const navigate = useNavigate();
  const [sheetHabit, setSheetHabit] = useState<Habit | null>(null);

  const active = useMemo(() => (habits ?? []).filter((h) => !h.archivedAt), [habits]);
  const due = active.filter((h) => isScheduled(h, today));
  const notDue = active.filter((h) => !isScheduled(h, today));
  const doneCount = due.filter((h) => ratioFor(h, values?.get(h.id)?.get(today)) >= 1).length;

  const recent = useMemo(
    () => overviewRatios(active, values ?? new Map(), addDaysKey(today, -7 * 12), today),
    [active, values, today],
  );

  // Desktop shortcuts: 1–9 toggle the nth habit due today, n creates a habit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        t.closest('input, textarea, select, [role="dialog"]')
      )
        return;
      if (e.key === 'n') navigate('/habits/new');
      const n = Number(e.key);
      const h = n >= 1 && n <= 9 ? due[n - 1] : undefined;
      if (!h) return;
      if (h.type === 'boolean') void toggleDone(h.id, today);
      else if (h.type === 'count') void addValue(h.id, today, 1);
      else setSheetHabit(h);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [due, today, navigate]);

  if (!habits || !values) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{format(fromKey(today), 'EEEE')}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{format(fromKey(today), 'MMMM d')}</h1>
        </div>
        {due.length > 0 && (
          <p className="text-sm text-muted" aria-live="polite">
            <span className="font-semibold text-fg">{doneCount}</span> of {due.length} done
          </p>
        )}
      </header>

      {active.length === 0 ? (
        <Card className="py-10 text-center">
          <h2 className="mb-2 text-lg font-semibold">Start your first habit</h2>
          <p className="mb-5 text-sm text-muted">
            Check it off every day and watch your heatmap fill in.
          </p>
          <Link to="/habits/new" className={buttonClass('primary')}>
            + New habit
          </Link>
        </Card>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Last 12 weeks</h2>
              <Link to="/overview" className="text-sm text-muted hover:text-fg">
                Full year →
              </Link>
            </div>
            <Heatmap
              data={recent}
              endDate={today}
              weeks={12}
              weekStart={weekStart}
              palette="green"
              label="All habits, last 12 weeks"
              maxCell={22}
            />
          </Card>

          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Due today">
            {due.map((h, i) => (
              <HabitRow
                key={h.id}
                habit={h}
                index={i}
                values={values.get(h.id)}
                today={today}
                onOpen={setSheetHabit}
              />
            ))}
          </ul>
          {due.length === 0 && (
            <p className="text-sm text-muted">Nothing is due today. Enjoy the rest day.</p>
          )}

          {notDue.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted">Not due today</h2>
              <ul className="grid gap-3 opacity-70 sm:grid-cols-2">
                {notDue.map((h) => (
                  <HabitRow
                    key={h.id}
                    habit={h}
                    values={values.get(h.id)}
                    today={today}
                    onOpen={setSheetHabit}
                  />
                ))}
              </ul>
            </section>
          )}

          <Link to="/habits/new" className={`${buttonClass('secondary')} w-full md:hidden`}>
            + New habit
          </Link>
          {sheetHabit && (
            <LogSheet
              habit={sheetHabit}
              date={today}
              value={values.get(sheetHabit.id)?.get(today) ?? 0}
              onClose={() => setSheetHabit(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function streakText(n: number, unit: 'day' | 'week') {
  return `🔥 ${n}-${unit} streak`;
}

function HabitRow({
  habit,
  values,
  today,
  index,
  onOpen,
}: {
  habit: Habit;
  values: Map<string, number> | undefined;
  today: string;
  index?: number;
  onOpen: (habit: Habit) => void;
}) {
  const { weekStart } = useSettings();
  const value = values?.get(today) ?? 0;
  const ratio = ratioFor(habit, value);
  const done = ratio >= 1;
  const stats = useMemo(
    () => computeStats(habit, values ?? new Map(), today, weekStart),
    [habit, values, today, weekStart],
  );

  const parts: string[] = [];
  if (habit.type !== 'boolean') parts.push(formatProgress(habit, value));
  if (habit.schedule.kind === 'timesPerWeek') {
    const n = weekCompletions(habit, values ?? new Map(), today, weekStart);
    parts.push(`${n} / ${habit.schedule.times} this week`);
  }
  if (stats.currentStreak > 0) parts.push(streakText(stats.currentStreak, stats.streakUnit));
  if (parts.length === 0) parts.push(describeSchedule(habit));

  const primary = () => {
    if (habit.type === 'boolean') void toggleDone(habit.id, today);
    else if (habit.type === 'count') void addValue(habit.id, today, 1);
    else onOpen(habit);
  };
  const primaryLabel =
    habit.type === 'boolean'
      ? `${habit.name}: ${done ? 'done today, tap to undo' : 'mark done for today'}`
      : habit.type === 'count'
        ? `${habit.name}: ${formatProgress(habit, value)}, add 1`
        : `${habit.name}: ${formatProgress(habit, value)}, log time`;

  const R = 21;
  const C = 2 * Math.PI * R;

  return (
    <li
      className={`palette-${habit.color} flex items-center gap-3 rounded-xl border border-line bg-surface p-3`}
    >
      <Link to={`/habits/${habit.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <HabitBadge habit={habit} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{habit.name}</span>
          <span className="block truncate text-xs text-muted">
            {parts.join(' · ')}
            {index !== undefined && index < 9 && (
              <kbd className="ml-2 hidden rounded border border-line px-1 text-[10px] lg:inline">
                {index + 1}
              </kbd>
            )}
          </span>
        </span>
      </Link>
      {habit.type === 'count' && value > 0 && (
        <button
          type="button"
          onClick={() => void addValue(habit.id, today, -1)}
          aria-label={`${habit.name}: subtract 1`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-lg text-muted active:scale-95"
        >
          −
        </button>
      )}
      <button
        type="button"
        onClick={primary}
        aria-pressed={habit.type === 'boolean' ? done : undefined}
        aria-label={primaryLabel}
        data-testid={`log-${habit.name}`}
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition active:scale-95"
        style={{
          background: done ? 'var(--heat-3)' : 'transparent',
          color: done ? '#fff' : 'var(--heat-3)',
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          className="absolute inset-0 -rotate-90"
          aria-hidden
        >
          <circle
            cx="24"
            cy="24"
            r={R}
            fill="none"
            stroke="var(--heat-3)"
            strokeWidth="2"
            opacity={habit.type === 'boolean' ? 1 : 0.3}
          />
          {habit.type !== 'boolean' && ratio > 0 && (
            <circle
              cx="24"
              cy="24"
              r={R}
              fill="none"
              stroke="var(--heat-3)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${C * Math.min(ratio, 1)} ${C}`}
            />
          )}
        </svg>
        {habit.type === 'boolean' || done ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden
            opacity={done ? 1 : 0.35}
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <span className="text-xl leading-none font-semibold" aria-hidden>
            +
          </span>
        )}
      </button>
    </li>
  );
}
