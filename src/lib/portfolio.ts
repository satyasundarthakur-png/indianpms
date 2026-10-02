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

/**
 * Money-weighted annualized return (XIRR) across all holdings, treating the
 * buy date of each holding as a cash outflow and today's target-scenario
 * value (or invested amount, if no target is set) as the final inflow.
 * This is the headline number Indian portfolio apps (Groww, Kuvera, INDmoney)
 * surface next to simple % return, since it accounts for *when* money went in.
 *
 * Solved via bisection on the NPV function — no external dependency needed.
 */
export function portfolioXirr(stocks: Stock[]): number | null {
  if (!stocks.length) return null;
  const today = new Date();
  const firstBuyDate = stocks.reduce(
    (earliest, s) => {
      const d = new Date(`${s.buy_date}T00:00:00`);
      return d < earliest ? d : earliest;
    },
    new Date(`${stocks[0]!.buy_date}T00:00:00`),
  );
  const cashflows = stocks.map((s) => ({
    amount: -Number(s.invested_amount),
    date: new Date(`${s.buy_date}T00:00:00`),
  }));
  const terminalValue = stocks.reduce(
    (sum, s) => sum + (projected(s) ?? Number(s.invested_amount)),
    0,
  );
  if (terminalValue <= 0) return null;
  cashflows.push({ amount: terminalValue, date: today });

  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const firstDate = firstBuyDate.getTime();
  const npv = (rate: number) =>
    cashflows.reduce((sum, cf) => {
      const years = (cf.date.getTime() - firstDate) / msPerYear;
      return sum + cf.amount / Math.pow(1 + rate, years);
    }, 0);

  let lo = -0.9999;
  let hi = 10;
  let loVal = npv(lo);
  let hiVal = npv(hi);
  if (!Number.isFinite(loVal) || !Number.isFinite(hiVal) || loVal * hiVal > 0) return null;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const midVal = npv(mid);
    if (Math.abs(midVal) < 1e-6) return mid * 100;
    if (midVal * loVal < 0) {
      hi = mid;
      hiVal = midVal;
    } else {
      lo = mid;
      loVal = midVal;
    }
  }
  return ((lo + hi) / 2) * 100;
}

/** Progress (0-100, clamped) of the target scenario vs. a user-set goal amount. */
export function goalProgress(projectedValue: number, goalAmount: number): number {
  if (!goalAmount || goalAmount <= 0) return 0;
  return Math.max(0, Math.min(100, (projectedValue / goalAmount) * 100));
}
