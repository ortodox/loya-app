import {
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

export const emptyScheme = (template: FaceTemplate = "front"): FaceScheme => ({ template, strokes: [] });

/** Z5: add a finished stroke (ignored when empty or when the scheme is full). */
export function addStroke(scheme: FaceScheme, stroke: Stroke): FaceScheme {
  if (stroke.points.length === 0 || scheme.strokes.length >= maxStrokes) return scheme;
  return { ...scheme, strokes: [...scheme.strokes, stroke] };
}

/** Z5: «Отменить» – remove the last stroke. */
export function undoStroke(scheme: FaceScheme): FaceScheme {
  return { ...scheme, strokes: scheme.strokes.slice(0, -1) };
}

/** Z5: «Очистить» – the same template without strokes. */
export const clearScheme = (scheme: FaceScheme): FaceScheme => emptyScheme(scheme.template);

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
  const template = faceTemplates.find((t) => t === raw.template) ?? "front";
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
