import { useEffect, useState, type FormEvent } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button, Card } from './ui';
import { sendSignInEmail, signOut, syncNow, useSyncStatus, verifyCode } from '../sync/controller';

const SETUP_URL =
  'https://github.com/abhidas0101001-beep/Habit-Tracker/blob/HEAD/docs/SUPABASE_SETUP.md';

function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

const input = 'w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5';

export function SyncCard() {
  const status = useSyncStatus();
  useTick(30_000);

  if (status.state === 'disabled') {
    return (
      <Card className="space-y-2">
        <h2 className="text-sm font-semibold">Sync</h2>
        <p className="text-sm text-muted">
          Sync between devices isn’t set up for this copy of the app.{' '}
          <a className="underline" href={SETUP_URL} target="_blank" rel="noreferrer">
            How to set it up
          </a>
        </p>
      </Card>
    );
  }

  if (status.state === 'signed-out') return <SignIn />;

  const line =
    status.state === 'syncing'
      ? 'Syncing…'
      : status.state === 'offline'
        ? 'Offline. Changes will sync when you’re back online.'
        : status.state === 'error'
          ? `Sync failed: ${status.error}`
          : status.lastSyncedAt
            ? `Synced ${formatDistanceToNow(new Date(status.lastSyncedAt), { addSuffix: true })}`
            : 'Waiting to sync…';

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">Sync</h2>
      <p className="text-sm">
        Signed in as <strong>{status.email}</strong>
      </p>
      <p
        role="status"
        className={`text-sm ${status.state === 'error' ? 'text-red-600 dark:text-red-400' : 'text-muted'}`}
      >
        {line}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void syncNow()} disabled={status.state === 'syncing'}>
          Sync now
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm('Sign out on this device? Your habits stay here, but stop syncing.'))
              void signOut();
          }}
        >
          Sign out
        </Button>
      </div>
    </Card>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSend = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await sendSignInEmail(email.trim());
      setSent(true);
    });
  };
  const onVerify = (e: FormEvent) => {
    e.preventDefault();
    void run(() => verifyCode(email.trim(), code));
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">Sync</h2>
      <p className="text-sm text-muted">
        Sign in to keep your habits in sync on your phone, tablet and laptop. Your current habits
        are uploaded on the first sign-in.
      </p>
      {!sent ? (
        <form onSubmit={onSend} className="flex flex-col gap-2 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
          </label>
          <Button type="submit" variant="primary" disabled={busy}>
            Email me a code
          </Button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="space-y-2">
          <p className="text-sm">
            We sent an email to <strong>{email}</strong>. Enter the code from it, or tap its link in
            this browser.
          </p>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">Code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                required
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={`${input} text-center tracking-widest`}
              />
            </label>
            <Button type="submit" variant="primary" disabled={busy}>
              Sign in
            </Button>
          </div>
          <button
            type="button"
            className="text-sm text-muted underline"
            onClick={() => {
              setSent(false);
              setCode('');
            }}
          >
            Use a different email
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </Card>
  );
}
