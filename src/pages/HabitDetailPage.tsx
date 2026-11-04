import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Heatmap, HeatmapLegend } from '../components/heatmap/Heatmap';
import { DaySheet } from '../components/habits/DaySheet';
import { Card, HabitBadge, Stat, buttonClass } from '../components/ui';
import { type DateKey } from '../domain/dates';
import { weeksBetween } from '../domain/grid';
import { habitRatios } from '../domain/overview';
import { describeSchedule, isScheduled } from '../domain/schedule';
import { computeStats, habitStartKey } from '../domain/stats';
import { useSettings } from '../hooks/settings';
import { useHabit, useValuesByHabit } from '../hooks/useData';
import { useToday } from '../hooks/useToday';

export function HabitDetailPage() {
  const { id } = useParams();
  const habit = useHabit(id);
  const all = useValuesByHabit();
  const today = useToday();
  const { weekStart } = useSettings();
  const [range, setRange] = useState<'last' | number>('last');
  const [openDate, setOpenDate] = useState<DateKey | null>(null);

  const values = useMemo(() => all?.get(id ?? '') ?? new Map<DateKey, number>(), [all, id]);
  const ratios = useMemo(() => (habit ? habitRatios(habit, values) : new Map()), [habit, values]);
  const stats = useMemo(
    () => (habit ? computeStats(habit, values, today) : null),
    [habit, values, today],
  );

  if (habit === undefined || all === undefined) return null;
  if (habit === null || !stats) {
    return (
      <Card>
        <p className="mb-4">This habit doesn’t exist any more.</p>
        <Link to="/" className={buttonClass()}>
          Back to Today
        </Link>
      </Card>
    );
  }

  const thisYear = Number(today.slice(0, 4));
  const firstYear = Number(habitStartKey(habit, values).slice(0, 4));
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => thisYear - i);

  let endDate = today;
  let startDate: DateKey | undefined;
  let weeks = 53;
  if (range !== 'last') {
    startDate = `${range}-01-01`;
    endDate = range === thisYear ? today : `${range}-12-31`;
    weeks = weeksBetween(startDate, `${range}-12-31`, weekStart);
  }
  const yearCount =
    range === 'last' ? null : [...values.keys()].filter((d) => d.startsWith(`${range}-`)).length;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <HabitBadge habit={habit} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{habit.name}</h1>
          <p className="text-sm text-muted">
            {describeSchedule(habit)}
            {habit.archivedAt && ' · archived'}
          </p>
        </div>
        <Link to={`/habits/${habit.id}/edit`} className={buttonClass()}>
          Edit
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Current streak" value={`${stats.currentStreak} d`} />
        <Stat label="Longest streak" value={`${stats.longestStreak} d`} />
        <Stat label="Total check-ins" value={stats.totalCompletions} />
        <Stat
          label="Last 30 days"
          value={stats.rate30 === null ? '–' : `${Math.round(stats.rate30 * 100)}%`}
        />
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {range === 'last'
              ? `${stats.totalCompletions} check-ins in total`
              : `${yearCount} check-ins in ${range}`}
          </h2>
          <label className="text-sm">
            <span className="sr-only">Range</span>
            <select
              value={String(range)}
              onChange={(e) =>
                setRange(e.target.value === 'last' ? 'last' : Number(e.target.value))
              }
              className="rounded-lg border border-line bg-surface-2 px-2 py-1.5"
            >
              <option value="last">Last 12 months</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Heatmap
          data={ratios}
          endDate={endDate}
          startDate={startDate}
          weeks={weeks}
          weekStart={weekStart}
          palette={habit.color}
          isScheduled={(d) => isScheduled(habit, d)}
          onCellClick={setOpenDate}
          label={`${habit.name} heatmap`}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">Tap a day to change it.</p>
          <HeatmapLegend palette={habit.color} />
        </div>
      </Card>

      <DaySheet
        habit={habit}
        date={openDate}
        done={openDate ? values.has(openDate) : false}
        scheduled={openDate ? isScheduled(habit, openDate) : true}
        onClose={() => setOpenDate(null)}
      />
    </div>
  );
}
