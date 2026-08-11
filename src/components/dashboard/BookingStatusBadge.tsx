import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/types/database.types";

const STATUS_CONFIG: Record<BookingStatus, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" }> = {
  pending: { label: "قيد الانتظار", variant: "warning" },
  confirmed: { label: "مؤكد", variant: "success" },
  completed: { label: "مكتمل", variant: "secondary" },
  cancelled: { label: "ملغي", variant: "destructive" },
  no_show: { label: "لم يحضر", variant: "destructive" },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
