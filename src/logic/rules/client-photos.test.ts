import { describe, expect, it } from "vitest";
import {
  exifDate,
  parseClientPhotoForm,
  photoTimeline,
  showsClientPhotos,
  splitClientPhotos,
  suggestedPhotoDate,
} from "./client-photos";

const today = "2026-10-30";

/** A minimal JPEG start with an EXIF block, like a photo from the iPhone library. */
function jpegWithExif(tags: { original?: string; plain?: string }, littleEndian = true): Uint8Array {
  const tiff: number[] = [];
  const u16 = (v: number) => (littleEndian ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) => (littleEndian ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24] : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0);
  // IFD0 at 8: DateTime (0x0132) and the Exif pointer (0x8769); Exif IFD with DateTimeOriginal (0x9003).
  const ifd0Entries = 2;
  const ifd0Size = 2 + ifd0Entries * 12 + 4;
  const exifIfd = 8 + ifd0Size;
  const exifSize = 2 + 12 + 4;
  const plainAt = exifIfd + exifSize;
  const originalAt = plainAt + 20;
  tiff.push(...(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  tiff.push(...u16(ifd0Entries));
  tiff.push(...u16(0x0132), ...u16(2), ...u32(20), ...u32(tags.plain ? plainAt : 0));
  tiff.push(...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifIfd));
  tiff.push(...u32(0));
  tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(20), ...u32(tags.original ? originalAt : 0), ...u32(0));
  tiff.push(...ascii((tags.plain ?? "").padEnd(19, " ")), ...ascii((tags.original ?? "").padEnd(19, " ")));
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, ...[(app1.length + 2) >> 8, (app1.length + 2) & 0xff], ...app1, 0xff, 0xda, 0, 2]);
}

describe("FK2: дата съёмки из фото", () => {
  it("FK2: reads the date taken from the photo", () => {
    expect(exifDate(jpegWithExif({ original: "2026:09:14 18:02:11", plain: "2026:10:01 09:00:00" }))).toBe("2026-09-14");
    expect(exifDate(jpegWithExif({ original: "2026:09:14 18:02:11" }, false))).toBe("2026-09-14");
  });

  it("FK2: falls back to the plain date, and to nothing when the messenger removed it", () => {
    expect(exifDate(jpegWithExif({ plain: "2026:10:01 09:00:00" }))).toBe("2026-10-01");
    expect(exifDate(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBeNull();
    expect(exifDate(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(exifDate(jpegWithExif({ original: "2026:02:30 10:00:00" }))).toBeNull();
    expect(exifDate(jpegWithExif({ original: "2026:09:14 18:02:11" }).slice(0, 30))).toBeNull();
  });

  it("FK2: suggests the earliest date taken, otherwise today; never a date in the future", () => {
    expect(suggestedPhotoDate(["2026-09-20", null, "2026-09-14"], today)).toBe("2026-09-14");
    expect(suggestedPhotoDate([null, null], today)).toBe(today);
    expect(suggestedPhotoDate(["2027-01-01"], today)).toBe(today);
  });

  it("FK2: the doctor can change the date, but not to a day after today", () => {
    expect(parseClientPhotoForm({ takenOn: "2026-09-14" }, today)).toEqual({ ok: true, takenOn: "2026-09-14", courseId: null });
    expect(parseClientPhotoForm({ takenOn: "2026-09-14", courseId: "c1" }, today)).toMatchObject({ courseId: "c1" });
    expect(parseClientPhotoForm({ takenOn: "2026-10-31" }, today)).toEqual({ ok: false, error: "dateInvalid" });
    expect(parseClientPhotoForm({ takenOn: "14.09.2026" }, today)).toEqual({ ok: false, error: "dateInvalid" });
  });
});

describe("FK2: фото по датам", () => {
  it("FK2: newest date first, photos of one day together in the order they were added", () => {
    const p = (id: string, takenOn: string, createdAt: string) => ({ id, takenOn, createdAt });
    const timeline = photoTimeline([p("a", "2026-09-01", "1"), p("b", "2026-10-01", "3"), p("c", "2026-10-01", "2")]);
    expect(timeline.map((g) => [g.date, g.photos.map((x) => x.id)])).toEqual([
      ["2026-10-01", ["c", "b"]],
      ["2026-09-01", ["a"]],
    ]);
  });
});

describe("FK3: косметология в «Фото клиента», лечение в «Лечение»", () => {
  it("FK3: photos of a course stay with the course", () => {
    const { general, byCourse } = splitClientPhotos([
      { id: "a", courseId: null },
      { id: "b", courseId: "k1" },
      { id: "c", courseId: "k1" },
    ]);
    expect(general.map((p) => p.id)).toEqual(["a"]);
    expect(byCourse.k1.map((p) => p.id)).toEqual(["b", "c"]);
  });

  it("FK3: «Фото клиента» is for cosmetology – not for clients with only «Дерматология», unless photos are there", () => {
    expect(showsClientPhotos(["cosmetology"], 0)).toBe(true);
    expect(showsClientPhotos(["cosmetology", "dermatology"], 0)).toBe(true);
    expect(showsClientPhotos([], 0)).toBe(true);
    expect(showsClientPhotos(["dermatology"], 0)).toBe(false);
    expect(showsClientPhotos(["dermatology"], 2)).toBe(true);
  });
});
