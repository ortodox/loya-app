import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { todayIn } from "@/logic/rules/dates";
import { getDocumentFormData } from "@/logic/usecases/documents";
import { documentDeps } from "../deps";
import { DocumentUploadForm } from "../DocumentUploadForm";

export default async function NewDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDocumentFormData(await documentDeps(), id);
  if (!data) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <DocumentUploadForm clientId={id} today={todayIn(practiceTimeZone)} courses={data.courses} />
    </main>
  );
}
