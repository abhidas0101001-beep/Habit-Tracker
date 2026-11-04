import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { Habit, PaletteName } from '../domain/types';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110',
  secondary:
    'bg-surface-2 text-fg border border-line hover:brightness-95 dark:hover:brightness-125',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-fg hover:bg-surface-2',
};

export function Button({
  variant = 'secondary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}

export const buttonClass = (variant: Variant = 'secondary') =>
  `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition ${VARIANTS[variant]}`;

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-4 sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

export const PALETTES: PaletteName[] = ['green', 'blue', 'purple', 'orange', 'pink'];

export function HabitBadge({
  habit,
  size = 36,
}: {
  habit: Pick<Habit, 'icon' | 'name' | 'color'>;
  size?: number;
}) {
  return (
    <span
      className={`palette-${habit.color} inline-flex shrink-0 items-center justify-center rounded-lg font-semibold`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: 'color-mix(in srgb, var(--heat-3) 22%, transparent)',
        color: 'var(--heat-3)',
      }}
      aria-hidden
    >
      {habit.icon || habit.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('button, [href], input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-t-2xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
      >
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
