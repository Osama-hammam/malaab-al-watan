import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveFieldSections, type FieldSection } from "@/services/branchesService";

const CODE_LABEL: Record<FieldSection["code"], string> = {
  A: "Field A",
  B: "Field B",
  AB: "Full Field (A + B)",
};

export function SectionGrid({
  branchId,
  onSelect,
}: {
  branchId: string;
  onSelect: (section: FieldSection) => void;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["field-sections", branchId],
    queryFn: () => getActiveFieldSections(branchId),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
        <AlertTriangle className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Couldn't load fields. Please try again.</p>
        <button onClick={() => refetch()} className="text-sm font-medium text-primary underline underline-offset-4">
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        No fields are available at this branch right now.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {data.map((section) => (
        <Card
          key={section.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(section)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(section)}
          className="group cursor-pointer transition-all hover:border-primary hover:shadow-md focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardContent className="flex h-full flex-col justify-between gap-3 py-2">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="size-3.5" />
                {section.fieldType}
              </div>
              <h3 className="text-lg font-semibold">{CODE_LABEL[section.code]}</h3>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-primary">{section.priceEgp} EGP</span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
