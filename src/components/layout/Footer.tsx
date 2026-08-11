import { env } from "@/config/env";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        © {new Date().getFullYear()}{" "}
        <span dir="rtl" lang="ar">
          {env.appName}
        </span>
        . All rights reserved.
      </div>
    </footer>
  );
}
