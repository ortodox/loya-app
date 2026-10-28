import type { Stroke } from "@/logic/face-scheme";
import { strokePath } from "@/logic/rules/face-scheme";
import { templateSize } from "./templates";

const { width: W, height: H } = templateSize;
const colors = { dark: "var(--pen-dark)", red: "var(--pen-red)", blue: "var(--pen-blue)" } as const;

/** Z5: the drawn points (circles) and lines, scaled from 0–1 to the template box. */
export function FaceStrokes({ strokes }: { strokes: readonly Stroke[] }) {
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
