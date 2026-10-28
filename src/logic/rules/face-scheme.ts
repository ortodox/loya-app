import type { Direction } from "@/logic/course";
import {
  currentTemplate,
  faceTemplates,
  penColors,
  type FaceScheme,
  type FaceTemplate,
  type Point,
  type Stroke,
} from "@/logic/face-scheme";

export const maxStrokes = 500;
export const maxPointsPerStroke = 1000;

const round = (v: number) => Math.round(v * 10000) / 10000;
const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Z5: a finger position on the drawing area → 0–1 coordinates (outside the area is pulled to the edge). */
export function normalizePoint(x: number, y: number, rect: { left: number; top: number; width: number; height: number }): Point {
  return [round(clamp((x - rect.left) / rect.width)), round(clamp((y - rect.top) / rect.height))];
}

/** Z5: a short tap is a dot, a drag is a line – a stroke that hardly moved becomes one point. */
export function finishStroke(stroke: Stroke, tapRadius = 0.01): Stroke {
  const [first] = stroke.points;
  const moved = stroke.points.some(([x, y]) => Math.hypot(x - first[0], y - first[1]) > tapRadius);
  return moved ? { ...stroke, points: thinPoints(stroke.points) } : { ...stroke, points: [first] };
}

/** Z5: drop points closer than ~0.3 % to the previous one, so long lines stay small in the database. */
export function thinPoints(points: readonly Point[], minDistance = 0.003): Point[] {
  const result: Point[] = [];
  for (const p of points) {
    const last = result.at(-1);
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= minDistance) result.push(p);
  }
  const end = points.at(-1);
  if (end && result.at(-1) !== end && result.length > 0) result.push(end);
  return result.slice(0, maxPointsPerStroke);
}

/**
 * Z5: how each template is drawn – the old line drawing (3:4) or the photo (2:3, 1024×1536).
 * The box is in SVG units; points are 0–1 of the box, so they stay on the same spot of that template.
 */
export type TemplateSpec = { kind: "lines" | "photo"; width: number; height: number };

const templateSpecs: Record<FaceTemplate, TemplateSpec> = {
  front: { kind: "lines", width: 300, height: 400 },
  "front-photo-v1": { kind: "photo", width: 300, height: 450 },
};

/** Z5: the template of a stored scheme – schemes saved before templates had versions are «front». */
export function templateFor(id: unknown): FaceTemplate {
  return faceTemplates.find((t) => t === id) ?? "front";
}

export const templateSpec = (template: FaceTemplate): TemplateSpec => templateSpecs[template];

/**
 * Z5: «Схема лица» belongs to cosmetology. It is shown in the visit unless the client is marked
 * only «Дерматология»; no direction yet counts as cosmetology (that is where Loya started).
 */
export function showsFaceScheme(direction: readonly Direction[] | null | undefined): boolean {
  return !direction || direction.length === 0 || direction.includes("cosmetology");
}

export const emptyScheme = (template: FaceTemplate = currentTemplate): FaceScheme => ({ template, strokes: [] });

/** Z5: add a finished stroke (ignored when empty or when the scheme is full). */
export function addStroke(scheme: FaceScheme, stroke: Stroke): FaceScheme {
  if (stroke.points.length === 0 || scheme.strokes.length >= maxStrokes) return scheme;
  return { ...scheme, strokes: [...scheme.strokes, stroke] };
}

/** Z5: «Отменить» – remove the last stroke. */
export function undoStroke(scheme: FaceScheme): FaceScheme {
  return { ...scheme, strokes: scheme.strokes.slice(0, -1) };
}

/** Z5: «Очистить» – nothing is left to keep in place, so the drawing starts again on the current template. */
export const clearScheme = (): FaceScheme => emptyScheme();

/** Z5: nothing drawn – saved as no scheme at all. */
export const isEmptyScheme = (scheme: FaceScheme | null | undefined): boolean => !scheme || scheme.strokes.length === 0;

const isPoint = (p: unknown): p is Point =>
  Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1);

/**
 * Z5: read a scheme from the form or the database. Anything malformed is dropped; an empty
 * scheme becomes null («Схема лица» is optional).
 */
export function parseFaceScheme(value: unknown): FaceScheme | null {
  let data = value;
  if (typeof value === "string") {
    if (value.trim() === "") return null;
    try {
      data = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const raw = data as { template?: unknown; strokes?: unknown };
  const template = templateFor(raw.template);
  const strokes: Stroke[] = [];
  for (const s of Array.isArray(raw.strokes) ? raw.strokes.slice(0, maxStrokes) : []) {
    const st = (s ?? {}) as { color?: unknown; width?: unknown; points?: unknown };
    const color = penColors.find((c) => c === st.color);
    const width = typeof st.width === "number" && st.width > 0 && st.width <= 0.05 ? st.width : null;
    const points = Array.isArray(st.points) ? st.points.filter(isPoint).slice(0, maxPointsPerStroke).map(([x, y]) => [round(x), round(y)] as Point) : [];
    if (color && width !== null && points.length > 0) strokes.push({ color, width, points });
  }
  return strokes.length > 0 ? { template, strokes } : null;
}

/** Z5: SVG path for a line stroke in a box of the given size. */
export function strokePath(points: readonly Point[], width: number, height: number): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${round(x * width)} ${round(y * height)}`).join(" ");
}
