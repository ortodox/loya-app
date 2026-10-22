import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import pl from "../../messages/pl.json";
import ru from "../../messages/ru.json";
import uk from "../../messages/uk.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("messages", () => {
  it("all locales have the same keys as Russian", () => {
    const expected = keys(ru).sort();
    for (const m of [uk, pl, en]) expect(keys(m).sort()).toEqual(expected);
  });
});

describe("AG1: age plural forms", () => {
  const age = (messages: typeof ru, locale: string, n: number) =>
    createTranslator({ locale, messages, namespace: "clients" })("age", { age: n });

  it("AG1: Russian uses год / года / лет", () => {
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25, 101].map((n) => age(ru, "ru", n))).toEqual([
      "1 год",
      "2 года",
      "4 года",
      "5 лет",
      "11 лет",
      "12 лет",
      "21 год",
      "22 года",
      "25 лет",
      "101 год",
    ]);
  });

  it("AG1: Ukrainian, Polish and English plurals", () => {
    expect([1, 3, 5, 22].map((n) => age(uk, "uk", n))).toEqual(["1 рік", "3 роки", "5 років", "22 роки"]);
    expect([1, 3, 5, 22].map((n) => age(pl, "pl", n))).toEqual(["1 rok", "3 lata", "5 lat", "22 lata"]);
    expect([1, 3].map((n) => age(en, "en", n))).toEqual(["1 year", "3 years"]);
  });
});
