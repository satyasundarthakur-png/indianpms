import type { Quote } from "@/lib/portfolio";

/**
 * Looks a stock up by name via the validated /api/screener proxy and returns its
 * latest price, or null if the symbol can't be resolved / market data is down.
 */
export async function fetchQuote(stockName: string): Promise<Quote | null> {
  try {
    const searchResponse = await fetch(`/api/screener?q=${encodeURIComponent(stockName)}`);
    const matches: unknown = await searchResponse.json();
    if (!Array.isArray(matches) || !matches.length) return null;
    const chartResponse = await fetch(`/api/screener?id=${(matches[0] as { id: number }).id}`);
    const chart = await chartResponse.json();
    const prices = chart?.datasets?.find((d: { metric: string }) => d.metric === "Price")?.values;
    const latest = prices?.[prices.length - 1];
    const price = latest ? Number(latest[1]) : NaN;
    return Number.isFinite(price) && price > 0 ? { price, date: String(latest[0]) } : null;
  } catch {
    return null;
  }
}
