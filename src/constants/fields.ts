/**
 * Static domain data: brand, branches, and their sub-fields.
 *
 * Translations: A = ملعب 5×5 الأول، B = ملعب 5×5 الثاني، AB = ملعب 9×9
 * The 9×9 (AB) is composed of the two 5×5 fields (A + B) combined.
 * This relationship is enforced at the DB level via `conflicts_with` in field_sections.
 */

/** Official brand name */
export const BRAND_NAME = "ملعب الوطن";

export type FieldType = "A" | "B" | "AB";

export interface SubField {
  id: string;
  type: FieldType;
  label: string;
  labelAr: string;
  descriptionAr?: string;
}

export interface Location {
  id: string;
  branchName: string;
  name: string;
  subFields: SubField[];
}

const SUB_FIELD_DATA: Record<FieldType, { label: string; labelAr: string; descriptionAr: string }> = {
  A: {
    label: "Field A (5v5)",
    labelAr: "ملعب 5×5 — الأول",
    descriptionAr: "ملعب خماسي مضاء بالكامل",
  },
  B: {
    label: "Field B (5v5)",
    labelAr: "ملعب 5×5 — الثاني",
    descriptionAr: "ملعب خماسي مضاء بالكامل",
  },
  AB: {
    label: "Full Field (9v9)",
    labelAr: "ملعب 9×9",
    descriptionAr: "الملعب الأول + الثاني معاً — ملعب تسعي كامل",
  },
};

function createBranch(id: string, branchName: string): Location {
  return {
    id,
    branchName,
    name: `${BRAND_NAME} - ${branchName}`,
    subFields: (["A", "B", "AB"] as const).map((type) => ({
      id: `${id}-${type.toLowerCase()}`,
      type,
      label: SUB_FIELD_DATA[type].label,
      labelAr: SUB_FIELD_DATA[type].labelAr,
      descriptionAr: SUB_FIELD_DATA[type].descriptionAr,
    })),
  };
}

export const LOCATIONS: Location[] = [
  createBranch("mubarak-al-sabeen", "السبعين"),
  createBranch("al-oula", "الأولي"),
  // Add future branches here, e.g.:
  // createBranch("nasr-city", "فرع مدينة نصر"),
];

/** Price in EGP, keyed by sub-field type. AB always equals A + B. */
export const FIELD_PRICE_EGP: Record<FieldType, number> = {
  A: 300,
  B: 300,
  AB: 600,
};

/** Arabic labels for field types */
export const FIELD_TYPE_LABEL_AR: Record<FieldType, string> = {
  A: "ملعب 5×5 — الأول",
  B: "ملعب 5×5 — الثاني",
  AB: "ملعب 9×9",
};

/** English labels kept for internal use */
export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  A: "Field A (5v5)",
  B: "Field B (5v5)",
  AB: "Full Field (9v9)",
};

/**
 * Working hours, expressed as hour-of-day (0-23) on a 24h clock.
 * All branches operate overnight: 14:00 (2 PM) through 04:00 the next day.
 */
export const WORKING_HOURS = {
  openHour: 14,  // 2:00 PM
  closeHour: 4,  // 4:00 AM (next day)
  crossesMidnight: true,
} as const;
