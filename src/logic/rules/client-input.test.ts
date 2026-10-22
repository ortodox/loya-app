import { describe, expect, it } from "vitest";
import { parseClientForm } from "./client-input";

const today = "2026-10-22";

describe("PR1: create client", () => {
  it("PR1: needs only the name and fills in today and Russian", () => {
    const result = parseClientForm({ fullName: "  Ирина   Пробная " }, today);
    expect(result).toEqual({
      ok: true,
      input: {
        fullName: "Ирина Пробная",
        cardDate: today,
        ageAtRegistration: null,
        birthDate: null,
        phone: null,
        language: "ru",
        notes: null,
      },
    });
  });

  it("PR1: rejects a missing name", () => {
    expect(parseClientForm({ fullName: "   " }, today)).toEqual({
      ok: false,
      errors: { fullName: "nameRequired" },
    });
  });

  it("PR1: keeps optional fields", () => {
    const result = parseClientForm(
      {
        fullName: "Ольга Вымышленная",
        cardDate: "2026-09-01",
        age: "42",
        phone: "+48 600 000 000",
        language: "uk",
        notes: "Первая строка\nвторая\n\n",
      },
      today,
    );
    expect(result.ok && result.input).toMatchObject({
      cardDate: "2026-09-01",
      ageAtRegistration: 42,
      phone: "+48 600 000 000",
      language: "uk",
      notes: "Первая строка\nвторая",
    });
  });

  it("PR1: accepts a birth date instead of an age", () => {
    const result = parseClientForm({ fullName: "Анна Условная", birthDate: "1988-04-12" }, today);
    expect(result.ok && result.input).toMatchObject({ birthDate: "1988-04-12", ageAtRegistration: null });
  });

  it("PR1: does not accept both age and birth date", () => {
    const result = parseClientForm({ fullName: "Анна", age: "30", birthDate: "1990-01-01" }, today);
    expect(result).toEqual({ ok: false, errors: { birthDate: "ageAndBirthDate" } });
  });

  it("PR1: rejects impossible values", () => {
    const result = parseClientForm(
      { fullName: "Анна", cardDate: "2026-02-30", age: "4.5", language: "de" },
      today,
    );
    expect(result).toEqual({ ok: false, errors: { cardDate: "dateInvalid", age: "ageInvalid" } });
    expect(parseClientForm({ fullName: "Анна", birthDate: "2030-01-01" }, today)).toEqual({
      ok: false,
      errors: { birthDate: "birthDateInvalid" },
    });
  });
});
