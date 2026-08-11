import { supabase } from "@/config/supabase";
import type { FieldSectionCode, FieldTypeCode } from "@/types/database.types";

export interface Branch {
  id: string;
  slug: string;
  name: string;
}

export interface FieldSection {
  id: string;
  branchId: string;
  code: FieldSectionCode;
  fieldType: FieldTypeCode;
  priceEgp: number;
}

/** Returns only currently-active branches. */
export async function getActiveBranches(): Promise<Branch[]> {
  const { data, error } = await supabase
    .from("branches")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({ id: row.id, slug: row.slug, name: row.name }));
}

/** Returns only currently-active field sections (A/B/AB) for one branch, in a stable A/B/AB order. */
export async function getActiveFieldSections(branchId: string): Promise<FieldSection[]> {
  const { data, error } = await supabase
    .from("field_sections")
    .select("id, branch_id, code, field_type, price_egp")
    .eq("branch_id", branchId)
    .eq("is_active", true);

  if (error) throw error;

  const codeOrder: Record<FieldSectionCode, number> = { A: 0, B: 1, AB: 2 };

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      branchId: row.branch_id,
      code: row.code,
      fieldType: row.field_type,
      priceEgp: row.price_egp,
    }))
    .sort((a, b) => codeOrder[a.code] - codeOrder[b.code]);
}
