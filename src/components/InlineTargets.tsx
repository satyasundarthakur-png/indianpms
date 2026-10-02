import { useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  isTargetHit,
  money,
  number,
  targetKind,
  targets,
  validateTargets,
  type Quote,
  type Stock,
  type Target,
} from "@/lib/portfolio";
import { InfoTip, TERMS } from "@/components/InfoTip";

type Draft = { id: string; price: string; stocks: string };
const toDrafts = (list: Target[]): Draft[] =>
  list.map((t) => ({ id: t.id, price: String(t.price), stocks: String(t.stocks) }));

/** Sell targets for one holding: collapsible list with live status, editable in place. */
export function InlineTargets({
  stock,
  quote,
  onChange,
}: {
  stock: Stock;
  quote: Quote | undefined;
  onChange: () => void;
}) {
  const plans = targets(stock);
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const held = Number(stock.buy_stocks);

  const parsed = drafts.map((d) => ({
    id: d.id,
    price: Number(d.price),
    stocks: Number(d.stocks),
  }));
  const allocated = parsed.reduce((n, p) => n + (Number.isFinite(p.stocks) ? p.stocks : 0), 0);
  const validationError = validateTargets(parsed, held);
  const overAllocated = allocated > held + 1e-9;

  function startEditing() {
    setDrafts(
      plans.length ? toDrafts(plans) : [{ id: crypto.randomUUID(), price: "", stocks: "" }],
    );
    setOpen(true);
    setEditing(true);
  }

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function save() {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("stocks")
      .update({ sell_predictions: parsed, updated_at: new Date().toISOString() })
      .eq("id", stock.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sell targets updated");
    setEditing(false);
    onChange();
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            aria-label={`${open ? "Collapse" : "Expand"} sell targets for ${stock.stock_name}`}
          >
            <ChevronDown className="size-3.5 transition-transform group-data-[state=closed]:-rotate-90" />
            Sell targets ({plans.length})
          </button>
        </CollapsibleTrigger>
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={startEditing}
            aria-label={`${plans.length ? "Edit" : "Add"} sell targets for ${stock.stock_name}`}
          >
            {plans.length ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
            {plans.length ? "Edit" : "Add target"}
          </Button>
        )}
      </div>
      <CollapsibleContent>
        {editing ? (
          <div className="mt-3 space-y-2">
            {drafts.map((d, i) => (
              <div key={d.id} className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  className="h-9 min-w-0"
                  placeholder="Price ₹"
                  aria-label={`Target ${i + 1} price`}
                  value={d.price}
                  onChange={(e) => update(d.id, { price: e.target.value })}
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  className="h-9 min-w-0"
                  placeholder="Shares"
                  aria-label={`Target ${i + 1} shares`}
                  value={d.stocks}
                  onChange={(e) => update(d.id, { stocks: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => setDrafts((all) => all.filter((x) => x.id !== d.id))}
                  aria-label={`Remove target ${i + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <p
              className={`text-xs ${overAllocated ? "text-destructive" : "text-muted-foreground"}`}
            >
              {number(allocated)} of {number(held)} shares allocated
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDrafts((all) => [...all, { id: crypto.randomUUID(), price: "", stocks: "" }])
                }
              >
                <Plus /> Target
              </Button>
              <Button size="sm" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        ) : plans.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No sell targets yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {plans.map((t) => {
              const kind = targetKind(stock, t);
              const hit = quote ? isTargetHit(stock, t, quote.price) : false;
              const away = quote ? (t.price / quote.price - 1) * 100 : null;
              return (
                <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    {number(t.stocks)} at {money(t.price)}
                    {kind === "stop" && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-destructive">
                        stop-loss <InfoTip label="Stop-loss" text={TERMS.stopLoss} />
                      </span>
                    )}
                  </span>
                  {quote &&
                    (hit ? (
                      <span
                        className={`font-semibold ${kind === "profit" ? "text-profit" : "text-destructive"}`}
                      >
                        Hit ✓
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {away !== null && `${away > 0 ? "+" : ""}${away.toFixed(1)}% away`}
                      </span>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
