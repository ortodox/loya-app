import type { DateTimeFormatOptions } from "next-intl";

/** Date-only values are stored as `YYYY-MM-DD`; format them in UTC so the day never shifts. */
export const dateFormat: DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
};

export const isoToDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
