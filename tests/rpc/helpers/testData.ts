import { pool } from "./db";

export interface SectionRef {
  id: string;
  branchId: string;
}

export interface SeededFixtures {
  mubarak: { branchId: string; a: SectionRef; b: SectionRef; ab: SectionRef };
  oula: { branchId: string; a: SectionRef; b: SectionRef; ab: SectionRef };
}

async function getSection(branchSlug: string, code: "A" | "B" | "AB"): Promise<SectionRef> {
  const { rows } = await pool.query<{ id: string; branch_id: string }>(
    `select fs.id, fs.branch_id
       from field_sections fs
       join branches b on b.id = fs.branch_id
      where b.slug = $1 and fs.code = $2`,
    [branchSlug, code]
  );
  if (rows.length === 0) {
    throw new Error(`Seed data missing: ${branchSlug}/${code}. Run the migrations + seed.sql first.`);
  }
  return { id: rows[0].id, branchId: rows[0].branch_id };
}

/** Loads the real seeded branch/section ids so tests never hardcode UUIDs. */
export async function loadFixtures(): Promise<SeededFixtures> {
  const [mA, mB, mAB, oA, oB, oAB] = await Promise.all([
    getSection("mubarak-al-sabeen", "A"),
    getSection("mubarak-al-sabeen", "B"),
    getSection("mubarak-al-sabeen", "AB"),
    getSection("al-oula", "A"),
    getSection("al-oula", "B"),
    getSection("al-oula", "AB"),
  ]);

  return {
    mubarak: { branchId: mA.branchId, a: mA, b: mB, ab: mAB },
    oula: { branchId: oA.branchId, a: oA, b: oB, ab: oAB },
  };
}

let counter = 0;
/** A unique session id per call, so tests never collide on booking_locks.session_id. */
export function freshSessionId(): string {
  counter += 1;
  return `test-session-${Date.now()}-${counter}`;
}
