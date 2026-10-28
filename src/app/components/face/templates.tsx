import type { FaceTemplate } from "@/logic/face-scheme";

/** Z5: drawing box of every template, in SVG units (3:4, like the paper booklet). */
export const templateSize = { width: 300, height: 400 } as const;

const line = {
  fill: "none",
  stroke: "var(--face-line)",
  strokeWidth: 1.3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
};
const soft = { ...line, strokeWidth: 1, opacity: 0.6 };

/** A calm line drawing of a face from the front, as in the paper booklet. */
function Front() {
  return (
    <g>
      {/* head and hairline */}
      <path {...line} d="M150 40 C95 40 70 95 72 165 C74 225 98 282 128 307 Q150 324 172 307 C202 282 226 225 228 165 C230 95 205 40 150 40 Z" />
      <path {...soft} d="M82 138 C88 82 120 58 150 58 C180 58 212 82 218 138" />
      {/* ears */}
      <path {...line} d="M73 158 C58 152 54 186 62 202 C66 211 74 213 78 206" />
      <path {...line} d="M227 158 C242 152 246 186 238 202 C234 211 226 213 222 206" />
      {/* brows and eyes */}
      <path {...line} d="M100 143 Q118 132 137 140" />
      <path {...line} d="M163 140 Q182 132 200 143" />
      <path {...line} d="M104 165 Q120 154 136 165 Q120 174 104 165 Z" />
      <path {...line} d="M164 165 Q180 154 196 165 Q180 174 164 165 Z" />
      <circle {...soft} cx="120" cy="165" r="4" />
      <circle {...soft} cx="180" cy="165" r="4" />
      {/* nose */}
      <path {...line} d="M150 160 L145 208 Q141 221 148 224" />
      <path {...line} d="M136 221 Q142 230 150 228 Q158 230 164 221" />
      {/* nasolabial folds */}
      <path {...soft} d="M131 224 Q121 240 124 259" />
      <path {...soft} d="M169 224 Q179 240 176 259" />
      {/* lips */}
      <path {...line} d="M125 255 Q138 246 150 251 Q162 246 175 255" />
      <path {...line} d="M125 255 Q150 262 175 255" />
      <path {...line} d="M128 257 Q150 275 172 257" />
      {/* chin and neck */}
      <path {...soft} d="M136 298 Q150 305 164 298" />
      <path {...line} d="M118 299 L112 390" />
      <path {...line} d="M182 299 L188 390" />
    </g>
  );
}

/** Z5: the template by name – a profile view can be added here later. */
export function FaceTemplateLines({ template }: { template: FaceTemplate }) {
  switch (template) {
    case "front":
      return <Front />;
  }
}
