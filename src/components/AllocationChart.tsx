import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { money, type Stock } from "@/lib/portfolio";
import { usePrefersReducedMotion } from "@/lib/useCountUp";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Colorful, animated allocation donut — shows how invested capital is spread across holdings. */
export function AllocationChart({ stocks }: { stocks: Stock[] }) {
  const reducedMotion = usePrefersReducedMotion();
  const data = [...stocks]
    .sort((a, b) => Number(b.invested_amount) - Number(a.invested_amount))
    .map((s) => ({ name: s.stock_name, value: Number(s.invested_amount) }));

  // Show at most PALETTE.length slices (top N-1 + "Other") so no two slices share a color.
  const maxNamed = PALETTE.length - 1;
  const top = data.length > PALETTE.length ? data.slice(0, maxNamed) : data;
  const restTotal = data.slice(top.length).reduce((sum, d) => sum + d.value, 0);
  const slices = restTotal > 0 ? [...top, { name: "Other", value: restTotal }] : top;

  if (!slices.length) return null;

  return (
    <div className="allocation-card">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Allocation</h3>
        <p className="text-xs text-muted-foreground">By amount invested</p>
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="h-48 w-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="100%"
                paddingAngle={2}
                animationBegin={100}
                animationDuration={700}
                isAnimationActive={!reducedMotion}
              >
                {slices.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="var(--card)" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => money(value)}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="grid w-full min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2">
          {slices.map((d, i) => (
            <li key={`${i}-${d.name}`} className="flex min-w-0 items-center gap-2 text-xs">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="min-w-0 flex-1 truncate" title={d.name}>
                {d.name}
              </span>
              <span className="shrink-0 font-medium text-muted-foreground">{money(d.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
