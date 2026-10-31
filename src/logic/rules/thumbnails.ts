/** Small copies of the photos for the card: about 320 px, shown in the thumbnails; a tap opens the original. */
export const thumbnailSide = 320;

/** The small copy is stored next to the original: `…/<id>.jpg` → `…/<id>-t.jpg`. */
export function thumbPath(path: string): string {
  return path.replace(/\.jpg$/i, "-t.jpg");
}

/** The thumbnail when it exists (photos from before have none), otherwise the original. */
export function thumbUrl(urls: Record<string, string>, path: string): string | null {
  return urls[thumbPath(path)] ?? urls[path] ?? null;
}

/** «Анна Выдуманная» → «АВ»: shown in place of a photo. */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase("ru"))
    .join("");
}
