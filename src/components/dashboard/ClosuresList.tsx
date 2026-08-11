import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { getClosuresForBranch, deleteClosure, CLOSURE_SECTION_LABEL } from "@/services/admin/adminClosuresService";
import { getActiveFieldSections } from "@/services/branchesService";

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateLabel = start.toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
  const startTime = start.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} · ${startTime} – ${endTime}`;
}

export function ClosuresList({ branchId, date }: { branchId: string; date: string }) {
  const queryClient = useQueryClient();

  const closuresQuery = useQuery({
    queryKey: ["admin", "closures", branchId, date],
    queryFn: () => getClosuresForBranch({ branchId, fromDate: date, toDate: date }),
  });

  const sectionsQuery = useQuery({
    queryKey: ["field-sections", branchId],
    queryFn: () => getActiveFieldSections(branchId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClosure(id),
    onSuccess: () => {
      toast.success("تم حذف الإغلاق");
      void queryClient.invalidateQueries({ queryKey: ["admin", "closures"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "schedule"] });
    },
    onError: () => toast.error("تعذر حذف الإغلاق"),
  });

  if (closuresQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  if (!closuresQuery.data || closuresQuery.data.length === 0) {
    return <p className="text-sm text-muted-foreground">لا توجد إغلاقات في هذا اليوم.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {closuresQuery.data.map((closure) => {
        const sectionLabel = closure.fieldSectionId
          ? (CLOSURE_SECTION_LABEL[
              sectionsQuery.data?.find((s) => s.id === closure.fieldSectionId)?.code ?? "A"
            ] ?? "قسم محدد")
          : CLOSURE_SECTION_LABEL.ALL;

        return (
          <div key={closure.id} className="flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm">
            <div>
              <p className="font-medium">{sectionLabel}</p>
              <p className="text-xs text-muted-foreground">{formatRange(closure.startsAt, closure.endsAt)}</p>
              {closure.reason && <p className="text-xs text-muted-foreground">{closure.reason}</p>}
            </div>
            <button
              onClick={() => deleteMutation.mutate(closure.id)}
              disabled={deleteMutation.isPending}
              className="rounded-md p-2 text-destructive hover:bg-destructive/10"
              aria-label="حذف"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
