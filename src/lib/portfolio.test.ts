import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goalProgress, portfolioXirr, projected, type Stock } from "./portfolio";

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
