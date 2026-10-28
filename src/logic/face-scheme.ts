/** Z5: face templates. «front» now; a profile can be added later as another key. */
export const faceTemplates = ["front"] as const;
export type FaceTemplate = (typeof faceTemplates)[number];

/** Z5: pen colours – stored as names, drawn with theme colours (readable in dark mode too). */
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
