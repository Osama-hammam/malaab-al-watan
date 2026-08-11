import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

interface PageContainerProps extends PropsWithChildren {
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto max-w-6xl px-4 py-10", className)}>
      {children}
    </div>
  );
}
