import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Save } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllSettings, updateSettingValue, type AdminSetting } from "@/services/admin/adminSettingsService";
import type { Json } from "@/types/database.types";

const SETTING_LABELS: Record<string, string> = {
  brand_name: "اسم العلامة التجارية",
  vodafone_cash_number: "رقم فودافون كاش",
  whatsapp_number: "رقم الواتساب",
  lock_duration_minutes: "مدة الحجز المؤقت (دقائق)",
  slot_granularity_minutes: "مدة الفترة الزمنية (دقائق)",
  working_hours: "ساعات العمل",
  branch_visibility_mode: "وضع ظهور الفروع",
};

function SettingEditor({ setting }: { setting: AdminSetting }) {
  const queryClient = useQueryClient();
  const isSimpleValue = typeof setting.value === "string" || typeof setting.value === "number";
  const [draft, setDraft] = useState(isSimpleValue ? String(setting.value) : JSON.stringify(setting.value, null, 2));

  const mutation = useMutation({
    mutationFn: (value: Json) => updateSettingValue(setting.key, value),
    onSuccess: () => {
      toast.success("تم الحفظ");
      void queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
    onError: () => toast.error("تعذر الحفظ — تأكد من صحة القيمة"),
  });

  function handleSave() {
    if (isSimpleValue) {
      const parsed = typeof setting.value === "number" ? Number(draft) : draft;
      if (typeof setting.value === "number" && Number.isNaN(parsed as number)) {
        toast.error("القيمة يجب أن تكون رقمًا");
        return;
      }
      mutation.mutate(parsed as Json);
    } else {
      try {
        mutation.mutate(JSON.parse(draft));
      } catch {
        toast.error("صيغة JSON غير صحيحة");
      }
    }
  }

  const isDirty = isSimpleValue ? draft !== String(setting.value) : draft !== JSON.stringify(setting.value, null, 2);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-2">
        <Label htmlFor={setting.key}>{SETTING_LABELS[setting.key] ?? setting.key}</Label>
        {setting.description && <p className="text-xs text-muted-foreground">{setting.description}</p>}
        {isSimpleValue ? (
          <Input id={setting.key} dir="auto" value={draft} onChange={(e) => setDraft(e.target.value)} />
        ) : (
          <textarea
            id={setting.key}
            dir="ltr"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        )}
        <Button
          size="sm"
          className="mt-1 self-start"
          disabled={!isDirty || mutation.isPending}
          onClick={handleSave}
        >
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          حفظ
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardSettings() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: getAllSettings,
  });

  return (
    <div dir="rtl" lang="ar" className="p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">الإعدادات</h1>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <AlertTriangle className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">تعذر تحميل الإعدادات.</p>
          <button onClick={() => refetch()} className="text-sm font-medium text-primary underline underline-offset-4">
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(data ?? []).map((setting) => (
            <SettingEditor key={setting.key} setting={setting} />
          ))}
        </div>
      )}
    </div>
  );
}
