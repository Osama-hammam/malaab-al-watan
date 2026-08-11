import { useQuery } from "@tanstack/react-query";
import { MapPin, ArrowRight, AlertTriangle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveBranches, type Branch } from "@/services/branchesService";

export function BranchGrid({ onSelect }: { onSelect: (branch: Branch) => void }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["branches"],
    queryFn: getActiveBranches,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
        <AlertTriangle className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Couldn't load branches. Please try again.</p>
        <button onClick={() => refetch()} className="text-sm font-medium text-primary underline underline-offset-4">
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        No branches are open for booking right now.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {data.map((branch) => (
        <Card
          key={branch.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(branch)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(branch)}
          className="group cursor-pointer transition-all hover:border-primary hover:shadow-md focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardContent className="flex items-center justify-between gap-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MapPin className="size-5" />
              </div>
              <span dir="rtl" lang="ar" className="text-lg font-semibold">
                {branch.name}
              </span>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
