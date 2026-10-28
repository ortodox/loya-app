import type { FaceScheme } from "@/logic/face-scheme";
import { FaceStrokes } from "./FaceStrokes";
import { FaceTemplateLines, templateSize } from "./templates";

/** Z5: read-only scheme – thumbnail in the visit, or large when opened. */
export function FaceSchemeView({ scheme, className = "", label }: { scheme: FaceScheme; className?: string; label: string }) {
  return (
    <svg
      viewBox={`0 0 ${templateSize.width} ${templateSize.height}`}
      role="img"
      aria-label={label}
      className={`block aspect-[3/4] rounded-[14px] bg-surface ${className}`}
    >
      <FaceTemplateLines template={scheme.template} />
      <FaceStrokes strokes={scheme.strokes} />
    </svg>
  );
}
