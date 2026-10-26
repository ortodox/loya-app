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
        email: null,
        residenceCountry: null,
        residenceCity: null,
        language: "ru",
        anamnesis: {},
        notes: null,
        procedurePlan: null,
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

  it("PR1: keeps e-mail and residence (country as ISO code + optional city)", () => {
    const result = parseClientForm(
      { fullName: "Мария Придуманная", email: " maria@example.com ", residenceCountry: "UA", residenceCity: "Львов" },
      today,
    );
    expect(result.ok && result.input).toMatchObject({
      email: "maria@example.com",
      residenceCountry: "UA",
      residenceCity: "Львов",
    });
  });

  it("PR1: validates the e-mail format only when filled in", () => {
    expect(parseClientForm({ fullName: "Анна", email: "" }, today).ok).toBe(true);
    for (const email of ["anna", "anna@", "anna@example", "an na@example.com"]) {
      expect(parseClientForm({ fullName: "Анна", email }, today)).toEqual({
        ok: false,
        errors: { email: "emailInvalid" },
      });
    }
  });

  it("PR1: rejects a country that is not an ISO code", () => {
    expect(parseClientForm({ fullName: "Анна", residenceCountry: "Польша" }, today)).toEqual({
      ok: false,
      errors: { residenceCountry: "countryInvalid" },
    });
  });

  it("PP1: keeps the client's procedure plan as multi-line free text", () => {
    const result = parseClientForm({ fullName: "Анна", procedurePlan: "Ноябрь – биоревитализация\nДекабрь – ботокс\n\n" }, today);
    expect(result.ok && result.input.procedurePlan).toBe("Ноябрь – биоревитализация\nДекабрь – ботокс");
  });
});
