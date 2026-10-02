import type { Tables } from "@/integrations/supabase/types";

export type Stock = Tables<"stocks">;
export type Target = { id: string; price: number; stocks: number };
export const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
export const number = (value: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
export function targets(stock: Stock): Target[] {
  if (!Array.isArray(stock.sell_predictions)) return [];
  return stock.sell_predictions.filter(
    (item): item is Target =>
      !!item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof item["price"] === "number" &&
      typeof item["stocks"] === "number" &&
      typeof item["id"] === "string",
  );
}
export function projected(stock: Stock) {
  const plans = targets(stock);
  let remaining = Number(stock.buy_stocks);
  let value = 0;
  for (const plan of plans) {
    const shares = Math.min(remaining, Math.max(0, Number(plan.stocks)));
    value += shares * Number(plan.price);
    remaining -= shares;
  }
  return plans.length ? value + remaining * Number(stock.buy_price) : null;
}
export function summary(stocks: Stock[]) {
  const invested = stocks.reduce((sum, s) => sum + Number(s.invested_amount), 0);
  const projectedValue = stocks.reduce(
    (sum, s) => sum + (projected(s) ?? Number(s.invested_amount)),
    0,
  );
  const withTargets = stocks.filter((s) => projected(s) !== null).length;
  return {
    invested,
    projectedValue,
    potential: projectedValue - invested,
    percentage: invested ? ((projectedValue - invested) / invested) * 100 : 0,
    withTargets,
  };
}
