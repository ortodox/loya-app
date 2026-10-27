"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadToSignedUrl } from "@/app/components/uploadToSignedUrl";
import { card, ui } from "@/app/components/ui";
import { isAcceptableDocument } from "@/logic/rules/documents";
import { prepareUploadAction, registerDocumentAction } from "./actions";

type Props = {
  clientId: string;
  today: string;
  /** LE8: active courses; `labControl` decides whether to ask «Отметить анализы сданными?». */
  courses: { id: string; diagnosis: string; labControl: boolean }[];
};

type ErrorKey = "fileInvalid" | "dateInvalid" | "fileRequired" | "uploadFailed" | "notFound";

/** DK1/LE8: upload a photo or PDF the client sent – title, date, optional course. */
export function DocumentUploadForm({ clientId, today, courses }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [courseId, setCourseId] = useState("");
  const [markLabs, setMarkLabs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const course = courses.find((c) => c.id === courseId);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return setError("fileRequired");
    if (!isAcceptableDocument(file)) return setError("fileInvalid");
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const prepared = await prepareUploadAction(clientId, { type: file.type, size: file.size });
    if (!prepared.ok) {
      setBusy(false);
      return setError(prepared.error === "failed" ? "uploadFailed" : prepared.error);
    }
    if (!(await uploadToSignedUrl(prepared.uploadUrl, file))) {
      setBusy(false);
      return setError("uploadFailed");
    }
    const saved = await registerDocumentAction(
      clientId,
      { path: prepared.path, type: file.type, size: file.size },
      {
        title: String(fd.get("title") ?? ""),
        documentDate: String(fd.get("documentDate") ?? ""),
        courseId,
        markLabs: course?.labControl && markLabs ? "1" : "",
      },
    );
    if (!saved.ok) {
      setBusy(false);
      return setError(saved.error === "failed" ? "uploadFailed" : saved.error);
    }
    router.push(`/clients/${clientId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <Link href={`/clients/${clientId}`} className={ui.textButton}>
          {t("form.cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">{t("documents.newTitle")}</h1>
        <span className="w-16" aria-hidden />
      </header>

      <section className={`${card.surface} flex flex-col gap-3 p-4`}>
        <span className={card.label}>{t("documents.file")}</span>
        {file && (
          <p className="text-base break-all text-ink">
            {file.type === "application/pdf" ? "📄" : "🖼️"} {file.name} ·{" "}
            {t("documents.size", { size: (file.size / 1024 / 1024).toFixed(1).replace(".", ",") })}
          </p>
        )}
        <label className={`${ui.addButton} cursor-pointer self-start`}>
          {file ? t("documents.changeFile") : t("documents.chooseFile")}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
        </label>
      </section>

      <section className={`${card.surface} flex flex-col gap-4 p-4`}>
        <label className="flex flex-col gap-2">
          <span className={card.label}>{t("documents.fileTitle")}</span>
          <input name="title" autoComplete="off" placeholder={t("documents.fileTitleHint")} className={ui.input} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={card.label}>{t("documents.date")}</span>
          <input name="documentDate" type="date" required defaultValue={today} className={ui.input} />
        </label>
        {/* LE8: attach to an active course. */}
        {courses.length > 0 && (
          <label className="flex flex-col gap-2">
            <span className={card.label}>{t("documents.course")}</span>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={ui.input}>
              <option value="">{t("documents.courseNone")}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.diagnosis}
                </option>
              ))}
            </select>
          </label>
        )}
        {course?.labControl && (
          <label className="flex min-h-11 items-start gap-3 rounded-[14px] border border-field p-3">
            <input
              type="checkbox"
              checked={markLabs}
              onChange={(e) => setMarkLabs(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span className="flex flex-col">
              <span className="font-semibold text-ink">{t("documents.markLabs")}</span>
              <span className="text-sm text-muted">{t("documents.markLabsHint")}</span>
            </span>
          </label>
        )}
      </section>

      {error && <p className={ui.error}>{t(`documents.errors.${error}`)}</p>}
      <button type="submit" disabled={busy} className={`${ui.button} disabled:opacity-60`}>
        {busy ? t("documents.uploading") : t("documents.upload")}
      </button>
    </form>
  );
}
