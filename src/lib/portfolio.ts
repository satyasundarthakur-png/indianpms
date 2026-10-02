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

export type Quote = { price: number; date: string };
type Cashflow = { amount: number; date: Date };

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const buyDateOf = (s: Stock) => new Date(`${s.buy_date}T00:00:00`);

/**
 * Solves for the annualized rate (in %) at which the cashflows' NPV is zero,
 * by bisection — no external dependency needed. Returns null when there is no
 * sensible solution (no sign change, non-finite values, rate outside -99.99%..1000%).
 */
function xirrFromCashflows(cashflows: Cashflow[]): number | null {
  if (cashflows.length < 2) return null;
  const firstDate = Math.min(...cashflows.map((cf) => cf.date.getTime()));
  const npv = (rate: number) =>
    cashflows.reduce((sum, cf) => {
      const years = (cf.date.getTime() - firstDate) / MS_PER_YEAR;
      return sum + cf.amount / Math.pow(1 + rate, years);
    }, 0);

  let lo = -0.9999;
  let hi = 10;
  const loVal = npv(lo);
  const hiVal = npv(hi);
  if (!Number.isFinite(loVal) || !Number.isFinite(hiVal) || loVal * hiVal > 0) return null;

  let loSign = loVal;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const midVal = npv(mid);
    if (Math.abs(midVal) < 1e-6) return mid * 100;
    if (midVal * loSign < 0) {
      hi = mid;
    } else {
      lo = mid;
      loSign = midVal;
    }
  }
  return ((lo + hi) / 2) * 100;
}

function xirrWithTerminal(stocks: Stock[], terminalValue: number): number | null {
  if (!stocks.length || !Number.isFinite(terminalValue) || terminalValue <= 0) return null;
  const cashflows: Cashflow[] = stocks.map((s) => ({
    amount: -Number(s.invested_amount),
    date: buyDateOf(s),
  }));
  cashflows.push({ amount: terminalValue, date: new Date() });
  return xirrFromCashflows(cashflows);
}

/**
 * "Target scenario" XIRR: each holding's buy date is a cash outflow and the
 * final inflow is the target-scenario value (or the invested amount where no
 * target is set). This is hypothetical — it assumes every target sells today.
 */
export function portfolioXirr(stocks: Stock[]): number | null {
  const terminal = stocks.reduce((sum, s) => sum + (projected(s) ?? Number(s.invested_amount)), 0);
  return xirrWithTerminal(stocks, terminal);
}

/**
 * Actual XIRR using live market prices as the final inflow. Needs a quote for
 * every holding — a partial set would silently understate value — otherwise null.
 */
export function portfolioXirrCurrent(
  stocks: Stock[],
  quotes: Record<string, Quote>,
): number | null {
  if (!stocks.length || stocks.some((s) => !quotes[s.id])) return null;
  const terminal = stocks.reduce((sum, s) => sum + quotes[s.id]!.price * Number(s.buy_stocks), 0);
  return xirrWithTerminal(stocks, terminal);
}

/**
 * Live P&L over the holdings that have a quote. Invested is summed over the same
 * holdings so profit/loss is apples-to-apples; `priced`/`total` say how complete it is.
 */
export function liveSummary(stocks: Stock[], quotes: Record<string, Quote>) {
  const priced = stocks.filter((s) => quotes[s.id]);
  const invested = priced.reduce((sum, s) => sum + Number(s.invested_amount), 0);
  const value = priced.reduce((sum, s) => sum + quotes[s.id]!.price * Number(s.buy_stocks), 0);
  return {
    priced: priced.length,
    total: stocks.length,
    invested,
    value: priced.length ? value : null,
    pnl: priced.length ? value - invested : null,
    pnlPct: priced.length && invested > 0 ? ((value - invested) / invested) * 100 : null,
  };
}

/**
 * Per-holding CAGR (%) from invested amount to current value. Returns null for
 * holds under one year (annualizing a few weeks produces misleading huge numbers).
 */
export function holdingCagr(stock: Stock, price: number, now: Date = new Date()): number | null {
  const invested = Number(stock.invested_amount);
  const value = price * Number(stock.buy_stocks);
  const years = (now.getTime() - buyDateOf(stock).getTime()) / MS_PER_YEAR;
  if (!(invested > 0) || !(value > 0) || !(years >= 1)) return null;
  return (Math.pow(value / invested, 1 / years) - 1) * 100;
}

/**
 * A target at/above the buy price is a profit target (hit when price rises to it);
 * one below the buy price is a stop-loss (hit when price falls to it).
 */
export type TargetKind = "profit" | "stop";
export const targetKind = (stock: Stock, target: Target): TargetKind =>
  target.price >= Number(stock.buy_price) ? "profit" : "stop";
export const isTargetHit = (stock: Stock, target: Target, price: number) =>
  targetKind(stock, target) === "profit" ? price >= target.price : price <= target.price;

export type TargetHit = {
  /** Stable key (includes price, so editing a target re-arms its alert). */
  key: string;
  stockId: string;
  stockName: string;
  kind: TargetKind;
  target: Target;
  price: number;
};

export function targetHits(stocks: Stock[], quotes: Record<string, Quote>): TargetHit[] {
  return stocks.flatMap((stock) => {
    const quote = quotes[stock.id];
    if (!quote) return [];
    return targets(stock)
      .filter((t) => isTargetHit(stock, t, quote.price))
      .map((target) => ({
        key: `${stock.id}:${target.id}:${target.price}`,
        stockId: stock.id,
        stockName: stock.stock_name,
        kind: targetKind(stock, target),
        target,
        price: quote.price,
      }));
  });
}

/**
 * Progress toward the nearest unreached profit target: current price as a % of
 * that target, capped at 100. null when the holding has no profit targets;
 * `allHit` when every profit target has been reached.
 */
export function targetProgressToNext(stock: Stock, price: number) {
  const profit = targets(stock).filter((t) => targetKind(stock, t) === "profit");
  if (!profit.length) return null;
  const pending = profit.filter((t) => price < t.price).sort((a, b) => a.price - b.price);
  if (!pending.length)
    return { pct: 100, target: Math.max(...profit.map((t) => t.price)), allHit: true };
  const next = pending[0]!;
  return {
    pct: Math.max(0, Math.min(100, (price / next.price) * 100)),
    target: next.price,
    allHit: false,
  };
}

/**
 * Shared rule for sell targets (used by the full editor and inline editing):
 * every target needs a positive price and share count, and together they can't
 * exceed the shares held. Returns an error message, or null if valid. A tiny
 * tolerance avoids rejecting fractional shares over floating-point noise
 * (0.1 + 0.2 > 0.3 in JS).
 */
export function validateTargets(
  plans: { price: number; stocks: number }[],
  held: number,
): string | null {
  if (
    plans.some(
      (p) =>
        !Number.isFinite(p.price) || !Number.isFinite(p.stocks) || p.price <= 0 || p.stocks <= 0,
    )
  )
    return "Each target needs a price and a share count above zero.";
  const allocated = plans.reduce((n, p) => n + p.stocks, 0);
  if (allocated > held + 1e-9)
    return `You only hold ${number(held)} shares — targets add up to ${number(allocated)}.`;
  return null;
}

/** Progress (0-100, clamped) of the target scenario vs. a user-set goal amount. */
export function goalProgress(projectedValue: number, goalAmount: number): number {
  if (!goalAmount || goalAmount <= 0) return 0;
  return Math.max(0, Math.min(100, (projectedValue / goalAmount) * 100));
}
