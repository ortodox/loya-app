import { describe, expect, it } from "vitest";
import { currentAge, isBirthday } from "./age";

const registered = (ageAtRegistration: number | null, cardDate: string) => ({
  birthDate: null,
  ageAtRegistration,
  cardDate,
});

describe("AG1: current age", () => {
  it("AG1: shows the recorded age on the registration day", () => {
    expect(currentAge(registered(38, "2026-10-22"), "2026-10-22")).toBe(38);
  });

  it("AG1: does not add a year before a full year has passed", () => {
    expect(currentAge(registered(38, "2025-10-23"), "2026-10-22")).toBe(38);
  });

  it("AG1: adds one year per whole year since registration", () => {
    expect(currentAge(registered(38, "2025-10-22"), "2026-10-22")).toBe(39);
    expect(currentAge(registered(41, "2023-03-15"), "2026-10-22")).toBe(44);
  });

  it("AG1: uses the birth date when it exists, ignoring the recorded age", () => {
    const source = { birthDate: "1990-10-23", ageAtRegistration: 99, cardDate: "2020-01-01" };
    expect(currentAge(source, "2026-10-22")).toBe(35);
    expect(currentAge(source, "2026-10-23")).toBe(36);
  });

  it("AG1: a 29 February birthday counts from 1 March in other years", () => {
    const source = { birthDate: "2000-02-29", ageAtRegistration: null, cardDate: "2026-01-01" };
    expect(currentAge(source, "2026-02-28")).toBe(25);
    expect(currentAge(source, "2026-03-01")).toBe(26);
  });

  it("AG1: is unknown when neither age nor birth date is recorded", () => {
    expect(currentAge(registered(null, "2026-10-22"), "2026-10-22")).toBeNull();
  });

  it("AG1: never goes below the recorded age for a future registration date", () => {
    expect(currentAge(registered(30, "2027-01-01"), "2026-10-22")).toBe(30);
  });
});

describe("BD1: день рождения", () => {
  it("BD1: only on the day itself", () => {
    expect(isBirthday("1990-11-02", "2026-11-02")).toBe(true);
    expect(isBirthday("1990-11-03", "2026-11-02")).toBe(false);
    expect(isBirthday("1990-11-01", "2026-11-02")).toBe(false);
  });
  it("BD1: no birth date (only an age) – no birthday", () => {
    expect(isBirthday(null, "2026-11-02")).toBe(false);
  });
  it("BD1: born on 29.02 – 28.02 in other years, 29.02 in leap years", () => {
    expect(isBirthday("1992-02-29", "2026-02-28")).toBe(true);
    expect(isBirthday("1992-02-29", "2028-02-28")).toBe(false);
    expect(isBirthday("1992-02-29", "2028-02-29")).toBe(true);
  });
  it("BD1: not on the day of birth itself or with a date in the future", () => {
    expect(isBirthday("2026-11-02", "2026-11-02")).toBe(false);
    expect(isBirthday("2030-11-02", "2026-11-02")).toBe(false);
  });
});
