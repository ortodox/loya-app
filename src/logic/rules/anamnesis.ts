import { anamnesisFields, clinicalSections, type KartaField } from "@/config/kartaTemplate";
import type { Anamnesis, FieldValue } from "@/logic/client";

/** Raw form values per field: ticked quick choices and the free text. */
export type AnamnesisForm = Record<string, { choices?: string[]; text?: string }>;

/** A field reduced to what is shown: quick choice keys and free text. */
export function normalizeField(value: FieldValue): { choices: string[]; text: string } {
  if (value == null) return { choices: [], text: "" };
  if (typeof value === "string") return { choices: [], text: value.trim() };
  return {
    choices: (value.choices ?? []).filter((c) => typeof c === "string" && c !== ""),
    text: (value.text ?? "").trim(),
  };
}

export function isFieldEmpty(value: FieldValue): boolean {
  const { choices, text } = normalizeField(value);
  return choices.length === 0 && text === "";
}

/**
 * Readable text of a field: quick choices (via `label`) then the free text, comma-separated.
 * Free text is kept as typed, including «?» for uncertainty (AN2).
 */
export function fieldText(value: FieldValue, label: (choice: string) => string = (c) => c): string {
  const { choices, text } = normalizeField(value);
  return [...choices.map(label), text].filter(Boolean).join(", ");
}

/** JA1/AN1/SK1/VI1/PH1: true when any field of a section is filled in. */
export function sectionHasContent(fields: readonly KartaField[], anamnesis: Anamnesis): boolean {
  return fields.some((f) => !isFieldEmpty(anamnesis[f.key]));
}

/**
 * Builds clients.anamnesis from the generic form.
 * - Only template fields and their template options are kept, in template order.
 * - Free text is always allowed (AN2) and trimmed; empty fields are left out.
 * - Keys that are not (or no longer) in the template are preserved from `previous`.
 */
export function parseAnamnesisForm(form: AnamnesisForm, previous: Anamnesis = {}): Anamnesis {
  const templateKeys = new Set(anamnesisFields.map((f) => f.key));
  const result: Anamnesis = Object.fromEntries(
    Object.entries(previous).filter(([key]) => !templateKeys.has(key)),
  );
  for (const field of anamnesisFields) {
    const raw = form[field.key] ?? {};
    const ticked = new Set(raw.choices ?? []);
    const choices = field.options.filter((o) => ticked.has(o));
    const text = (raw.text ?? "").trim().slice(0, 2000);
    if (choices.length > 0 || text !== "") {
      result[field.key] = field.options.length > 0 ? { choices, text } : { text };
    }
  }
  return result;
}

/**
 * JA1/AN1/SK1/VI1/PH1: short summary of a section for its collapsed row –
 * the filled fields in template order, joined with « · », cut at `maxLength`.
 */
export function sectionPreview(
  fields: readonly KartaField[],
  anamnesis: Anamnesis,
  label: (field: string, choice: string) => string = (_, c) => c,
  maxLength = 90,
): string {
  const text = fields
    .map((f) => fieldText(anamnesis[f.key], (c) => label(f.key, c)))
    .filter(Boolean)
    .join(" · ")
    .replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

/**
 * AN3: save one section of «Анкета» on its own – its fields are taken from the form (same rules as
 * the full form), every other field stays exactly as it was.
 */
export function mergeAnamnesisSection(previous: Anamnesis, sectionKey: string, form: AnamnesisForm): Anamnesis | null {
  const section = clinicalSections.find((s) => s.key === sectionKey);
  if (!section) return null;
  const parsed = parseAnamnesisForm(form);
  const result: Anamnesis = { ...previous };
  for (const field of section.fields) {
    if (parsed[field.key] !== undefined) result[field.key] = parsed[field.key];
    else delete result[field.key];
  }
  return result;
}
