import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/client";

describe("supabase client env", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
    vi.unstubAllEnvs();
  });

  it("reports missing env with actionable message", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const result = getSupabaseConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(result.error.message).toContain("Vercel Environment Variables");
    }
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("accepts configured env", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
    expect(getSupabaseConfig().ok).toBe(true);
    expect(isSupabaseConfigured()).toBe(true);
  });
});
