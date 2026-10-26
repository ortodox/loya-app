import { notFound } from "next/navigation";
import { catalogRepository } from "@/data/repositories/server";
import { getPreparationDetail } from "@/logic/usecases/catalog";
import { PreparationView } from "./PreparationView";

export default async function PreparationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPreparationDetail(await catalogRepository(), id);
  if (!detail) notFound();
  return <PreparationView detail={detail} />;
}
