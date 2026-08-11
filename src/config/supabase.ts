import { createClient } from "@supabase/supabase-js";

import { env } from "@/config/env";
import type { Database } from "@/types/database.types";

/**
 * Single shared Supabase client for the whole app.
 * Import this everywhere instead of calling `createClient` again —
 * multiple client instances duplicate auth/session listeners.
 *
 * Typed with `Database` so that once tables exist and types are
 * regenerated (see src/types/database.types.ts), every query gets
 * full autocomplete + compile-time safety.
 */
export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
