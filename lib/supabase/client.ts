import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseConfigError = {
  kind: "missing_env";
  message: string;
};

/** Read public Supabase config from build-time env (static export / client-only). */
export function getSupabaseConfig():
  | { ok: true; config: SupabaseConfig }
  | { ok: false; error: SupabaseConfigError } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return {
      ok: false,
      error: {
        kind: "missing_env",
        message:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (local dev) or Vercel Environment Variables (production deploy).",
      },
    };
  }

  return { ok: true, config: { url, anonKey } };
}

let browserClient: SupabaseClient | null = null;

/** Singleton browser Supabase client. Returns null when env is missing. */
export function getSupabaseClient(): SupabaseClient | null {
  const configResult = getSupabaseConfig();
  if (!configResult.ok) return null;

  if (!browserClient) {
    browserClient = createClient(configResult.config.url, configResult.config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return browserClient;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().ok;
}
