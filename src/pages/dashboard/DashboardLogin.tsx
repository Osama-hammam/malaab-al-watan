import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Loader2, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/constants/routes";
import { env } from "@/config/env";

export default function DashboardLogin() {
  const { session, isAdmin, isLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already logged in as an admin — no need to show the login form.
  if (!isLoading && session && isAdmin) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? ROUTES.dashboard;
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    setIsSubmitting(false);

    if (signInError) {
      setError("بيانات الدخول غير صحيحة");
      return;
    }
    navigate(ROUTES.dashboard, { replace: true });
  }

  return (
    <div dir="rtl" lang="ar" className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">لوحة تحكم {env.appName}</CardTitle>
          <CardDescription>تسجيل الدخول مخصص للإدارة فقط</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@malaabalwatan.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              دخول
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
