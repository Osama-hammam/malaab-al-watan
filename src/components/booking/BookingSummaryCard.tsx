import { Calendar, Clock, MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Branch, FieldSection } from "@/services/branchesService";

const CODE_LABEL: Record<FieldSection["code"], string> = {
  A: "Field A",
  B: "Field B",
  AB: "Full Field (A + B)",
};

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

export function BookingSummaryCard({
  branch,
  section,
  slot,
  price,
}: {
  branch: Branch;
  section: FieldSection;
  slot: { slotStart: string; slotEnd: string };
  price?: number;
}) {
  const start = formatDateTime(slot.slotStart);
  const end = formatDateTime(slot.slotEnd);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-2">
        <div className="flex items-center gap-2.5">
          <MapPin className="size-4 shrink-0 text-primary" />
          <span dir="rtl" lang="ar" className="font-medium">
            {branch.name}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-medium">{CODE_LABEL[section.code]}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Calendar className="size-4 shrink-0" />
          {start.date}
        </div>
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Clock className="size-4 shrink-0" />
          {start.time} – {end.time}
        </div>
        <div className="mt-1 flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-bold text-primary">{price ?? section.priceEgp} EGP</span>
        </div>
      </CardContent>
    </Card>
  );
}
