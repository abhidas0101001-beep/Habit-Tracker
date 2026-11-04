import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, Card, HabitBadge, PALETTES } from '../components/ui';
import { createHabit, deleteHabit, setArchived, updateHabit } from '../data/repo';
import { WEEKDAY_SHORT } from '../domain/schedule';
import type { HabitType, PaletteName, Schedule } from '../domain/types';
import { useSettings } from '../hooks/settings';
import { useHabit } from '../hooks/useData';

export function HabitEditorPage() {
  const { id } = useParams();
  const editing = !!id;
  const habit = useHabit(id);
  const navigate = useNavigate();
  const { weekStart } = useSettings();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState<PaletteName>('green');
  const [type, setType] = useState<HabitType>('boolean');
  const [target, setTarget] = useState(8);
  const [unit, setUnit] = useState('');
  const [kind, setKind] = useState<Schedule['kind']>('daily');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [times, setTimes] = useState(3);
  const [loaded, setLoaded] = useState(!editing);

  useEffect(() => {
    if (!habit || loaded) return;
    setName(habit.name);
    setIcon(habit.icon ?? '');
    setColor(habit.color);
    setType(habit.type);
    setTarget(habit.target);
    setUnit(habit.unit ?? '');
    setKind(habit.schedule.kind);
    if (habit.schedule.kind === 'weekdays') setDays(habit.schedule.days);
    if (habit.schedule.kind === 'timesPerWeek') setTimes(habit.schedule.times);
    setLoaded(true);
  }, [habit, loaded]);

  if (editing && habit === undefined) return null;
  if (editing && habit === null) {
    return <Card>This habit doesn’t exist any more.</Card>;
  }

  const schedule: Schedule =
    kind === 'daily'
      ? { kind: 'daily' }
      : kind === 'weekdays'
        ? { kind: 'weekdays', days }
        : { kind: 'timesPerWeek', times };
  const maxTarget = type === 'duration' ? 1440 : 9999;
  const valid =
    name.trim().length > 0 &&
    (kind !== 'weekdays' || days.length > 0) &&
    (type === 'boolean' || (target >= 1 && target <= maxTarget));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const input = {
      name: name.trim(),
      icon: icon.trim() || undefined,
      color,
      schedule,
      type,
      target: type === 'boolean' ? 1 : Math.round(target),
      unit: type === 'count' ? unit.trim() || undefined : undefined,
    };
    if (editing && habit) {
      await updateHabit(habit.id, input);
      navigate(`/habits/${habit.id}`, { replace: true });
    } else {
      const created = await createHabit(input);
      navigate(`/habits/${created.id}`, { replace: true });
    }
  };

  const orderedDays = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">{editing ? 'Edit habit' : 'New habit'}</h1>

      <Card className="space-y-5">
        <div className="flex items-end gap-3">
          <HabitBadge habit={{ name: name || '?', icon, color }} size={48} />
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium">Name</span>
            <input
              autoFocus={!editing}
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read 20 pages"
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5"
            />
          </label>
          <label className="w-20">
            <span className="mb-1 block text-sm font-medium">Icon</span>
            <input
              value={icon}
              maxLength={4}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="📚"
              aria-label="Icon (emoji)"
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-center"
            />
          </label>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium">Type</legend>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['boolean', 'Yes / no'],
                ['count', 'Count'],
                ['duration', 'Minutes'],
              ] as const
            ).map(([t, label]) => (
              <label key={t}>
                <input
                  type="radio"
                  name="type"
                  checked={type === t}
                  disabled={editing}
                  onChange={() => {
                    setType(t);
                    setTarget(t === 'duration' ? 30 : 8);
                  }}
                  className="peer sr-only"
                />
                <span className="flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-line text-sm peer-checked:border-fg peer-checked:font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-fg peer-disabled:cursor-default peer-disabled:opacity-60 peer-checked:peer-disabled:opacity-100">
                  {label}
                </span>
              </label>
            ))}
          </div>
          {editing && (
            <p className="text-xs text-muted">The type can’t change after a habit is created.</p>
          )}
          {type !== 'boolean' && (
            <div className="flex gap-3">
              <label className="w-28">
                <span className="mb-1 block text-sm">Daily target</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxTarget}
                  required
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5"
                />
              </label>
              {type === 'count' ? (
                <label className="flex-1">
                  <span className="mb-1 block text-sm">Unit</span>
                  <input
                    value={unit}
                    maxLength={20}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="glasses, pages, …"
                    className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5"
                  />
                </label>
              ) : (
                <span className="self-end pb-3 text-sm text-muted">minutes a day</span>
              )}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Colour</legend>
          <div className="flex gap-3">
            {PALETTES.map((p) => (
              <label key={p} className={`palette-${p} cursor-pointer`}>
                <input
                  type="radio"
                  name="color"
                  value={p}
                  checked={color === p}
                  onChange={() => setColor(p)}
                  className="peer sr-only"
                />
                <span
                  className="block h-10 w-10 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-fg peer-focus-visible:ring-2 peer-focus-visible:ring-fg"
                  style={{ background: 'var(--heat-3)' }}
                />
                <span className="sr-only">{p}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium">Schedule</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['daily', 'weekdays', 'timesPerWeek'] as const).map((k) => (
              <label key={k}>
                <input
                  type="radio"
                  name="kind"
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="peer sr-only"
                />
                <span className="flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-line text-sm peer-checked:border-fg peer-checked:font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-fg">
                  {k === 'daily'
                    ? 'Every day'
                    : k === 'weekdays'
                      ? 'Specific days'
                      : 'Times a week'}
                </span>
              </label>
            ))}
          </div>
          {kind === 'weekdays' && (
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="Days of the week">
              {orderedDays.map((d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                    className={`min-h-10 rounded-lg border text-xs sm:text-sm ${
                      on ? 'border-fg bg-surface-2 font-semibold' : 'border-line text-muted'
                    }`}
                  >
                    {WEEKDAY_SHORT[d]}
                  </button>
                );
              })}
            </div>
          )}
          {kind === 'timesPerWeek' && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <select
                  value={times}
                  onChange={(e) => setTimes(Number(e.target.value))}
                  className="rounded-lg border border-line bg-surface-2 px-2 py-2"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                times a week, on any days
              </label>
            </div>
          )}
        </fieldset>
      </Card>

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex gap-2 bg-bg/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0">
        <Button type="submit" variant="primary" disabled={!valid} className="flex-1">
          {editing ? 'Save' : 'Create habit'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>

      {editing && habit && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">Manage</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={async () => {
                await setArchived(habit.id, !habit.archivedAt);
                navigate(habit.archivedAt ? `/habits/${habit.id}` : '/overview', { replace: true });
              }}
            >
              {habit.archivedAt ? 'Unarchive' : 'Archive'}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (
                  !window.confirm(
                    `Delete “${habit.name}” and all its history? This can’t be undone.`,
                  )
                )
                  return;
                await deleteHabit(habit.id);
                navigate('/', { replace: true });
              }}
            >
              Delete
            </Button>
          </div>
          <p className="text-xs text-muted">
            Archiving hides the habit from Today but keeps its history.
          </p>
        </Card>
      )}
    </form>
  );
}
