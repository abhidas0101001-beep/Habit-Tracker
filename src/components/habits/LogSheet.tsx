import { useEffect, useState } from 'react';
import { Button, Sheet } from '../ui';
import { setValue } from '../../data/repo';
import { formatLong, type DateKey } from '../../domain/dates';
import { formatProgress, unitLabel } from '../../domain/format';
import type { Habit } from '../../domain/types';

const chip =
  'min-h-10 whitespace-nowrap rounded-lg border border-line bg-surface-2 px-1 text-sm font-medium hover:brightness-95 dark:hover:brightness-125';

/** View or change one day of a habit. Opened from a heatmap cell or the Today screen. */
export function LogSheet({
  habit,
  date,
  value,
  scheduled = true,
  onClose,
}: {
  habit: Habit;
  date: DateKey | null;
  value: number;
  scheduled?: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [date, value]);

  const save = async (v: number) => {
    if (date) await setValue(habit.id, date, Math.max(0, Math.round(v)));
    onClose();
  };

  const step = habit.type === 'duration' ? 5 : 1;
  const max = habit.type === 'duration' ? 1440 : 9999;

  return (
    <Sheet open={date !== null} onClose={onClose} title={date ? formatLong(date) : ''}>
      {date && (
        <div className={`palette-${habit.color} space-y-4`}>
          <p className="text-sm text-muted">
            {habit.name}: {formatProgress(habit, value)}
            {!scheduled && ' · rest day'}
          </p>

          {habit.type === 'boolean' ? (
            <div className="flex gap-2">
              <Button
                variant={value > 0 ? 'secondary' : 'primary'}
                className="flex-1"
                onClick={() => save(value > 0 ? 0 : 1)}
              >
                {value > 0 ? 'Mark not done' : 'Mark done'}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Button
                  aria-label={`Minus ${step}`}
                  onClick={() => setDraft((d) => Math.max(0, d - step))}
                  className="w-12 text-lg"
                >
                  −
                </Button>
                <label className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3">
                  <span className="sr-only">Amount ({unitLabel(habit)})</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={max}
                    value={draft}
                    onChange={(e) =>
                      setDraft(Math.min(max, Math.max(0, Number(e.target.value) || 0)))
                    }
                    className="min-h-11 w-full bg-transparent text-center text-xl font-semibold tabular-nums outline-none"
                  />
                  <span className="text-sm whitespace-nowrap text-muted">
                    / {habit.target} {unitLabel(habit)}
                  </span>
                </label>
                <Button
                  aria-label={`Plus ${step}`}
                  onClick={() => setDraft((d) => Math.min(max, d + step))}
                  className="w-12 text-lg"
                >
                  +
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {(habit.type === 'duration' ? [5, 15, 30] : []).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={chip}
                    onClick={() => setDraft((d) => Math.min(max, d + n))}
                  >
                    +{n} min
                  </button>
                ))}
                <button
                  type="button"
                  className={`${chip} ${habit.type === 'duration' ? '' : 'col-span-4'}`}
                  onClick={() => setDraft(habit.target)}
                >
                  {habit.type === 'duration' ? 'Target' : `Set to target (${habit.target})`}
                </button>
              </div>

              <div className="flex gap-2">
                <Button variant="primary" className="flex-1" onClick={() => save(draft)}>
                  Save
                </Button>
                {value > 0 && (
                  <Button variant="ghost" onClick={() => save(0)}>
                    Clear
                  </Button>
                )}
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
