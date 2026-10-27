import { describe, expect, it } from "vitest";
import {
  careChanged,
  documentExtension,
  documentKind,
  documentsByCourse,
  isAcceptableDocument,
  labDateFromDocument,
  maxDocumentBytes,
  parseDocumentForm,
  sortDocuments,
} from "./documents";

const today = "2026-10-28";

describe("DK1: документы и анализы", () => {
  it("DK1: accepts images and PDF up to 20 MB", () => {
    expect(isAcceptableDocument({ type: "application/pdf", size: 3_000_000 })).toBe(true);
    expect(isAcceptableDocument({ type: "image/heic", size: 2_000_000 })).toBe(true);
    expect(isAcceptableDocument({ type: "application/pdf", size: maxDocumentBytes + 1 })).toBe(false);
    expect(isAcceptableDocument({ type: "application/msword", size: 1000 })).toBe(false);
    expect(isAcceptableDocument({ type: "image/jpeg", size: 0 })).toBe(false);
  });

  it("DK1: optional title, the date defaults to today", () => {
    expect(parseDocumentForm({ title: "  АЛТ, АСТ  " }, today)).toEqual({
      ok: true,
      title: "АЛТ, АСТ",
      documentDate: today,
      courseId: null,
      markLabs: false,
    });
    expect(parseDocumentForm({ documentDate: "28.10.2026" }, today)).toEqual({ ok: false, error: "dateInvalid" });
  });

  it("DK1: newest first, same day by when it was added", () => {
    const d = (documentDate: string, createdAt: string) => ({ documentDate, createdAt });
    expect(sortDocuments([d("2026-09-01", "a"), d("2026-10-01", "a"), d("2026-10-01", "b")])).toEqual([
      d("2026-10-01", "b"),
      d("2026-10-01", "a"),
      d("2026-09-01", "a"),
    ]);
  });

  it("DK1: storage path extension from the file type", () => {
    expect(documentExtension("application/pdf")).toBe("pdf");
    expect(documentExtension("image/jpeg")).toBe("jpg");
  });
});

describe("DK3: открыть файл на телефоне", () => {
  it("DK3: PDF opens in the browser viewer, images in full size", () => {
    expect(documentKind("application/pdf")).toBe("pdf");
    expect(documentKind("image/png")).toBe("image");
  });
});

describe("LE8: анализы в курсе лечения", () => {
  it("LE8: a document can be tied to a course and mark the tests as done", () => {
    expect(parseDocumentForm({ courseId: "c1", markLabs: "1" }, today)).toMatchObject({ courseId: "c1", markLabs: true });
    expect(parseDocumentForm({ markLabs: "1" }, today)).toMatchObject({ courseId: null, markLabs: false });
  });

  it("LE8: tests are marked with the document date, never a future one", () => {
    expect(labDateFromDocument("2026-10-20", today)).toBe("2026-10-20");
    expect(labDateFromDocument("2026-11-02", today)).toBe(today);
  });

  it("LE8: documents grouped by course", () => {
    const docs = [{ id: "a", courseId: "c1" }, { id: "b", courseId: null }, { id: "c", courseId: "c1" }];
    expect(documentsByCourse(docs)).toEqual({ c1: [docs[0], docs[2]] });
  });
});

describe("UH1: уход", () => {
  it("UH1: «Обновлено» only when the text or the photos change", () => {
    expect(careChanged("Утро: SPF", "Утро: SPF ", 0, 0)).toBe(false);
    expect(careChanged("Утро: SPF", "Утро: SPF\nВечер: ретинол", 0, 0)).toBe(true);
    expect(careChanged(null, "", 0, 0)).toBe(false);
    expect(careChanged("x", "x", 1, 0)).toBe(true);
    expect(careChanged("x", "x", 0, 1)).toBe(true);
  });
});
