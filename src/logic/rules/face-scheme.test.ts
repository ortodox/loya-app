import { describe, expect, it } from "vitest";
import type { Stroke } from "@/logic/face-scheme";
import {
  addStroke,
  clearScheme,
  emptyScheme,
  finishStroke,
  isEmptyScheme,
  normalizePoint,
  parseFaceScheme,
  strokePath,
  thinPoints,
  undoStroke,
} from "./face-scheme";

const rect = { left: 20, top: 100, width: 300, height: 400 };
const line: Stroke = { color: "red", width: 0.006, points: [[0.1, 0.1], [0.3, 0.3]] };

describe("Z5: схема лица – нормализация", () => {
  it("Z5: finger positions become 0–1 coordinates of the template", () => {
    expect(normalizePoint(170, 300, rect)).toEqual([0.5, 0.5]);
    expect(normalizePoint(20, 100, rect)).toEqual([0, 0]);
  });

  it("Z5: outside the drawing area is pulled to the edge", () => {
    expect(normalizePoint(0, 900, rect)).toEqual([0, 1]);
  });

  it("Z5: scales back to any size as an SVG path", () => {
    expect(strokePath([[0.5, 0.25], [1, 1]], 300, 400)).toBe("M150 100 L300 400");
  });
});

describe("Z5: точка и линия", () => {
  it("Z5: a short tap is a dot", () => {
    expect(finishStroke({ color: "dark", width: 0.006, points: [[0.5, 0.5], [0.502, 0.501]] }).points).toEqual([[0.5, 0.5]]);
  });

  it("Z5: a drag is a line, with points that are too close dropped", () => {
    const points = thinPoints([[0.1, 0.1], [0.1005, 0.1], [0.2, 0.2], [0.2001, 0.2001]]);
    expect(points).toEqual([[0.1, 0.1], [0.2, 0.2], [0.2001, 0.2001]]);
    expect(finishStroke(line).points).toHaveLength(2);
  });
});

describe("Z5: отменить и очистить", () => {
  it("Z5: «Отменить» removes the last stroke", () => {
    const s = addStroke(addStroke(emptyScheme(), line), { ...line, color: "blue" });
    expect(undoStroke(s).strokes).toEqual([line]);
    expect(undoStroke(emptyScheme()).strokes).toEqual([]);
  });

  it("Z5: «Очистить» keeps the template and removes everything", () => {
    expect(clearScheme(addStroke(emptyScheme(), line))).toEqual({ template: "front", strokes: [] });
  });
});

describe("Z5: пустая схема", () => {
  it("Z5: a scheme without strokes counts as empty and is not saved", () => {
    expect(isEmptyScheme(null)).toBe(true);
    expect(isEmptyScheme(emptyScheme())).toBe(true);
    expect(isEmptyScheme(addStroke(emptyScheme(), line))).toBe(false);
    expect(parseFaceScheme(JSON.stringify(emptyScheme()))).toBeNull();
    expect(parseFaceScheme("")).toBeNull();
  });

  it("Z5: reads a stored scheme and drops anything malformed", () => {
    const stored = { template: "front", strokes: [line, { color: "green", width: 0.006, points: [[0.1, 0.1]] }, { color: "dark", width: 0.006, points: [[2, 0.1], [0.4, 0.4]] }] };
    expect(parseFaceScheme(JSON.stringify(stored))).toEqual({
      template: "front",
      strokes: [line, { color: "dark", width: 0.006, points: [[0.4, 0.4]] }],
    });
    expect(parseFaceScheme("{not json")).toBeNull();
    expect(parseFaceScheme({ template: "profile", strokes: [line] })?.template).toBe("front");
  });
});
