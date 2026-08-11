import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveBranches } from "@/services/branchesService";

export function BranchFilter({
  value,
  onChange,
  allLabel = "الكل",
}: {
  value: string | null;
  onChange: (branchId: string | null) => void;
  allLabel?: string;
}) {
  const { data, isLoading } = useQuery({ queryKey: ["branches"], queryFn: getActiveBranches });

  if (isLoading) return <Skeleton className="h-9 w-48" />;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
          value === null ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent"
        )}
      >
        {allLabel}
      </button>
      {(data ?? []).map((branch) => (
        <button
          key={branch.id}
          type="button"
          onClick={() => onChange(branch.id)}
          dir="rtl"
          lang="ar"
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            value === branch.id ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent"
          )}
        >
          {branch.name}
        </button>
      ))}
    </div>
  );
}
