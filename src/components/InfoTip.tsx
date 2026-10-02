import { useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * A small "i" that explains a financial term. Opens on hover (desktop) and on
 * tap/click or keyboard focus (touch/keyboard) — Radix Tooltip does not open on touch.
 */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${label}?`}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-64 p-3 text-xs font-normal normal-case leading-relaxed"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="mb-1 font-semibold">{label}</p>
        {text}
      </PopoverContent>
    </Popover>
  );
}

export const TERMS = {
  xirr: "Annualized return that accounts for when each purchase was made (money-weighted). Better than a simple % when you bought on different dates.",
  cagr: "Compound annual growth rate: the steady yearly return that would take your invested amount to its current value. Shown only for holdings held a year or more.",
  pnl: "Unrealised profit or loss: current market value minus the amount you invested, for holdings with a live price. Nothing is realised until you sell.",
  scenario:
    "What your holdings would be worth if every sell target were reached at its price. Shares without a target are valued at your buy price. It is a plan, not a forecast.",
  stopLoss:
    "A sell target set below your buy price. It is 'hit' when the market price falls to it.",
} as const;
