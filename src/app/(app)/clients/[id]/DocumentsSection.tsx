import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { card, ui } from "@/app/components/ui";
import type { TreatmentCourse } from "@/logic/course";
import type { ClientDocument } from "@/logic/document";
import { formatIsoDate } from "@/logic/rules/dates";
import { documentKind } from "@/logic/rules/documents";
import { DeleteDocument } from "./DeleteDocument";

type Props = {
  clientId: string;
  documents: ClientDocument[];
  urls: Record<string, string>;
  courses: Pick<TreatmentCourse, "id" | "diagnosis">[];
};

/** DK1/DK3/DK5: «Документы и анализы» – files the client sent, newest first. */
export async function DocumentsSection({ clientId, documents, urls, courses }: Props) {
  const t = await getTranslations("documents");
  const diagnosis = new Map(courses.map((c) => [c.id, c.diagnosis]));
  return (
    <section className={card.surface}>
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <h2 className={card.heading}>{t("title")}</h2>
        <Link href={`/clients/${clientId}/documents/new`} className={ui.addButton}>
          {t("add")}
        </Link>
      </div>
      {documents.length === 0 ? (
        <p className={`${ui.muted} px-4 pb-4`}>{t("empty")}</p>
      ) : (
        <ul>
          {documents.map((d) => {
            const kind = documentKind(d.mimeType);
            const course = d.courseId ? diagnosis.get(d.courseId) : null;
            return (
              <li key={d.id} className="flex flex-col gap-1 border-t border-line px-4 py-2">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="pt-0.5 text-xl">
                    {kind === "pdf" ? "📄" : "🖼️"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-semibold text-ink">{d.title ?? t(kind)}</span>
                    <span className="truncate text-sm text-muted">
                      {[formatIsoDate(d.documentDate), course ? t("inCourse", { diagnosis: course }) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-x-4">
                  {/* DK3: opens in full size / the browser's PDF viewer with a short-lived link. */}
                  {urls[d.storagePath] && (
                    <a href={urls[d.storagePath]} target="_blank" rel="noreferrer" className={`${ui.textButton} text-sm`}>
                      {t("open")}
                    </a>
                  )}
                  <DeleteDocument clientId={clientId} documentId={d.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
