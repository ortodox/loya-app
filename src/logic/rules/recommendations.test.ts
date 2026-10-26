import { describe, expect, it } from "vitest";
import { mergeRecommendations, recommendationUpdate } from "./recommendations";

const botox = { ru: "Не ложиться 4 часа.\nНе посещать сауну 24–48 часов.", uk: "Не лягати 4 години." };
const filler = { ru: "Не наносить макияж 12 часов.\nНе посещать сауну 24–48 часов." };

describe("P5: рекомендации после процедуры", () => {
  it("P5: combines the advice of all chosen preparations and removes repeated lines", () => {
    expect(mergeRecommendations([botox, filler], "ru")).toBe(
      "Не ложиться 4 часа.\nНе посещать сауну 24–48 часов.\nНе наносить макияж 12 часов.",
    );
  });

  it("P5: uses the client's language, with Russian as the fallback per preparation", () => {
    expect(mergeRecommendations([botox, filler], "uk")).toBe(
      "Не лягати 4 години.\nНе наносить макияж 12 часов.\nНе посещать сауну 24–48 часов.",
    );
  });

  it("P5: treats lines that differ only in case or a final full stop as the same", () => {
    expect(mergeRecommendations([{ ru: "SPF 50 ежедневно." }, { ru: "spf 50 ежедневно" }], "ru")).toBe("SPF 50 ежедневно.");
  });

  it("P5: is empty when no preparation has advice", () => {
    expect(mergeRecommendations([null, {}], "pl")).toBe("");
  });

  it("P5: fills in automatically while the doctor has not edited the text", () => {
    expect(recommendationUpdate("", "", "SPF 50")).toBe("replace");
    expect(recommendationUpdate("SPF 50", "SPF 50", "SPF 50\nНе посещать сауну")).toBe("replace");
  });

  it("P5: never overwrites text the doctor edited herself – asks «Обновить рекомендации?»", () => {
    expect(recommendationUpdate("SPF 50\nМой совет", "SPF 50", "SPF 50\nСауна")).toBe("ask");
  });

  it("P5: nothing to do when the suggestion equals the current text", () => {
    expect(recommendationUpdate("SPF 50\n", "x", "SPF 50")).toBe("keep");
  });
});
