import { alertFields, type AnamnesisField } from "@/config/card-template";
import type { FieldValue } from "@/logic/client";

/** Readable text of a card field: quick choices first, then free text, «?» when uncertain (AN2). */
export function fieldText(value: FieldValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  const parts = [...(value.choices ?? []), value.text ?? ""].map((p) => p.trim()).filter(Boolean);
  const text = parts.join(", ");
  return text && value.uncertain ? `${text} ?` : text;
}

export type SafetyAlert = { field: AnamnesisField; text: string };

/** AL2: allergies and medications to show at the top of the card; empty when nothing is recorded. */
export function safetyAlerts(anamnesis: Record<string, FieldValue> | null): SafetyAlert[] {
  return alertFields
    .map((field) => ({ field, text: fieldText(anamnesis?.[field]) }))
    .filter((alert) => alert.text !== "");
}
