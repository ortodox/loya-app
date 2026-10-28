/**
 * Z5: face templates. «front-photo-v1» is the realistic face (Loya 28.10.2026) used for new schemes;
 * «front» is the first line drawing, kept only to show schemes drawn on it without moving the points.
 * A profile can be added later as another key.
 */
export const faceTemplates = ["front", "front-photo-v1"] as const;
export type FaceTemplate = (typeof faceTemplates)[number];

/** Z5: the template every new scheme is drawn on. */
export const currentTemplate: FaceTemplate = "front-photo-v1";

/** Z5: pen colours – stored as names; near-black, bright red and bright blue so they show on skin. */
export const penColors = ["dark", "red", "blue"] as const;
export type PenColor = (typeof penColors)[number];

/** Z5: pen widths, relative to the template width. */
export const penWidths = { thin: 0.006, thick: 0.014 } as const;
export type PenWidth = keyof typeof penWidths;

/** A point normalised to the template: 0–1 from the left, 0–1 from the top. */
export type Point = [number, number];

/** One stroke; a single point is a dot (injection point), more points a line. */
export type Stroke = { color: PenColor; width: number; points: Point[] };

/** Z5: what is stored in visits.face_scheme. */
export type FaceScheme = { template: FaceTemplate; strokes: Stroke[] };
