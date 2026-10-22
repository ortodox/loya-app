import { alertFields, type AlertField } from "@/config/kartaTemplate";
import type { Anamnesis } from "@/logic/client";
import { fieldText } from "./anamnesis";

export type SafetyAlert = { field: AlertField; text: string };

/** AL2: «Аллергоанамнез» and «Принимаемые препараты» for the top of the card; empty when not filled. */
export function safetyAlerts(anamnesis: Anamnesis | null): SafetyAlert[] {
  return alertFields
    .map((field) => ({ field, text: fieldText(anamnesis?.[field]) }))
    .filter((alert) => alert.text !== "");
}
