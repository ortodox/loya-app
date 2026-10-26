import { describe, expect, it } from "vitest";
import { draftMaxAgeMs, freshDraft, snapshotDiffers } from "./drafts";

describe("DR1: черновик визита и клиента", () => {
  const now = Date.UTC(2026, 9, 28, 12);

  it("DR1: restores a recent draft", () => {
    expect(freshDraft(JSON.stringify({ savedAt: now - 60_000, data: { notes: "Звонок" } }), now)).toEqual({ notes: "Звонок" });
  });

  it("DR1: ignores drafts older than 7 days, broken data and nothing stored", () => {
    expect(freshDraft(JSON.stringify({ savedAt: now - draftMaxAgeMs - 1, data: {} }), now)).toBeNull();
    expect(freshDraft("{not json", now)).toBeNull();
    expect(freshDraft(JSON.stringify({ data: {} }), now)).toBeNull();
    expect(freshDraft(null, now)).toBeNull();
  });

  it("DR1: keeps a draft only when something differs from the empty form", () => {
    const defaults = { values: { fullName: "", cardDate: "2026-10-28" }, checked: [] };
    expect(snapshotDiffers({ values: { fullName: "", cardDate: "2026-10-28" }, checked: [] }, defaults)).toBe(false);
    expect(snapshotDiffers({ values: { fullName: "Анна", cardDate: "2026-10-28" }, checked: [] }, defaults)).toBe(true);
    expect(snapshotDiffers({ values: defaults.values, checked: ["anamnesis.complaints.choices=акне"] }, defaults)).toBe(true);
  });
});
