import { notFound } from "next/navigation";
import { catalogRepository } from "@/data/repositories/server";
import { getTypeDetail } from "@/logic/usecases/catalog";
import { TypeView } from "./TypeView";

export default async function TypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getTypeDetail(await catalogRepository(), id);
  if (!detail) notFound();
  return <TypeView detail={detail} />;
}
