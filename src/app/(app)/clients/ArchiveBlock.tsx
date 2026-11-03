"use client";

import { Zip, ZipDeflate, ZipPassThrough } from "fflate";
import { useTranslations } from "next-intl";
import { useState } from "react";
import ru from "../../../../messages/ru.json";
import { archiveAssets, renderArchive } from "@/archive/render";
import { card, ui } from "@/app/components/ui";
import type { IsoDate } from "@/logic/client";
import { archiveFolderName } from "@/logic/rules/archive";
import { formatIsoDate } from "@/logic/rules/dates";
import type { ArchiveClient } from "@/logic/usecases/archive";
import type { archiveClientAction, archiveSavedAction, archiveStartAction } from "./archive-actions";

type Status =
  | { step: "idle" }
  | { step: "clients"; done: number; total: number }
  | { step: "packing" }
  | { step: "saved"; missing: number }
  | { step: "failed" };

/**
 * EX1 «Резервная копия» at the bottom of the client list: «Скачать архив» makes the HTML archive in
 * the browser – one client at a time, files straight from Storage – and saves «LOA arkiv <дата>.zip».
 * The archive pages are in Russian, like the app and Loya's notes.
 */
export type ArchiveActions = { start: typeof archiveStartAction; client: typeof archiveClientAction; saved: typeof archiveSavedAction };

export function ArchiveBlock({ last, actions }: { last: { date: IsoDate; days: number; stale: boolean } | null; actions: ArchiveActions }) {
  const t = useTranslations();
  const [status, setStatus] = useState<Status>({ step: "idle" });
  const busy = status.step === "clients" || status.step === "packing";

  async function download() {
    try {
      const start = await actions.start();
      if (!start.ok) throw new Error("start");
      const folder = archiveFolderName(start.today);
      const parts: Uint8Array[] = [];
      let finish: () => void = () => {};
      let fail: (e: unknown) => void = () => {};
      const finished = new Promise<void>((resolve, reject) => ((finish = resolve), (fail = reject)));
      const zip = new Zip((err, chunk, final) => {
        if (err) return fail(err);
        parts.push(chunk);
        if (final) finish();
      });
      const add = (path: string, data: Uint8Array, compress: boolean) => {
        const entry = compress ? new ZipDeflate(`${folder}/${path}`, { level: 6 }) : new ZipPassThrough(`${folder}/${path}`);
        zip.add(entry);
        entry.push(data, true);
      };

      const clients: ArchiveClient[] = [];
      let missing = 0;
      for (const [i, c] of start.clients.entries()) {
        setStatus({ step: "clients", done: i, total: start.clients.length });
        const one = await actions.client(c.id);
        if (!one.ok) throw new Error("client");
        clients.push(one.client);
        for (const f of one.files) {
          const res = f.url ? await fetch(f.url).catch(() => null) : null;
          if (!res?.ok) {
            missing++;
            continue;
          }
          // Photos and PDFs are already compressed – stored as they are.
          add(f.archivePath, new Uint8Array(await res.arrayBuffer()), false);
        }
      }

      setStatus({ step: "packing" });
      for (const a of archiveAssets) {
        const res = await fetch(a.from.replace(/^public/, ""));
        if (res.ok) add(a.to, new Uint8Array(await res.arrayBuffer()), false);
      }
      const encoder = new TextEncoder();
      for (const page of await renderArchive({ createdOn: start.today, clients, files: [] }, ru)) add(page.path, encoder.encode(page.content), true);
      zip.end();
      await finished;

      const url = URL.createObjectURL(new Blob(parts as BlobPart[], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${folder}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      await actions.saved();
      setStatus({ step: "saved", missing });
    } catch {
      setStatus({ step: "failed" });
    }
  }

  return (
    <section aria-labelledby="archive-title" className={`${card.surface} flex flex-col gap-2 p-4`}>
      <h2 id="archive-title" className={card.heading}>
        {t("archive.blockTitle")}
      </h2>
      <p className={`text-sm ${last?.stale || !last ? "font-semibold text-on-alert" : "text-muted"}`}>
        {last ? t("archive.last", { date: formatIsoDate(last.date), ago: t("card.daysAgo", { count: last.days }) }) : t("archive.never")}
      </p>
      <button type="button" onClick={download} disabled={busy} className={`${ui.button} disabled:opacity-60`}>
        {status.step === "clients"
          ? t("archive.preparing", { done: status.done, total: status.total })
          : status.step === "packing"
            ? t("archive.packing")
            : t("archive.download")}
      </button>
      {status.step === "saved" && (
        <p role="status" className="text-sm font-semibold text-ink">
          {t("archive.saved")}
          {status.missing > 0 && <span className="block text-on-alert">{t("archive.missingFiles", { count: status.missing })}</span>}
        </p>
      )}
      {status.step === "failed" && (
        <p role="alert" className={ui.error}>
          {t("archive.failed")}
        </p>
      )}
      <p className="text-xs text-muted">{t("archive.hint")}</p>
    </section>
  );
}
