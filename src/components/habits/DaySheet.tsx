import { Sheet, Button } from '../ui';
import { setValue } from '../../data/repo';
import { formatLong, type DateKey } from '../../domain/dates';
import type { Habit } from '../../domain/types';

/** View or change one day of a habit (opened from a heatmap cell). */
export function DaySheet({
  habit,
  date,
  done,
  scheduled,
  onClose,
}: {
  habit: Habit;
  date: DateKey | null;
  done: boolean;
  scheduled: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={date !== null} onClose={onClose} title={date ? formatLong(date) : ''}>
      {date && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {habit.name}: {done ? 'done' : 'not done'}
            {!scheduled && ' · rest day'}
          </p>
          <div className="flex gap-2">
            <Button
              variant={done ? 'secondary' : 'primary'}
              className="flex-1"
              onClick={async () => {
                await setValue(habit.id, date, done ? 0 : 1);
                onClose();
              }}
            >
              {done ? 'Mark not done' : 'Mark done'}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
