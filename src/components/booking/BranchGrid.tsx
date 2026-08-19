import { useQuery } from "@tanstack/react-query";
import { MapPin, ChevronLeft, AlertTriangle, Building2 } from "lucide-react";

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
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-10 text-center">
        <AlertTriangle className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">تعذر تحميل المواقع. حاول مجدداً.</p>
        <button onClick={() => refetch()} className="text-sm font-semibold text-primary underline underline-offset-4">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        لا توجد مواقع متاحة للحجز حالياً.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-muted-foreground">اختر الموقع</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.map((branch) => (
          <Card
            key={branch.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(branch)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(branch)}
            className="card-hover group cursor-pointer border-2 transition-all hover:border-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CardContent className="flex items-center justify-between gap-4 py-5 px-5">
              <div className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Building2 className="size-6" />
                </div>
                <div>
                  <span className="block text-base font-black text-foreground">{branch.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="size-3" />
                    ٣ ملاعب متاحة
                  </span>
                </div>
              </div>
              <ChevronLeft className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
