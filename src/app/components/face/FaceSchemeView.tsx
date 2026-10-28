import type { FaceScheme } from "@/logic/face-scheme";
import { templateSpec } from "@/logic/rules/face-scheme";
import { FaceStrokes } from "./FaceStrokes";
import { FaceTemplateBackground } from "./templates";

/** Z5: read-only scheme on its own template – thumbnail in the visit, or large when opened. */
export function FaceSchemeView({ scheme, className = "", label }: { scheme: FaceScheme; className?: string; label: string }) {
  const { width, height } = templateSpec(scheme.template);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      style={{ aspectRatio: `${width} / ${height}` }}
      className={`block rounded-[14px] bg-face-paper ${className}`}
    >
      <FaceTemplateBackground template={scheme.template} />
      <FaceStrokes strokes={scheme.strokes} template={scheme.template} />
    </svg>
  );
}
