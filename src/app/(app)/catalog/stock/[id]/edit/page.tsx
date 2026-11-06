import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { formatIsoDate, todayIn } from "@/logic/rules/dates";
import { getStockLine } from "@/logic/usecases/stock";
import { correctStockAction } from "../../actions";
import { stockDeps } from "../../deps";
import { CorrectForm } from "./CorrectForm";

/** SK1 «Исправить остаток»: what is really there today. */
export default async function CorrectStockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const line = await getStockLine(await stockDeps(), id, todayIn(practiceTimeZone));
  if (!line) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <CorrectForm
        name={line.name}
        pieces={line.kind === "pieces" ? line.state.available : null}
        openVials={line.state.openVials.map((v) => ({ key: v.key, size: v.size, remaining: v.remaining, openedOn: formatIsoDate(v.openedOn) }))}
        closed={(line.vialSizes ?? []).map((size) => ({ size, count: line.state.closed.find((c) => c.size === size)?.count ?? 0 }))}
        action={correctStockAction.bind(null, line.itemId)}
      />
    </main>
  );
}
