import type { FaceTemplate, Stroke } from "@/logic/face-scheme";
import { strokePath, templateSpec } from "@/logic/rules/face-scheme";

const colors = { dark: "var(--pen-dark)", red: "var(--pen-red)", blue: "var(--pen-blue)" } as const;

/** Z5: the drawn points (circles) and lines, scaled from 0–1 to the box of their own template. */
export function FaceStrokes({ strokes, template }: { strokes: readonly Stroke[]; template: FaceTemplate }) {
  const { width: W, height: H } = templateSpec(template);
  return (
    <g>
      {strokes.map((s, i) =>
        s.points.length === 1 ? (
          <circle key={i} cx={s.points[0][0] * W} cy={s.points[0][1] * H} r={s.width * W * 1.1} fill={colors[s.color]} />
        ) : (
          <path
            key={i}
            d={strokePath(s.points, W, H)}
            fill="none"
            stroke={colors[s.color]}
            strokeWidth={s.width * W}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </g>
  );
}
