// «Карта клиента» as data – sections, fields and quick choices from Loya's Notes template
// (CLAUDE.md, «Малая «Карта клиента»»). Order matters: the form and the card follow it.
// Keys are stored in clients.anamnesis; labels live in messages/*.json under karta.*.

/** Section 1 «Общие данные»: stored in their own columns, not in anamnesis. */
export const generalDataFields = [
  "date",
  "fullName",
  "age",
  "phone",
  "email",
  "residence",
  "language",
] as const;
export type GeneralDataField = (typeof generalDataFields)[number];

export type KartaField = {
  key: string;
  /** Quick choices (multi-select). Free text is always allowed in addition. */
  options: readonly string[];
};

export type KartaSection = {
  key: string;
  fields: readonly KartaField[];
};

const text = (key: string): KartaField => ({ key, options: [] });

/** Clinical sections 2–6, all stored in clients.anamnesis with flat field keys. */
export const clinicalSections = [
  {
    key: "complaints",
    fields: [
      {
        key: "complaints",
        options: [
          "skinTone",
          "redness",
          "acne",
          "subcutaneousInflammation",
          "pigmentation",
          "wrinkles",
          "dryness",
          "enlargedPores",
          "gooseSkin",
        ],
      },
    ],
  },
  {
    key: "health",
    fields: [
      text("bloodPressure"),
      text("endocrine"),
      text("gastro"),
      text("cardiovascular"),
      text("genitourinary"),
      text("respiratory"),
      text("injuriesSurgeries"),
      text("allergies"),
      text("medications"),
    ],
  },
  {
    key: "skin",
    fields: [
      { key: "skinType", options: ["dry", "oily", "combination", "normal", "sensitive"] },
      { key: "skinFeatures", options: ["pigmentation", "flaking", "rashes", "scars"] },
      { key: "skinDiseases", options: ["acne", "couperose", "postAcne", "rosacea"] },
    ],
  },
  {
    key: "aging",
    fields: [
      {
        key: "agingType",
        options: ["photo", "chrono", "muscular", "fineWrinkled", "edematousDeformational"],
      },
      { key: "wrinkleTypes", options: ["static", "dynamic", "mimic", "gravitational"] },
    ],
  },
  {
    key: "previousProcedures",
    fields: [
      {
        key: "salon",
        options: [
          "cleansing",
          "peeling",
          "smas",
          "biorevitalization",
          "botox",
          "lipFillers",
          "polylacticAcid",
        ],
      },
      text("injections"),
    ],
  },
] as const satisfies readonly KartaSection[];

export type ClinicalSectionKey = (typeof clinicalSections)[number]["key"];
export type AnamnesisFieldKey = (typeof clinicalSections)[number]["fields"][number]["key"];

/** Every anamnesis field in template order. */
export const anamnesisFields: readonly KartaField[] = clinicalSections.flatMap((s) => s.fields);

/** AL2: fields shown as a safety alert at the top of the card. */
export const alertFields = ["allergies", "medications"] as const satisfies readonly AnamnesisFieldKey[];
export type AlertField = (typeof alertFields)[number];
