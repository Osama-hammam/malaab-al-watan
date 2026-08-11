import { supabase } from "@/config/supabase";
import type { PaymentMethodCode } from "@/types/database.types";

export interface PaymentMethod {
  code: PaymentMethodCode;
  labelAr: string;
  sortOrder: number;
}

/** Returns only currently-active payment methods, in display order. */
export async function getActivePaymentMethods(): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("code, label_ar, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    code: row.code,
    labelAr: row.label_ar,
    sortOrder: row.sort_order,
  }));
}
