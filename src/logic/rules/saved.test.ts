import { describe, expect, it } from "vitest";
import { withSaved } from "./saved";

describe("UX8: «Сохранено ✓»", () => {
  it("UX8: adds saved=1 before the anchor, after any query", () => {
    expect(withSaved("/clients/1")).toBe("/clients/1?saved=1");
    expect(withSaved("/clients/1#notes")).toBe("/clients/1?saved=1#notes");
    expect(withSaved("/shop?view=orders&new=2")).toBe("/shop?view=orders&new=2&saved=1");
    expect(withSaved("/clients/1?created=1")).toBe("/clients/1?created=1&saved=1");
  });
});
