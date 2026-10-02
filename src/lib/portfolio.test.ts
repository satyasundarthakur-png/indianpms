import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  goalProgress,
  holdingCagr,
  isTargetHit,
  liveSummary,
  portfolioXirr,
  portfolioXirrCurrent,
  projected,
  targetHits,
  targetKind,
  targetProgressToNext,
  type Quote,
  type Stock,
} from "./portfolio";

const TODAY = new Date("2026-10-02T12:00:00");

function stock(overrides: Partial<Stock> = {}): Stock {
  return {
    id: "s1",
    user_id: "u1",
    stock_name: "TEST",
    buy_date: "2025-10-02",
    buy_price: 100,
    buy_stocks: 10,
    invested_amount: 1000,
    notes: null,
    tags: null,
    sell_prediction_price: null,
    sell_predictions: [],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("portfolioXirr", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });
  afterEach(() => vi.useRealTimers());

  it("returns null for an empty portfolio", () => {
    expect(portfolioXirr([])).toBeNull();
  });

  it("is ~0% when there are no targets (terminal value == invested)", () => {
    expect(portfolioXirr([stock()])!).toBeCloseTo(0, 1);
  });

  it("is ~10% for 1000 -> 1100 over one year", () => {
    const s = stock({
      sell_predictions: [{ id: "t1", price: 110, stocks: 10 }],
    });
    expect(projected(s)).toBe(1100);
    // 365 days / 365.25 days-per-year, so allow a small tolerance.
    expect(portfolioXirr([s])!).toBeCloseTo(10, 0);
  });

  it("is negative when the target is below cost", () => {
    const s = stock({ sell_predictions: [{ id: "t1", price: 90, stocks: 10 }] });
    expect(portfolioXirr([s])!).toBeLessThan(0);
  });

  it("weights by buy date: a later buy with the same gain annualizes higher", () => {
    const early = stock({ sell_predictions: [{ id: "t", price: 110, stocks: 10 }] });
    const late = stock({
      buy_date: "2026-04-02",
      sell_predictions: [{ id: "t", price: 110, stocks: 10 }],
    });
    expect(portfolioXirr([late])!).toBeGreaterThan(portfolioXirr([early])!);
  });
});

describe("goalProgress", () => {
  it("clamps to 0-100 and guards invalid goals", () => {
    expect(goalProgress(50, 100)).toBe(50);
    expect(goalProgress(500, 100)).toBe(100);
    expect(goalProgress(-5, 100)).toBe(0);
    expect(goalProgress(50, 0)).toBe(0);
    expect(goalProgress(50, -10)).toBe(0);
  });
});

const q = (price: number): Quote => ({ price, date: "2026-10-02" });

describe("live portfolio metrics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });
  afterEach(() => vi.useRealTimers());

  it("liveSummary computes P&L only over priced holdings", () => {
    const a = stock({ id: "a" }); // 10 sh, invested 1000
    const b = stock({ id: "b", buy_stocks: 5, invested_amount: 500 });
    const live = liveSummary([a, b], { a: q(120) });
    expect(live).toMatchObject({ priced: 1, total: 2, invested: 1000, value: 1200, pnl: 200 });
    expect(live.pnlPct).toBeCloseTo(20);
  });

  it("liveSummary is null-valued when nothing is priced", () => {
    expect(liveSummary([stock()], {})).toMatchObject({
      priced: 0,
      value: null,
      pnl: null,
      pnlPct: null,
    });
  });

  it("portfolioXirrCurrent needs a quote for every holding", () => {
    const a = stock({ id: "a" });
    const b = stock({ id: "b" });
    expect(portfolioXirrCurrent([a, b], { a: q(110) })).toBeNull();
    // 1000 -> 1100 over ~1 year each => ~10%
    expect(portfolioXirrCurrent([a, b], { a: q(110), b: q(110) })!).toBeCloseTo(10, 0);
  });

  it("holdingCagr annualizes over holds of a year or more and skips shorter ones", () => {
    // 1000 -> 1210 over exactly 2 years (730 days ~ 1.9986y) => ~10%
    const two = stock({ buy_date: "2024-10-02" });
    expect(holdingCagr(two, 121, TODAY)!).toBeCloseTo(10, 0);
    const recent = stock({ buy_date: "2026-08-02" });
    expect(holdingCagr(recent, 150, TODAY)).toBeNull();
    expect(holdingCagr(two, 0, TODAY)).toBeNull();
  });
});

describe("sell target alerts", () => {
  const p1 = { id: "p1", price: 120, stocks: 4 }; // profit target
  const p2 = { id: "p2", price: 150, stocks: 4 }; // profit target
  const sl = { id: "sl", price: 80, stocks: 2 }; // stop-loss (below buy price of 100)
  const s = stock({ sell_predictions: [p1, p2, sl] });

  it("classifies targets by buy price", () => {
    expect(targetKind(s, { id: "x", price: 100, stocks: 1 })).toBe("profit");
    expect(targetKind(s, { id: "x", price: 99.99, stocks: 1 })).toBe("stop");
  });

  it("profit targets hit when price rises to them; stops when price falls to them", () => {
    expect(isTargetHit(s, p1, 120)).toBe(true);
    expect(isTargetHit(s, p1, 119.9)).toBe(false);
    expect(isTargetHit(s, sl, 80)).toBe(true);
    expect(isTargetHit(s, sl, 95)).toBe(false);
  });

  it("targetHits returns only reached targets and ignores unpriced holdings", () => {
    expect(targetHits([s], {})).toEqual([]);
    expect(targetHits([s], { [s.id]: q(125) }).map((h) => h.target.id)).toEqual(["p1"]);
    expect(targetHits([s], { [s.id]: q(70) }).map((h) => [h.target.id, h.kind])).toEqual([
      ["sl", "stop"],
    ]);
  });

  it("hit keys change when a target price is edited (re-arms the alert)", () => {
    const edited = { ...s, sell_predictions: [{ id: "p1", price: 110, stocks: 4 }] };
    const before = targetHits([s], { [s.id]: q(125) })[0]!.key;
    const after = targetHits([edited], { [s.id]: q(125) })[0]!.key;
    expect(before).not.toBe(after);
  });

  it("targetProgressToNext tracks the nearest unreached profit target", () => {
    expect(targetProgressToNext(s, 90)).toEqual({ pct: 75, target: 120, allHit: false });
    expect(targetProgressToNext(s, 130)).toMatchObject({ target: 150, allHit: false });
    expect(targetProgressToNext(s, 130)!.pct).toBeCloseTo((130 / 150) * 100);
    expect(targetProgressToNext(s, 200)).toEqual({ pct: 100, target: 150, allHit: true });
    expect(targetProgressToNext(stock(), 100)).toBeNull();
  });
});
