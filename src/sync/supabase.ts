import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Remote } from './engine';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Sync is optional: without these build-time settings the app stays local-only. */
export const syncConfigured = !!(url && key);

export const supabase: SupabaseClient | null = syncConfigured
  ? createClient(url!, key!, {
      auth: {
        // PKCE: magic links come back as ?code=…, which doesn't clash with hash routing.
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function supabaseRemote(client: SupabaseClient, userId: string): Remote {
  return {
    async push(habits, entries) {
      const { error } = await client.rpc('push_changes', { p_habits: habits, p_entries: entries });
      if (error) throw new Error(error.message);
    },
    async pull(table, since, offset, limit) {
      let q = client.from(table).select('*').eq('user_id', userId);
      if (since) q = q.gte('synced_at', since);
      const { data, error } = await q
        .order('synced_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) throw new Error(error.message);
      return (data ?? []) as never;
    },
  };
}
