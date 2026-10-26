import { describe, expect, it } from "vitest";
import { contactLinks } from "./contacts";

describe("KT1: контакты одним нажатием", () => {
  it("KT1: builds call, WhatsApp, Telegram and Viber links from the phone number", () => {
    expect(contactLinks("+48 600-123-456")).toEqual({
      call: "tel:+48600123456",
      whatsapp: "https://wa.me/48600123456",
      telegram: "https://t.me/+48600123456",
      viber: "viber://chat?number=%2B48600123456",
    });
  });

  it("KT1: treats «00» in front as «+»", () => {
    expect(contactLinks("0048 600 123 456")?.call).toBe("tel:+48600123456");
  });

  it("KT1: no links without a usable number", () => {
    expect(contactLinks(null)).toBeNull();
    expect(contactLinks("?")).toBeNull();
    expect(contactLinks("12")).toBeNull();
  });
});
