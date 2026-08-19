import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

interface PageContainerProps extends PropsWithChildren {
  className?: string;
  dir?: string;
  lang?: string;
}

export function PageContainer({ children, className, dir, lang }: PageContainerProps) {
  return (
    <div dir={dir} lang={lang} className={cn("mx-auto max-w-6xl px-4 py-10", className)}>
      {children}
    </div>
  );
}
