import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { todayIn } from "@/logic/rules/dates";
import { getStockLine } from "@/logic/usecases/stock";
import { receiveStockAction } from "../../../actions";
import { stockDeps } from "../../../deps";
import { ReceiptForm } from "./ReceiptForm";

/** SK1 «+ Поступление». */
export default async function NewReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = todayIn(practiceTimeZone);
  const line = await getStockLine(await stockDeps(), id, today);
  if (!line) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <ReceiptForm name={line.name} vialSizes={line.vialSizes} today={today} action={receiveStockAction.bind(null, line.itemId)} />
    </main>
  );
}
