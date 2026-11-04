import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { format } from 'date-fns';
import { Heatmap } from '../components/heatmap/Heatmap';
import { Card, HabitBadge, buttonClass } from '../components/ui';
import { toggleDone } from '../data/repo';
import { addDaysKey, fromKey } from '../domain/dates';
import { overviewRatios } from '../domain/overview';
import { describeSchedule, isScheduled } from '../domain/schedule';
import { computeStats } from '../domain/stats';
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

  const active = useMemo(() => (habits ?? []).filter((h) => !h.archivedAt), [habits]);
  const due = active.filter((h) => isScheduled(h, today));
  const notDue = active.filter((h) => !isScheduled(h, today));
  const doneCount = due.filter((h) => values?.get(h.id)?.has(today)).length;

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
      if (n >= 1 && n <= 9 && due[n - 1]) void toggleDone(due[n - 1]!.id, today);
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
              <HabitRow key={h.id} habit={h} index={i} values={values.get(h.id)} today={today} />
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
                  <HabitRow key={h.id} habit={h} values={values.get(h.id)} today={today} />
                ))}
              </ul>
            </section>
          )}

          <Link to="/habits/new" className={`${buttonClass('secondary')} w-full md:hidden`}>
            + New habit
          </Link>
        </>
      )}
    </div>
  );
}

function HabitRow({
  habit,
  values,
  today,
  index,
}: {
  habit: Habit;
  values: Map<string, number> | undefined;
  today: string;
  index?: number;
}) {
  const done = !!values?.has(today);
  const stats = useMemo(
    () => computeStats(habit, values ?? new Map(), today),
    [habit, values, today],
  );
  return (
    <li
      className={`palette-${habit.color} flex items-center gap-3 rounded-xl border border-line bg-surface p-3`}
    >
      <Link to={`/habits/${habit.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <HabitBadge habit={habit} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{habit.name}</span>
          <span className="block text-xs text-muted">
            {stats.currentStreak > 0
              ? `🔥 ${stats.currentStreak}-day streak`
              : describeSchedule(habit)}
            {index !== undefined && index < 9 && (
              <kbd className="ml-2 hidden rounded border border-line px-1 text-[10px] lg:inline">
                {index + 1}
              </kbd>
            )}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => void toggleDone(habit.id, today)}
        aria-pressed={done}
        aria-label={`${habit.name}: ${done ? 'done today, tap to undo' : 'mark done for today'}`}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-95"
        style={{
          borderColor: 'var(--heat-3)',
          background: done ? 'var(--heat-3)' : 'transparent',
          color: done ? '#fff' : 'var(--heat-3)',
        }}
      >
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
      </button>
    </li>
  );
}
