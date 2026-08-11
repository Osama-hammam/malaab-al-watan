/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_PAYMENTS_BUCKET: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_RESERVATION_LOCK_MINUTES: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
