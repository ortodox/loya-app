// Order and keys of «Карта клиента» as in the doctor's Notes template (roadmap_ru.md, MVP 1a).
// Labels live in messages/*.json under card.fields.<key>.

/** Section 1 «Карта клиента». */
export const cardSection1 = ["date", "fullName", "age", "phone", "language", "complaints"] as const;
export type CardSection1Field = (typeof cardSection1)[number];

/** Section 2 «Состояние здоровья» (anamnesis), filled in task 3. */
export const anamnesisFields = [
  "bloodPressure",
  "endocrine",
  "gastro",
  "cardiovascular",
  "genitourinary",
  "respiratory",
  "injuriesSurgeries",
  "allergies",
  "medications",
] as const;
export type AnamnesisField = (typeof anamnesisFields)[number];

/** Anamnesis fields shown as a safety alert at the top of the card (AL2). */
export const alertFields = ["allergies", "medications"] as const satisfies readonly AnamnesisField[];
