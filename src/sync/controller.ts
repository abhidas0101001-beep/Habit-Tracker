import { useSyncExternalStore } from 'react';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { onLocalChange } from '../data/changes';
import { db } from '../data/db';
import { syncOnce, type CursorStore } from './engine';
import { supabase, supabaseRemote, syncConfigured } from './supabase';

export type SyncState = 'disabled' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  email: string | null;
  lastSyncedAt: string | null;
  error: string | null;
}

let status: SyncStatus = {
  state: syncConfigured ? 'signed-out' : 'disabled',
  email: null,
  lastSyncedAt: null,
  error: null,
};
const listeners = new Set<() => void>();
function setStatus(changes: Partial<SyncStatus>) {
  status = { ...status, ...changes };
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

function cursorStore(userId: string): CursorStore {
  const k = `habit-tracker:sync-cursor:${userId}`;
  return {
    get() {
      try {
        return { habits: null, entries: null, ...JSON.parse(localStorage.getItem(k) ?? '{}') };
      } catch {
        return { habits: null, entries: null };
      }
    },
    set(v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* the next sync just re-reads a little more */
      }
    },
  };
}

let session: Session | null = null;
let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let channel: RealtimeChannel | null = null;

/** Run a sync now; if one is already running, run once more right after it. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function runOnce() {
  if (!supabase || !session) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus({ state: 'offline' });
    return;
  }
  setStatus({ state: 'syncing' });
  try {
    await syncOnce(db, supabaseRemote(supabase, session.user.id), cursorStore(session.user.id));
    setStatus({ state: 'idle', lastSyncedAt: new Date().toISOString(), error: null });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const offline = navigator.onLine === false || /fetch|network/i.test(message);
    setStatus(offline ? { state: 'offline', error: null } : { state: 'error', error: message });
  }
}

/** Debounced sync, used after local edits and realtime notifications. */
export function scheduleSync(delay = 1500): void {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

function subscribeRealtime(userId: string) {
  if (!supabase) return;
  channel = supabase
    .channel(`changes:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${userId}` },
      () => scheduleSync(500),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${userId}` },
      () => scheduleSync(500),
    )
    .subscribe();
}

function onSession(next: Session | null) {
  const changedUser = next?.user.id !== session?.user.id;
  session = next;
  if (!changedUser) return;
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
  if (next) {
    setStatus({ state: 'idle', email: next.user.email ?? null, error: null });
    subscribeRealtime(next.user.id);
    void syncNow();
  } else {
    setStatus({ state: 'signed-out', email: null, lastSyncedAt: null, error: null });
  }
}

let started = false;

/** Call once at startup. Does nothing when sync isn't configured. */
export function startSync(): void {
  if (started || !supabase) return;
  started = true;

  supabase.auth.onAuthStateChange((_event, s) => {
    // Supabase advises not awaiting other calls inside this callback.
    setTimeout(() => onSession(s), 0);
  });
  void supabase.auth.getSession().then(({ data }) => {
    onSession(data.session);
    // Tidy the URL after a magic-link sign-in (?code=…).
    if (location.search.includes('code=')) {
      history.replaceState(null, '', location.pathname + location.hash);
    }
  });

  onLocalChange(() => scheduleSync());
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => session && setStatus({ state: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  // Fallback in case a realtime message is missed.
  setInterval(() => document.visibilityState === 'visible' && void syncNow(), 5 * 60 * 1000);
}

// ---------- Sign-in ----------

function client() {
  if (!supabase) throw new Error('Sync is not set up.');
  return supabase;
}

/** Email a one-time code (and a magic link) to sign in. */
export async function sendSignInEmail(email: string): Promise<void> {
  const { error } = await client().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw new Error(error.message);
}

/** Sign in with the code from the email. Works inside an installed app, where links open elsewhere. */
export async function verifyCode(email: string, code: string): Promise<void> {
  const { error } = await client().auth.verifyOtp({ email, token: code.trim(), type: 'email' });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await client().auth.signOut();
}
