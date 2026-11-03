// EX1: turns the archive data into plain files – index.html, one page per client and the style.
import { createTranslator } from "next-intl";
import { facePhotoSrc } from "@/app/components/face/templates";
import { clientPagePath } from "@/logic/rules/archive";
import type { ArchiveData } from "@/logic/usecases/archive";
import { ArchiveClientPage, ArchiveIndex, type T } from "./ArchivePages";
import { archiveCss } from "./style";

export type ArchivePage = { path: string; content: string };

/** EX1: the face template is copied next to the pages, so schemes show without the app. */
export const archiveAssets = [{ from: `public${facePhotoSrc}`, to: "filer/face-front.webp" }] as const;

/** EX1: every page of the archive, ready to be written to disk (photos and documents are copied separately). */
export async function renderArchive(data: ArchiveData, messages: Record<string, unknown>, locale = "ru"): Promise<ArchivePage[]> {
  // Loaded only when an archive is made (Next does not allow react-dom/server in the app's component graph).
  const { renderToStaticMarkup } = await import("react-dom/server");
  const translate = createTranslator({ locale, messages: messages as never });
  const t = ((key: string, values?: Record<string, string | number>) => translate(key as never, values as never)) as T;
  t.has = (key: string) => translate.has(key as never);
  const html = (node: React.ReactElement) => `<!doctype html>\n${renderToStaticMarkup(node)}`;
  return [
    { path: "index.html", content: html(<ArchiveIndex data={data} t={t} />) },
    { path: "stil.css", content: archiveCss },
    ...data.clients.map((c) => ({
      path: clientPagePath(c.card.client.id),
      // Z5: the scheme's template image lies in the archive, not on the app's server.
      content: html(<ArchiveClientPage c={c} ctx={{ t, locale, createdOn: data.createdOn }} />).replaceAll(`href="${facePhotoSrc}"`, `href="../${archiveAssets[0].to}"`),
    })),
  ];
}
