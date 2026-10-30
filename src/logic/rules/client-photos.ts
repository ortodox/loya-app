import type { IsoDate } from "@/logic/client";
import type { ClientPhoto } from "@/logic/client-photo";
import type { Direction } from "@/logic/course";
import { isIsoDate } from "./dates";
import { showsFaceScheme } from "./face-scheme";

/** FK1: clients send 1–3 photos at a time. */
export const maxClientPhotosPerSave = 3;

/** How much of the file is read to find the date taken – EXIF sits at the start of a JPEG. */
export const exifHeadBytes = 128 * 1024;

const exifDateTime = /^(\d{4}):(\d{2}):(\d{2})[ T]\d{2}:\d{2}:\d{2}/;

/**
 * FK2: the date a JPEG was taken, from its EXIF (DateTimeOriginal, then DateTimeDigitized, then
 * DateTime). Null when there is none – messengers often remove it.
 */
export function exifDate(bytes: Uint8Array): IsoDate | null {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint16(0) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null; // start of image data: no EXIF
      const length = view.getUint16(offset + 2);
      if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) return fromTiff(view, offset + 10);
      offset += 2 + length;
    }
    return null;
  } catch {
    return null; // cut off or broken file
  }
}

function fromTiff(view: DataView, tiff: number): IsoDate | null {
  const little = view.getUint16(tiff) === 0x4949;
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  const entries = (ifd: number) => {
    const found = new Map<number, number>();
    const count = u16(tiff + ifd);
    for (let i = 0; i < count; i++) {
      const entry = tiff + ifd + 2 + i * 12;
      found.set(u16(entry), entry);
    }
    return found;
  };
  const ascii = (entry: number | undefined) => {
    if (entry === undefined || u16(entry + 2) !== 2) return null;
    const length = u32(entry + 4);
    const start = length > 4 ? tiff + u32(entry + 8) : entry + 8;
    let text = "";
    for (let i = 0; i < length && i < 32; i++) text += String.fromCharCode(view.getUint8(start + i));
    return toIsoDate(text);
  };

  const ifd0 = entries(u32(tiff + 4));
  const exifPointer = ifd0.get(0x8769);
  const exif = exifPointer !== undefined ? entries(u32(exifPointer + 8)) : new Map<number, number>();
  return ascii(exif.get(0x9003)) ?? ascii(exif.get(0x9004)) ?? ascii(ifd0.get(0x0132));
}

function toIsoDate(text: string): IsoDate | null {
  const match = exifDateTime.exec(text);
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  return isIsoDate(date) ? date : null;
}

/**
 * FK2: the date suggested in the form – the earliest date taken among the chosen photos, otherwise
 * today. A date in the future (wrong camera clock) is not trusted.
 */
export function suggestedPhotoDate(dates: readonly (IsoDate | null)[], today: IsoDate): IsoDate {
  const known = dates.filter((d): d is IsoDate => d !== null && d <= today).sort();
  return known[0] ?? today;
}

export type ClientPhotoForm = { takenOn?: string; courseId?: string };

/** FK2: the date must be a real date, not after today. */
export function parseClientPhotoForm(
  form: ClientPhotoForm,
  today: IsoDate,
): { ok: true; takenOn: IsoDate; courseId: string | null } | { ok: false; error: "dateInvalid" } {
  const takenOn = (form.takenOn ?? "").trim();
  if (!isIsoDate(takenOn) || takenOn > today) return { ok: false, error: "dateInvalid" };
  return { ok: true, takenOn, courseId: form.courseId?.trim() || null };
}

/** FK2: newest first, grouped by the date taken; photos of the same day in the order they were added. */
export function photoTimeline<T extends Pick<ClientPhoto, "takenOn" | "createdAt">>(photos: readonly T[]): { date: IsoDate; photos: T[] }[] {
  const sorted = [...photos].sort((a, b) => b.takenOn.localeCompare(a.takenOn) || a.createdAt.localeCompare(b.createdAt));
  const groups: { date: IsoDate; photos: T[] }[] = [];
  for (const photo of sorted) {
    const last = groups.at(-1);
    if (last?.date === photo.takenOn) last.photos.push(photo);
    else groups.push({ date: photo.takenOn, photos: [photo] });
  }
  return groups;
}

/** FK3: photos without a course go to «Фото клиента», the others to their course in «Лечение». */
export function splitClientPhotos<T extends Pick<ClientPhoto, "courseId">>(photos: readonly T[]): { general: T[]; byCourse: Record<string, T[]> } {
  const general: T[] = [];
  const byCourse: Record<string, T[]> = {};
  for (const photo of photos) {
    if (photo.courseId) (byCourse[photo.courseId] ??= []).push(photo);
    else general.push(photo);
  }
  return { general, byCourse };
}

/**
 * FK3: «Фото клиента» after «Визиты» is for cosmetology – shown unless the client is marked only
 * «Дерматология» (their photos go to the course). Photos already there are always shown.
 */
export function showsClientPhotos(direction: readonly Direction[] | null | undefined, photoCount: number): boolean {
  return photoCount > 0 || showsFaceScheme(direction);
}
