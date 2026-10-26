"use client";

import { freshDraft, type FormSnapshot } from "@/logic/rules/drafts";

// DR1: unsaved drafts live only in this browser (localStorage) and are removed after saving.
// Storage can be unavailable (private mode, blocked site data), so every access is guarded.

const prefix = "loya:draft:";

export function readDraft<T>(key: string): T | null {
  try {
    return freshDraft<T>(localStorage.getItem(prefix + key), Date.now());
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, data: T): void {
  try {
    localStorage.setItem(prefix + key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // No storage: the form still works, only without a draft.
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(prefix + key);
  } catch {
    // Nothing stored.
  }
}

/** Remove every draft, e.g. when signing out on a shared device. */
export function clearAllDrafts(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(prefix)) localStorage.removeItem(k);
  } catch {
    // Nothing stored.
  }
}

const fields = (form: HTMLFormElement) =>
  [...form.elements].filter(
    (el): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
      (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) &&
      el.name !== "" &&
      !(el instanceof HTMLInputElement && ["file", "hidden", "submit", "button", "password"].includes(el.type)),
  );

/** DR1: the typed values of an uncontrolled form. */
export function snapshotForm(form: HTMLFormElement): FormSnapshot {
  const snapshot: FormSnapshot = { values: {}, checked: [] };
  for (const el of fields(form)) {
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      if (el.checked) snapshot.checked.push(`${el.name}=${el.value}`);
    } else {
      snapshot.values[el.name] = el.value;
    }
  }
  return snapshot;
}

/** DR1: put a stored draft back into an uncontrolled form. */
export function applySnapshot(form: HTMLFormElement, snapshot: FormSnapshot): void {
  const checked = new Set(snapshot.checked);
  for (const el of fields(form)) {
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      el.checked = checked.has(`${el.name}=${el.value}`);
    } else if (el.name in snapshot.values) {
      el.value = snapshot.values[el.name];
    }
  }
}
