import { supabase } from "@/config/supabase";
import type { FieldSectionCode } from "@/types/database.types";

export interface AdminClosure {
  id: string;
  branchId: string;
  fieldSectionId: string | null; // null = whole-branch closure
  reason: string | null;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

function mapRow(row: {
  id: string;
  branch_id: string;
  field_section_id: string | null;
  reason: string | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
}): AdminClosure {
  return {
    id: row.id,
    branchId: row.branch_id,
    fieldSectionId: row.field_section_id,
    reason: row.reason,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  };
}

/**
 * Relies entirely on the existing closed_slots_admin_all RLS policy
 * (Phase 2) — reviewed and determined sufficient for this milestone, no
 * new RPC needed. Validation (time order, section/branch consistency) is
 * already enforced by DB constraints/triggers; created_by is populated
 * server-side via a column DEFAULT (Phase 4.3), never client-supplied.
 */
export async function getClosuresForBranch(params: {
  branchId: string;
  fromDate?: string;
  toDate?: string;
}): Promise<AdminClosure[]> {
  let query = supabase
    .from("closed_slots")
    .select("*")
    .eq("branch_id", params.branchId)
    .order("starts_at", { ascending: true });

  if (params.fromDate) query = query.gte("starts_at", `${params.fromDate}T00:00:00Z`);
  if (params.toDate) query = query.lte("starts_at", `${params.toDate}T23:59:59Z`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export interface CreateClosureInput {
  branchId: string;
  /** null = closes the entire branch (all sections). A specific id closes just that section. */
  fieldSectionId: string | null;
  reason: string;
  startsAt: string;
  endsAt: string;
}

export async function createClosure(input: CreateClosureInput): Promise<AdminClosure> {
  const { data, error } = await supabase
    .from("closed_slots")
    .insert({
      branch_id: input.branchId,
      field_section_id: input.fieldSectionId,
      reason: input.reason,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function deleteClosure(id: string): Promise<void> {
  const { error } = await supabase.from("closed_slots").delete().eq("id", id);
  if (error) throw error;
}

export const CLOSURE_SECTION_LABEL: Record<FieldSectionCode | "ALL", string> = {
  A: "ملعب A",
  B: "ملعب B",
  AB: "الملعب كامل (A+B)",
  ALL: "الفرع بالكامل",
};
