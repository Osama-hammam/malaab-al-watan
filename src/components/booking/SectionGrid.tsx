import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, Users, Merge } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveFieldSections, type FieldSection } from "@/services/branchesService";

const CODE_LABEL_AR: Record<FieldSection["code"], string> = {
  A: "ملعب 5×5 — الأول",
  B: "ملعب 5×5 — الثاني",
  AB: "ملعب 9×9",
};

const CODE_DESC_AR: Record<FieldSection["code"], string> = {
  A: "ملعب خماسي مضاء",
  B: "ملعب خماسي مضاء",
  AB: "الأول + الثاني معاً",
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
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-10 text-center">
        <AlertTriangle className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">تعذر تحميل الملاعب. حاول مجدداً.</p>
        <button onClick={() => refetch()} className="text-sm font-semibold text-primary underline underline-offset-4">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        لا توجد ملاعب متاحة في هذا الموقع حالياً.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-muted-foreground">اختر الملعب</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {data.map((section) => (
          <Card
            key={section.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(section)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(section)}
            className={`card-hover group cursor-pointer border-2 transition-all hover:border-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              section.code === "AB" ? "sm:col-span-3 lg:col-span-1" : ""
            }`}
          >
            <CardContent className="flex h-full flex-col justify-between gap-3 py-5 px-5">
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  {section.code === "AB" ? (
                    <Merge className="size-4 text-primary" />
                  ) : (
                    <Users className="size-4 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium text-muted-foreground">
                    {CODE_DESC_AR[section.code]}
                  </span>
                </div>
                <h3 className="text-base font-black text-foreground">{CODE_LABEL_AR[section.code]}</h3>
                {section.code === "AB" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ⚡ يشمل الملعب الأول والثاني معاً
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xl font-black text-primary">{section.priceEgp} <span className="text-sm font-semibold">ج.م/ساعة</span></span>
                <ChevronLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
