import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  isLoading?: boolean;
  tone?: "default" | "success" | "warning" | "destructive";
}) {
  const toneClass = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-2">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", toneClass)}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          {isLoading ? <Skeleton className="mt-1 h-6 w-16" /> : <p className="text-xl font-bold">{value}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
