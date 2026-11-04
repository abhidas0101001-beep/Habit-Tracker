import { useMemo } from 'react';
import { Link } from 'react-router';
import { Heatmap, HeatmapLegend } from '../components/heatmap/Heatmap';
import { Card, HabitBadge, buttonClass } from '../components/ui';
import { addDaysKey, formatLong } from '../domain/dates';
import { formatProgress } from '../domain/format';
import { habitRatios, overviewRatios } from '../domain/overview';
import { describeSchedule, isScheduled } from '../domain/schedule';
import { computeStats } from '../domain/stats';
import type { Habit } from '../domain/types';
import { useSettings } from '../hooks/settings';
import { useHabits, useValuesByHabit, type ValuesByHabit } from '../hooks/useData';
import { useToday } from '../hooks/useToday';

export function OverviewPage() {
  const habits = useHabits();
  const values = useValuesByHabit();
  const today = useToday();
  const { weekStart } = useSettings();

  const active = useMemo(() => (habits ?? []).filter((h) => !h.archivedAt), [habits]);
  const archived = useMemo(() => (habits ?? []).filter((h) => h.archivedAt), [habits]);
  const combined = useMemo(
    () => overviewRatios(active, values ?? new Map(), addDaysKey(today, -371), today),
    [active, values, today],
  );

  if (!habits || !values) return null;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Overview</h1>
        <Link to="/habits/new" className={buttonClass('primary')}>
          + New habit
        </Link>
      </header>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold">All habits · last 12 months</h2>
        <Heatmap
          data={combined}
          endDate={today}
          weekStart={weekStart}
          palette="green"
          label="All habits, last 12 months"
          describe={(d, r) => `${formatLong(d)}: ${Math.round(r * 100)}% of habits done`}
        />
        <div className="flex justify-end">
          <HeatmapLegend palette="green" />
        </div>
      </Card>

      {active.length === 0 && (
        <p className="text-sm text-muted">No habits yet. Create one to start filling the grid.</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {active.map((h) => (
          <HabitHeatmapCard
            key={h.id}
            habit={h}
            values={values}
            today={today}
            weekStart={weekStart}
          />
        ))}
      </div>

      {archived.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted">Archived</h2>
          <ul className="space-y-2">
            {archived.map((h) => (
              <li key={h.id}>
                <Link
                  to={`/habits/${h.id}`}
                  className="flex items-center gap-3 rounded-lg p-2 opacity-70 hover:bg-surface-2"
                >
                  <HabitBadge habit={h} size={28} />
                  {h.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function HabitHeatmapCard({
  habit,
  values,
  today,
  weekStart,
}: {
  habit: Habit;
  values: ValuesByHabit;
  today: string;
  weekStart: 0 | 1;
}) {
  const v = values.get(habit.id);
  const ratios = useMemo(() => habitRatios(habit, v), [habit, v]);
  const stats = useMemo(
    () => computeStats(habit, v ?? new Map(), today, weekStart),
    [habit, v, today, weekStart],
  );
  return (
    <Card className="space-y-3">
      <Link to={`/habits/${habit.id}`} className="flex items-center gap-3">
        <HabitBadge habit={habit} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{habit.name}</span>
          <span className="block text-xs text-muted">{describeSchedule(habit)}</span>
        </span>
        <span className="text-right text-xs text-muted">
          <span className="block text-base font-semibold text-fg tabular-nums">
            {stats.currentStreak}
          </span>
          {stats.streakUnit} streak
        </span>
      </Link>
      <Heatmap
        data={ratios}
        endDate={today}
        weeks={26}
        weekStart={weekStart}
        palette={habit.color}
        isScheduled={(d) => isScheduled(habit, d)}
        describe={(d) => `${formatLong(d)}: ${formatProgress(habit, v?.get(d))}`}
        label={`${habit.name}, last 26 weeks`}
        maxCell={20}
      />
    </Card>
  );
}
