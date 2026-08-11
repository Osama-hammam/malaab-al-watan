import { supabase } from "@/config/supabase";

export interface WorkingHoursSetting {
  openHour: number;
  closeHour: number;
  timezoneOffsetHours: number;
}

/**
 * Fetches every public setting as a plain key->value map (values are
 * already-parsed JSON, e.g. a string, number, or object depending on the
 * setting). Use the typed helpers below for the settings the frontend is
 * expected to actually need; fall back to this for anything else.
 */
export async function getPublicSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) throw error;

  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
}

export async function getWorkingHours(): Promise<WorkingHoursSetting> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "working_hours")
    .single();
  if (error) throw error;

  const value = data.value as { open_hour: number; close_hour: number; timezone_offset_hours: number };
  return {
    openHour: value.open_hour,
    closeHour: value.close_hour,
    timezoneOffsetHours: value.timezone_offset_hours,
  };
}

export async function getBrandName(): Promise<string> {
  const { data, error } = await supabase.from("settings").select("value").eq("key", "brand_name").single();
  if (error) throw error;
  return data.value as string;
}

export async function getLockDurationMinutes(): Promise<number> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "lock_duration_minutes")
    .single();
  if (error) throw error;
  return data.value as number;
}

export async function getVodafoneCashNumber(): Promise<string> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "vodafone_cash_number")
    .single();
  if (error) throw error;
  return data.value as string;
}

export async function getSlotGranularityMinutes(): Promise<number> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "slot_granularity_minutes")
    .single();
  if (error) throw error;
  return data.value as number;
}
