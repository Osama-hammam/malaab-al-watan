/**
 * Central place that reads and validates environment variables.
 * Every other module should import from here instead of touching
 * `import.meta.env` directly, so misconfiguration fails fast and loudly
 * at startup instead of causing confusing runtime bugs later.
 */

function readEnvVar(key: keyof ImportMetaEnv, fallback?: string): string {
  const value = import.meta.env[key] ?? fallback;

  if (!value) {
    // Thrown at module-load time -> surfaces immediately in dev/build,
    // rather than failing deep inside a Supabase call at runtime.
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Did you copy .env.example to .env.local?`
    );
  }

  return value;
}

export const env = {
  supabaseUrl: readEnvVar("VITE_SUPABASE_URL"),
  supabaseAnonKey: readEnvVar("VITE_SUPABASE_ANON_KEY"),
  supabasePaymentsBucket: readEnvVar(
    "VITE_SUPABASE_PAYMENTS_BUCKET",
    "payment-screenshots"
  ),
  appName: readEnvVar("VITE_APP_NAME", "ملعب الوطن"),
  reservationLockMinutes: Number(
    readEnvVar("VITE_RESERVATION_LOCK_MINUTES", "5")
  ),
} as const;
