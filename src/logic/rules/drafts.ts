/** DR1: an unsaved draft is kept on the phone for at most 7 days. */
export const draftMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

export type StoredDraft<T> = { savedAt: number; data: T };

/** DR1: a stored draft is used only when it is recent and readable; otherwise it is ignored. */
export function freshDraft<T>(raw: string | null, now: number): T | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as Partial<StoredDraft<T>>;
    if (typeof draft.savedAt !== "number" || draft.data === undefined) return null;
    if (now - draft.savedAt > draftMaxAgeMs || draft.savedAt > now + 60_000) return null;
    return draft.data;
  } catch {
    return null;
  }
}

/** DR1: form fields as stored in a draft – text by name, plus ticked checkboxes as «name=value». */
export type FormSnapshot = { values: Record<string, string>; checked: string[] };

/** DR1: a draft is worth keeping only when something was typed or ticked beyond the defaults. */
export function snapshotDiffers(snapshot: FormSnapshot, defaults: FormSnapshot): boolean {
  const keys = new Set([...Object.keys(snapshot.values), ...Object.keys(defaults.values)]);
  for (const k of keys) if ((snapshot.values[k] ?? "") !== (defaults.values[k] ?? "")) return true;
  return [...snapshot.checked].sort().join("\n") !== [...defaults.checked].sort().join("\n");
}
