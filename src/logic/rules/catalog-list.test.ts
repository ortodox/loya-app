import { describe, expect, it } from "vitest";
import { orderForClient, sortPreparations } from "./catalog-list";

describe("PO1: препараты клиента вверху списка", () => {
  const sorted = sortPreparations([
    { id: "a", name: "Aquashine", favorite: false },
    { id: "b", name: "Botox", favorite: true },
    { id: "p", name: "Profhilo", favorite: false },
    { id: "s", name: "Sculptra", favorite: true },
  ]);

  it("PO1: what the client had before first (latest first), then favourites, then the rest", () => {
    expect(orderForClient(sorted, ["p", "a"]).map((p) => p.id)).toEqual(["p", "a", "b", "s"]);
  });

  it("PO1: without earlier visits the order is favourites, then the rest", () => {
    expect(orderForClient(sorted, []).map((p) => p.id)).toEqual(["b", "s", "a", "p"]);
  });

  it("PO1: ignores preparations that are no longer in the catalogue", () => {
    expect(orderForClient(sorted, ["gone", "s"]).map((p) => p.id)).toEqual(["s", "b", "a", "p"]);
  });
});
