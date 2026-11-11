/**
 * MG9: today's € selling rate from Narodowy Bank Polski (table C, «sprzedaż»). Public, no key, no personal
 * data sent. Cached for an hour; null when NBP does not answer (then the last rate saved is used).
 */
export async function fetchNbpEurRate(): Promise<{ rate: number; date: string } | null> {
  try {
    const res = await fetch("https://api.nbp.pl/api/exchangerates/rates/c/eur/?format=json", {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { rates?: { effectiveDate?: string; ask?: number }[] };
    const last = body.rates?.[body.rates.length - 1];
    if (!last?.ask || !last.effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(last.effectiveDate)) return null;
    return { rate: last.ask, date: last.effectiveDate };
  } catch {
    return null;
  }
}
