import { BellRing, X } from "lucide-react";
import { money, number, type TargetHit } from "@/lib/portfolio";
import { Button } from "@/components/ui/button";

/** In-app banner listing sell targets / stop-losses the live price has reached. */
export function TargetAlerts({ hits, onDismiss }: { hits: TargetHit[]; onDismiss: () => void }) {
  if (!hits.length) return null;
  return (
    <div role="status" className="alert-banner mt-6 border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <BellRing className="size-4 text-primary" />
          {hits.length === 1 ? "A sell target was reached" : `${hits.length} sell targets reached`}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 size-8"
          onClick={onDismiss}
          aria-label="Dismiss alerts"
        >
          <X />
        </Button>
      </div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {hits.map((h) => (
          <li key={h.key} className="flex flex-wrap items-baseline gap-x-2">
            <span
              className={`text-xs font-semibold uppercase ${h.kind === "profit" ? "text-profit" : "text-destructive"}`}
            >
              {h.kind === "profit" ? "Target" : "Stop-loss"}
            </span>
            <span className="font-medium">{h.stockName}</span>
            <span className="text-muted-foreground">
              {money(h.target.price)} reached (now {money(h.price)}) · {number(h.target.stocks)}{" "}
              shares planned
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
