import { describe, expect, it } from "vitest";
import type { StockHistoryEntry } from "./stock";
import { mergeHistory, summarizeChanges, type StockChange } from "./stock-changes";

const tz = "Europe/Warsaw";
const change = (at: string, source: StockChange["source"], action: StockChange["action"], extra: Partial<StockChange> = {}): StockChange => ({
  at,
  source,
  action,
  visitId: "v1",
  visitDate: "2026-11-05",
  newVisitDate: null,
  oldQuantity: null,
  newQuantity: null,
  rowDate: null,
  ...extra,
});

describe("SK4: журнал изменений", () => {
  it("SK4: one save of a visit (rows removed and added again) is one line «20 → 25»; the same quantity again is no change", () => {
    const lines = summarizeChanges(
      [
        change("2026-11-08T13:02:00Z", "visit_item", "delete", { oldQuantity: "20" }),
        change("2026-11-08T13:02:01Z", "visit_item", "insert", { newQuantity: "25" }),
        change("2026-11-08T15:00:00Z", "visit_item", "delete", { oldQuantity: "25" }),
        change("2026-11-08T15:00:01Z", "visit_item", "insert", { newQuantity: "25" }),
      ],
      tz,
    );
    expect(lines).toEqual([{ date: "2026-11-08", time: "14:02", kind: "visitChanged", of: "2026-11-05", from: "20", to: "25" }]);
  });

  it("SK4: a visit created and corrected a minute later – the correction is its own line", () => {
    const lines = summarizeChanges(
      [
        change("2026-11-05T09:00:00Z", "visit_item", "insert", { newQuantity: "20" }),
        change("2026-11-05T09:01:00Z", "visit_item", "delete", { oldQuantity: "20" }),
        change("2026-11-05T09:01:01Z", "visit_item", "insert", { newQuantity: "25" }),
      ],
      tz,
    );
    expect(lines.map((l) => [l.kind, l.from, l.to])).toEqual([["visitChanged", "20", "25"]]);
  });

  it("SK4: a visit entered later than its date, a preparation taken out, a date change, a deleted visit", () => {
    const lines = summarizeChanges(
      [
        change("2026-11-05T09:00:00Z", "visit_item", "insert", { newQuantity: "20" }),
        change("2026-11-08T09:00:00Z", "visit_item", "insert", { visitId: "v2", visitDate: "2026-11-03", newQuantity: "15" }),
        change("2026-11-09T09:00:00Z", "visit", "update", { visitDate: "2026-11-05", newVisitDate: "2026-11-04", oldQuantity: "20", newQuantity: "20" }),
        change("2026-11-09T09:00:01Z", "visit_item", "delete", { visitDate: "2026-11-04", oldQuantity: "20" }),
        change("2026-11-09T09:00:02Z", "visit_item", "insert", { visitDate: "2026-11-04", newQuantity: "20" }),
        change("2026-11-10T09:00:00Z", "visit_item", "delete", { visitId: "v2", visitDate: "2026-11-03", oldQuantity: "15" }),
        change("2026-11-11T09:00:00Z", "visit", "delete", { visitDate: "2026-11-04", oldQuantity: "20" }),
        change("2026-11-12T09:00:00Z", "receipt", "delete", { visitId: null, visitDate: null, rowDate: "2026-11-01" }),
      ],
      tz,
    );
    expect(lines.map((l) => [l.date, l.kind, l.of, l.from, l.to])).toEqual([
      ["2026-11-12", "receiptDeleted", "2026-11-01", null, null],
      ["2026-11-11", "visitDeleted", "2026-11-04", "20", null],
      ["2026-11-10", "visitRemoved", "2026-11-03", "15", null],
      ["2026-11-09", "visitDate", "2026-11-05", "2026-11-05", "2026-11-04"],
      ["2026-11-08", "visitAdded", "2026-11-03", null, "15"],
    ]);
  });

  it("SK4: changes and stock events in one list, newest first, a change before the events of its day", () => {
    const entry = (date: string): StockHistoryEntry => ({ date, kind: "visit", change: -1, vials: null, balance: 1, text: null });
    const line = summarizeChanges([change("2026-11-05T09:00:00Z", "visit", "delete", { oldQuantity: "1" })], tz)[0];
    expect(mergeHistory([entry("2026-11-06"), entry("2026-11-05"), entry("2026-11-04")], [line]).map((r) => (r.type === "change" ? "change" : r.entry.date))).toEqual([
      "2026-11-06",
      "change",
      "2026-11-05",
      "2026-11-04",
    ]);
  });
});
