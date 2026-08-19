import { Calendar, Clock, MapPin, ReceiptText } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Branch, FieldSection } from "@/services/branchesService";

const CODE_LABEL_AR: Record<FieldSection["code"], string> = {
  A: "ملعب 5×5 — الأول",
  B: "ملعب 5×5 — الثاني",
  AB: "ملعب 9×9",
};

function formatArabicDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("ar-EG", { weekday: "long", month: "long", day: "numeric" }),
    time: d.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit", hour12: true }),
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
  const start = formatArabicDateTime(slot.slotStart);
  const end = formatArabicDateTime(slot.slotEnd);

  return (
    <Card className="border-2 shadow-sm bg-card/60 backdrop-blur-sm">
      <CardContent className="flex flex-col gap-4 py-5 px-5">
        <div className="flex items-center gap-1.5 text-sm font-bold text-primary">
          <ReceiptText className="size-4" />
          <span>ملخص الحجز</span>
        </div>
        
        <div className="flex items-center gap-2.5">
          <MapPin className="size-5 shrink-0 text-muted-foreground" />
          <span dir="rtl" lang="ar" className="font-bold text-foreground">
            {branch.name}
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="font-medium text-muted-foreground">{CODE_LABEL_AR[section.code]}</span>
        </div>
        
        <div className="flex items-center gap-2.5 text-sm font-medium text-foreground">
          <Calendar className="size-5 shrink-0 text-muted-foreground" />
          {start.date}
        </div>
        
        <div className="flex items-center gap-2.5 text-sm font-medium text-foreground">
          <Clock className="size-5 shrink-0 text-muted-foreground" />
          <span dir="ltr">{start.time} – {end.time}</span>
        </div>
        
        <div className="mt-2 flex items-center justify-between border-t border-dashed pt-4">
          <span className="text-sm font-bold text-muted-foreground">الإجمالي</span>
          <div className="flex items-end gap-1 text-primary">
            <span className="text-2xl font-black leading-none">{price ?? section.priceEgp}</span>
            <span className="text-sm font-bold leading-relaxed">ج.م</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
