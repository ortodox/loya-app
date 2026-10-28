import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { facePhotoSrc } from "./templates";

const publicDir = join(process.cwd(), "public");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));

describe("Z5: фото-шаблон лица", () => {
  it("Z5: the photo for «front-photo-v1» is in public/, under exactly this name", () => {
    expect(facePhotoSrc).toBe("/templates/face-front.webp");
    expect(existsSync(join(publicDir, facePhotoSrc))).toBe(true);
  });

  it("Z5: file names in public/ are lowercase – Vercel tells «.PNG» and «.png» apart", () => {
    const upper = files(publicDir).map((f) => f.slice(publicDir.length)).filter((f) => f !== f.toLowerCase());
    expect(upper).toEqual([]);
  });
});
