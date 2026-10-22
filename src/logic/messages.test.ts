import { describe, expect, it } from "vitest";
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
