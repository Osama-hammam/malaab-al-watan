import { useState } from "react";
import { format, addDays } from "date-fns";
import { arEG } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { getActiveBranches, getActiveFieldSections } from "@/services/branchesService";
import { useSlotGrid } from "@/hooks/useSlotGrid";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function HomeScheduleWidget() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const branches = await getActiveBranches();
      if (branches.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branches[0].id);
      }
      return branches;
    },
  });

  const sectionsQuery = useQuery({
    queryKey: ["sections", selectedBranchId],
    queryFn: () => getActiveFieldSections(selectedBranchId!),
    enabled: Boolean(selectedBranchId),
  });

  // For simplicity, we just pick the first section (e.g. A or AB) to show general availability
  const firstSection = sectionsQuery.data?.[0];

  const { slots, isLoading: isSlotsLoading } = useSlotGrid({
    branchId: selectedBranchId,
    fieldSectionId: firstSection?.id ?? null,
    date: format(selectedDate, "yyyy-MM-dd"),
  });

  const isInitialLoading = branchesQuery.isLoading || (sectionsQuery.isLoading && Boolean(selectedBranchId));

  if (isInitialLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (branchesQuery.isError || branchesQuery.data?.length === 0) {
    return null; // DB not configured yet or no branches
  }

  const today = new Date();
  const tomorrow = addDays(today, 1);
  const DATES = Array.from({ length: 7 }).map((_, i) => addDays(today, i));

  return (
    <div className="rounded-3xl border-2 bg-card p-5 shadow-sm sm:p-7" dir="rtl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarIcon className="size-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-foreground">مواعيد اليوم</h2>
          <p className="text-sm text-muted-foreground">شاهد الأوقات المتاحة للحجز المباشر</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Branch Selector */}
        <div className="flex flex-wrap gap-2">
          {branchesQuery.data?.map((branch) => (
            <Button
              key={branch.id}
              variant={selectedBranchId === branch.id ? "default" : "outline"}
              className={`rounded-xl px-4 transition-all ${
                selectedBranchId === branch.id ? "shadow-md shadow-primary/20" : ""
              }`}
              onClick={() => setSelectedBranchId(branch.id)}
            >
              <MapPin className={`mr-2 size-4 ${selectedBranchId === branch.id ? "" : "text-muted-foreground"}`} />
              {branch.name.replace("ملعب الوطن — ", "")}
            </Button>
          ))}
        </div>

        {/* Date Selector */}
        <div className="flex flex-wrap gap-2 justify-end">
          {DATES.map((d) => {
            const isSelected = format(d, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
            const label = format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd") 
                ? "اليوم" 
                : format(d, "yyyy-MM-dd") === format(tomorrow, "yyyy-MM-dd") 
                  ? "غداً" 
                  : format(d, "EEEE", { locale: arEG });
            return (
              <Button
                key={format(d, "yyyy-MM-dd")}
                variant={isSelected ? "secondary" : "ghost"}
                className={`rounded-xl px-4 ${isSelected ? "font-bold text-primary" : "text-muted-foreground"}`}
                onClick={() => setSelectedDate(d)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="relative min-h-[120px] rounded-2xl bg-muted/30 p-4">
        {isSlotsLoading ? (
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-12 w-28 rounded-xl" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm font-medium text-muted-foreground">
            لا توجد مواعيد متاحة في هذا اليوم
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            <AnimatePresence mode="popLayout">
              {slots.map((slot, index) => {
                const dateStart = new Date(slot.start);
                const isAvailable = slot.status === "available";
                
                return (
                  <motion.div
                    key={slot.start}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 p-3 text-center transition-all ${
                      isAvailable
                        ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                        : "border-transparent bg-muted/60 text-muted-foreground opacity-60"
                    }`}
                  >
                    <span className="text-lg font-black tracking-tight" dir="ltr">
                      {format(dateStart, "hh:mm")}
                    </span>
                    <span className="text-xs font-bold uppercase opacity-80">
                      {format(dateStart, "aa")}
                    </span>
                    <Badge
                      variant="outline"
                      className={`mt-2 border-0 text-[10px] ${
                        isAvailable ? "bg-green-500/20 text-green-700 dark:text-green-400" : "bg-muted-foreground/10"
                      }`}
                    >
                      {isAvailable ? "متاح" : "محجوز"}
                    </Badge>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
