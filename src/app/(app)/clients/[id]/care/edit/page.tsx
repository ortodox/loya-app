import { notFound } from "next/navigation";
import { thumbUrl } from "@/logic/rules/thumbnails";
import { getCare } from "@/logic/usecases/care";
import { saveCareAction } from "../actions";
import { CareForm } from "../CareForm";
import { careDeps } from "../deps";

export default async function CarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCare(await careDeps(), id);
  if (!data) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <CareForm
        cancelHref={`/clients/${id}`}
        text={data.care.text ?? ""}
        photos={data.care.photos.map((p) => ({ id: p.id, url: thumbUrl(data.photoUrls, p.storagePath) }))}
        action={saveCareAction.bind(null, id)}
      />
    </main>
  );
}
