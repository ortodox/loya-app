import { describe, expect, it } from "vitest";
import { initials, thumbPath, thumbUrl } from "./thumbnails";

describe("FK2: маленькие копии фото", () => {
  it("FK2: the small copy sits next to the original", () => {
    expect(thumbPath("doc/client-photos/c1/abc.jpg")).toBe("doc/client-photos/c1/abc-t.jpg");
  });

  it("FK2: the card shows the small copy, or the original for older photos without one", () => {
    const urls = { "a.jpg": "https://full/a", "a-t.jpg": "https://thumb/a", "b.jpg": "https://full/b" };
    expect(thumbUrl(urls, "a.jpg")).toBe("https://thumb/a");
    expect(thumbUrl(urls, "b.jpg")).toBe("https://full/b");
    expect(thumbUrl(urls, "c.jpg")).toBeNull();
  });
});

describe("FK1: фото клиента в списке", () => {
  it("FK1: initials stand in for a missing photo", () => {
    expect(initials("Анна Выдуманная")).toBe("АВ");
    expect(initials("  вера  ")).toBe("В");
    expect(initials("Анна Мария Иванова")).toBe("АМ");
  });
});
