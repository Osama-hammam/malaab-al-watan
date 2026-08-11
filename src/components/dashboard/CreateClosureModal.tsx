import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getActiveFieldSections } from "@/services/branchesService";
import { createClosure, CLOSURE_SECTION_LABEL } from "@/services/admin/adminClosuresService";
import { cn } from "@/lib/utils";
import type { FieldSectionCode } from "@/types/database.types";

const REASON_PRESETS = ["صيانة", "مناسبة خاصة", "عطلة", "أخرى"] as const;

function defaultDateTime(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, "0")}:00`;
}

export function CreateClosureModal({
  branchId,
  date,
  onClose,
}: {
  branchId: string;
  date: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [sectionChoice, setSectionChoice] = useState<FieldSectionCode | "ALL">("ALL");
  const [startsAt, setStartsAt] = useState(defaultDateTime(date, 14));
  const [endsAt, setEndsAt] = useState(defaultDateTime(date, 15));
  const [reasonPreset, setReasonPreset] = useState<string>(REASON_PRESETS[0]);
  const [customReason, setCustomReason] = useState("");

  const sectionsQuery = useQuery({
    queryKey: ["field-sections", branchId],
    queryFn: () => getActiveFieldSections(branchId),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const section = sectionChoice === "ALL" ? null : sectionsQuery.data?.find((s) => s.code === sectionChoice);
      const fieldSectionId = sectionChoice === "ALL" ? null : (section?.id ?? null);
      const reason = reasonPreset === "أخرى" ? customReason.trim() || "أخرى" : reasonPreset;

      return createClosure({
        branchId,
        fieldSectionId,
        reason,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
    },
    onSuccess: () => {
      toast.success("تم إنشاء الإغلاق");
      void queryClient.invalidateQueries({ queryKey: ["admin", "schedule"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "closures"] });
      onClose();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "تعذر إنشاء الإغلاق";
      toast.error(message);
    },
  });

  const isEndBeforeStart = new Date(endsAt) <= new Date(startsAt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        dir="rtl"
        lang="ar"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-background shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <p className="font-semibold">إغلاق جديد</p>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          <div>
            <Label className="mb-2 block">اختر الملعب</Label>
            <div className="flex flex-wrap gap-2">
              {(["A", "B", "AB", "ALL"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setSectionChoice(code)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    sectionChoice === code
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input hover:bg-accent"
                  )}
                >
                  {CLOSURE_SECTION_LABEL[code]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startsAt">من</Label>
              <Input
                id="startsAt"
                type="datetime-local"
                dir="ltr"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endsAt">إلى</Label>
              <Input
                id="endsAt"
                type="datetime-local"
                dir="ltr"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
          {isEndBeforeStart && <p className="text-xs text-destructive">وقت النهاية يجب أن يكون بعد وقت البداية</p>}

          <div>
            <Label className="mb-2 block">السبب</Label>
            <div className="flex flex-wrap gap-2">
              {REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReasonPreset(preset)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    reasonPreset === preset
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input hover:bg-accent"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            {reasonPreset === "أخرى" && (
              <Input
                className="mt-2"
                placeholder="اكتب السبب"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
          </div>

          <Button
            disabled={isEndBeforeStart || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="mt-1"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            إنشاء الإغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}
