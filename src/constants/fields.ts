/**
 * Static domain data: brand, branches, and their sub-fields.
 *
 * This is intentionally hard-coded for now (not fetched from the DB)
 * since no tables exist yet. Once a `locations` / `sub_fields` schema
 * is designed, this module can be swapped for a data-fetching hook
 * (e.g. `useBranches()`) with the same exported shape, so nothing that
 * consumes `LOCATIONS`, `FIELD_TYPE_LABEL`, or `FIELD_PRICE_EGP`
 * elsewhere in the app has to change.
 */

/** Official brand name, used as the prefix for every branch's display name. */
export const BRAND_NAME = "ملعب الوطن";

export type FieldType = "A" | "B" | "AB";

export interface SubField {
  id: string;
  type: FieldType;
  label: string;
}

export interface Location {
  id: string;
  /** Branch name only, e.g. "فرع مبارك السبعين" (without the brand prefix). */
  branchName: string;
  /** Full display name: `${BRAND_NAME} - ${branchName}`. */
  name: string;
  subFields: SubField[];
}

const SUB_FIELD_LABEL: Record<FieldType, string> = {
  A: "A (5v5)",
  B: "B (5v5)",
  AB: "AB (7v7)",
};

/**
 * Every branch has the same three sub-fields (A, B, AB), so a new branch
 * is defined in one line — see `LOCATIONS` below — rather than repeating
 * this boilerplate. To add a branch in the future, just add another
 * `createBranch(...)` call to the `LOCATIONS` array.
 */
function createBranch(id: string, branchName: string): Location {
  return {
    id,
    branchName,
    name: `${BRAND_NAME} - ${branchName}`,
    subFields: (["A", "B", "AB"] as const).map((type) => ({
      id: `${id}-${type.toLowerCase()}`,
      type,
      label: SUB_FIELD_LABEL[type],
    })),
  };
}

export const LOCATIONS: Location[] = [
  createBranch("mubarak-al-sabeen", "فرع مبارك السبعين"),
  createBranch("al-oula", "فرع الأولى"),
  // Add future branches here, e.g.:
  // createBranch("nasr-city", "فرع مدينة نصر"),
];

/** Price in EGP, keyed by sub-field type. AB always equals A + B. */
export const FIELD_PRICE_EGP: Record<FieldType, number> = {
  A: 300,
  B: 300,
  AB: 600,
};

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  A: "Half field (5v5)",
  B: "Half field (5v5)",
  AB: "Full field (7v7)",
};

/**
 * Working hours, expressed as hour-of-day (0-23) on a 24h clock.
 * All branches operate overnight: 14:00 (2 PM) through 04:00 the next day.
 * `crossesMidnight: true` signals to any future slot-generation logic
 * that the closing hour is on the following calendar day.
 */
export const WORKING_HOURS = {
  openHour: 14, // 2:00 PM
  closeHour: 4, // 4:00 AM (next day)
  crossesMidnight: true,
} as const;
