import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/config/supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * `isAdmin` is determined by calling the real `is_admin()` RPC (backed by
 * the `admin_users` table), never a hardcoded role or client-side-only
 * check. This is UX convenience only — every actual admin data
 * read/write is independently protected by RLS regardless of what this
 * context reports, so a stale/bypassed frontend check cannot expose
 * protected data (see docs/DATABASE.md and docs/BUSINESS_LOGIC.md).
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkAdmin(currentSession: Session | null) {
      if (!currentSession) {
        if (isMounted) setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase.rpc("is_admin");
      if (isMounted) setIsAdmin(!error && data === true);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      void checkAdmin(data.session).finally(() => {
        if (isMounted) setIsLoading(false);
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      void checkAdmin(newSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, isAdmin, isLoading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
