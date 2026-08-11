import { supabase } from "@/config/supabase";
import type { Json } from "@/types/database.types";

export interface AdminSetting {
  key: string;
  value: Json;
  description: string | null;
  isPublic: boolean;
  updatedAt: string;
}

/** Admins see ALL settings (including is_public=false ones) via settings_select_public_or_admin RLS. */
export async function getAllSettings(): Promise<AdminSetting[]> {
  const { data, error } = await supabase.from("settings").select("*").order("key", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    key: row.key,
    value: row.value,
    description: row.description,
    isPublic: row.is_public,
    updatedAt: row.updated_at,
  }));
}

/** Relies on settings_admin_write RLS. Takes effect immediately for every subsequent RPC call that reads this setting — no redeploy needed. */
export async function updateSettingValue(key: string, value: Json): Promise<void> {
  const { error } = await supabase.from("settings").update({ value }).eq("key", key);
  if (error) throw error;
}
