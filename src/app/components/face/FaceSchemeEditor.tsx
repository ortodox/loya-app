"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { penColors, penWidths, type FaceScheme, type PenColor, type PenWidth, type Stroke } from "@/logic/face-scheme";
import { addStroke, clearScheme, finishStroke, normalizePoint, templateSpec, undoStroke } from "@/logic/rules/face-scheme";
import { FaceStrokes } from "./FaceStrokes";
import { FaceTemplateBackground } from "./templates";

const swatch = { dark: "var(--pen-dark)", red: "var(--pen-red)", blue: "var(--pen-blue)" } as const;
const tool = "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm";

/**
 * Z5: draw on the face template with a finger – a short tap is a dot (injection point), a drag is
 * a line. `touch-action: none` keeps the page from scrolling while drawing. The area keeps the
 * template's shape and is never taller than the screen, so the whole face and neck are in view.
 */
export function FaceSchemeEditor({ scheme, onChange }: { scheme: FaceScheme; onChange: (scheme: FaceScheme) => void }) {
  const t = useTranslations("scheme");
  const [color, setColor] = useState<PenColor>("dark");
  const [width, setWidth] = useState<PenWidth>("thin");
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const drawing = useRef<Stroke | null>(null);
  const area = useRef<SVGSVGElement>(null);
  // Quick taps can finish before React re-renders – always build on the latest scheme.
  const latest = useRef(scheme);
  useEffect(() => {
    latest.current = scheme;
  }, [scheme]);
  const change = (next: FaceScheme) => {
    latest.current = next;
    onChange(next);
  };

  // Opening the editor brings the whole drawing area into view.
  useEffect(() => {
    area.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const { width: boxW, height: boxH } = templateSpec(scheme.template);
  const point = (e: React.PointerEvent) => normalizePoint(e.clientX, e.clientY, area.current!.getBoundingClientRect());

  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { color, width: penWidths[width], points: [point(e)] };
    setCurrent(drawing.current);
  }

  function move(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    drawing.current = { ...drawing.current, points: [...drawing.current.points, point(e)] };
    setCurrent(drawing.current);
  }

  function up() {
    if (!drawing.current) return;
    change(addStroke(latest.current, finishStroke(drawing.current)));
    drawing.current = null;
    setCurrent(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <svg
        ref={area}
        viewBox={`0 0 ${boxW} ${boxH}`}
        role="img"
        aria-label={t("area")}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{
          touchAction: "none",
          WebkitTouchCallout: "none",
          aspectRatio: `${boxW} / ${boxH}`,
          // As wide as the card, but no taller than the screen minus the form header and the hint.
          width: `min(100%, calc((100svh - 9rem) * ${boxW} / ${boxH}))`,
        }}
        className="mx-auto block cursor-crosshair rounded-[14px] border border-field bg-face-paper select-none"
      >
        <FaceTemplateBackground template={scheme.template} />
        <FaceStrokes strokes={current ? [...scheme.strokes, current] : scheme.strokes} template={scheme.template} />
      </svg>
      <p className="text-sm text-muted">{t("hint")}</p>

      <div role="group" aria-label={t("color")} className="flex flex-wrap gap-2">
        {penColors.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className={`${tool} ${color === c ? "border-primary font-semibold text-ink" : "border-field text-ink"}`}
          >
            <span aria-hidden className="size-4 rounded-full ring-1 ring-field" style={{ background: swatch[c] }} />
            {t(`colors.${c}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("width")} className="flex gap-2">
          {(Object.keys(penWidths) as PenWidth[]).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={width === w}
              onClick={() => setWidth(w)}
              className={`${tool} ${width === w ? "border-primary font-semibold text-ink" : "border-field text-ink"}`}
            >
              <span aria-hidden className="rounded-full bg-ink" style={{ width: 18, height: w === "thin" ? 2 : 5 }} />
              {t(`widths.${w}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={scheme.strokes.length === 0}
          onClick={() => change(undoStroke(latest.current))}
          className={`${tool} border-field text-accent disabled:opacity-40`}
        >
          {t("undo")}
        </button>
        <button
          type="button"
          disabled={scheme.strokes.length === 0}
          onClick={() => setConfirmClear(true)}
          className={`${tool} border-field text-on-alert disabled:opacity-40`}
        >
          {t("clear")}
        </button>
      </div>

      {/* «Очистить» asks first. */}
      {confirmClear && (
        <div role="alertdialog" aria-label={t("clear")} className="flex flex-col gap-2 rounded-[14px] bg-alert p-3 text-on-alert">
          <p className="text-sm">{t("clearAsk")}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmClear(false)} className="min-h-11 rounded-[14px] border border-current px-3 text-sm">
              {t("clearNo")}
            </button>
            <button
              type="button"
              onClick={() => {
                change(clearScheme());
                setConfirmClear(false);
              }}
              className="min-h-11 rounded-[14px] bg-on-alert px-3 text-sm font-semibold text-alert"
            >
              {t("clearYes")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
