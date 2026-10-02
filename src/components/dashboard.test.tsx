import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Stock } from "@/lib/portfolio";

const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => ({ update })) },
}));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }));

const { InlineTargets } = await import("./InlineTargets");
const { TargetAlerts } = await import("./TargetAlerts");
const { TargetsChart } = await import("./TargetsChart");

function stock(overrides: Partial<Stock> = {}): Stock {
  return {
    id: "s1",
    user_id: "u1",
    stock_name: "ACME",
    buy_date: "2025-01-01",
    buy_price: 100,
    buy_stocks: 10,
    invested_amount: 1000,
    notes: null,
    tags: null,
    sell_prediction_price: null,
    sell_predictions: [{ id: "t1", price: 120, stocks: 4 }],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

beforeEach(() => {
  eq.mockResolvedValue({ error: null });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InlineTargets", () => {
  it("shows live status for each target", () => {
    const s = stock({
      sell_predictions: [
        { id: "t1", price: 120, stocks: 4 },
        { id: "t2", price: 200, stocks: 4 },
      ],
    });
    render(
      <InlineTargets stock={s} quote={{ price: 125, date: "2026-10-02" }} onChange={vi.fn()} />,
    );
    expect(screen.getByText(/Hit ✓/)).toBeInTheDocument(); // 120 reached at 125
    expect(screen.getByText(/\+60\.0% away/)).toBeInTheDocument(); // 200 vs 125
  });

  it("saves an edited target to the database and notifies the parent", async () => {
    const onChange = vi.fn();
    render(<InlineTargets stock={stock()} quote={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit sell targets for ACME/ }));
    fireEvent.change(screen.getByLabelText("Target 1 price"), { target: { value: "130" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ sell_predictions: [{ id: "t1", price: 130, stocks: 4 }] }),
    );
    expect(eq).toHaveBeenCalledWith("id", "s1");
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("refuses to save targets that exceed the shares held", async () => {
    const onChange = vi.fn();
    render(<InlineTargets stock={stock()} quote={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit sell targets for ACME/ }));
    fireEvent.change(screen.getByLabelText("Target 1 shares"), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(update).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("refuses to save a blank or zero target", async () => {
    render(
      <InlineTargets
        stock={stock({ sell_predictions: [] })}
        quote={undefined}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Add sell targets for ACME/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" })); // blank row
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(update).not.toHaveBeenCalled();
  });

  it("cancel discards edits without writing", () => {
    render(<InlineTargets stock={stock()} quote={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit sell targets for ACME/ }));
    fireEvent.change(screen.getByLabelText("Target 1 price"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Target 1 price")).not.toBeInTheDocument();
  });
});

describe("TargetAlerts", () => {
  const hit = {
    key: "s1:t1:120",
    stockId: "s1",
    stockName: "ACME",
    kind: "profit" as const,
    target: { id: "t1", price: 120, stocks: 4 },
    price: 125,
  };

  it("renders nothing when there are no hits", () => {
    const { container } = render(<TargetAlerts hits={[]} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists hits and can be dismissed", () => {
    const onDismiss = vi.fn();
    render(<TargetAlerts hits={[hit]} onDismiss={onDismiss} />);
    expect(screen.getByText("ACME")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss alerts" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("labels stop-losses distinctly", () => {
    render(<TargetAlerts hits={[{ ...hit, kind: "stop" }]} onDismiss={vi.fn()} />);
    expect(screen.getByText("Stop-loss")).toBeInTheDocument();
  });
});

describe("TargetsChart", () => {
  it("shows guidance instead of an empty chart when nothing is plottable", () => {
    render(<TargetsChart stocks={[stock()]} quotes={{}} />);
    expect(screen.getByText(/refresh prices to see progress/i)).toBeInTheDocument();
  });
});
