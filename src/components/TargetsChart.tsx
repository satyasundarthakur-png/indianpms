import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money, targetProgressToNext, type Quote, type Stock } from "@/lib/portfolio";
import { usePrefersReducedMotion } from "@/lib/useCountUp";

type Row = { name: string; pct: number; price: number; target: number; allHit: boolean };

const truncate = (s: string, n = 14) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Current price vs. next sell target, per holding. Prices differ wildly between
 * stocks, so bars show price as a % of the nearest unreached profit target
 * (100% = target reached); the rupee figures are in the tooltip.
 */
export function TargetsChart({
  stocks,
  quotes,
}: {
  stocks: Stock[];
  quotes: Record<string, Quote>;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const rows: Row[] = stocks.flatMap((s) => {
    const quote = quotes[s.id];
    if (!quote) return [];
    const progress = targetProgressToNext(s, quote.price);
    return progress
      ? [
          {
            name: s.stock_name,
            pct: progress.pct,
            price: quote.price,
            target: progress.target,
            allHit: progress.allHit,
          },
        ]
      : [];
  });

  return (
    <div className="allocation-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Progress to next sell target</h3>
        <p className="text-xs text-muted-foreground">Market price as % of target</p>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Add sell targets above your buy price and refresh prices to see progress here.
        </p>
      ) : (
        <div style={{ height: Math.max(140, rows.length * 40 + 36) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16, top: 0 }}>
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                stroke="var(--border)"
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tickFormatter={(v: string) => truncate(v)}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                stroke="var(--border)"
              />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
                  if (!row) return null;
                  return (
                    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                      <p className="font-semibold">{row.name}</p>
                      <p className="mt-1 text-muted-foreground">
                        {money(row.price)} → {row.allHit ? "all targets hit" : money(row.target)}
                      </p>
                      <p className="mt-0.5">{row.pct.toFixed(1)}% of target</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]} isAnimationActive={!reducedMotion}>
                {rows.map((r) => (
                  <Cell key={r.name} fill={r.allHit ? "var(--profit)" : "var(--chart-2)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
