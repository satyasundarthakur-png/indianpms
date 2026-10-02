import { useEffect, useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money, number } from "@/lib/portfolio";
import { useCountUp } from "@/lib/useCountUp";

/**
 * A user-set portfolio goal (e.g. "₹25,00,000 for a house down payment"),
 * with an animated progress ring showing how close the target-scenario
 * value is to that goal. This is the "target-oriented portfolio" feature
 * common to Indian goal-based investing apps (Groww/ET Money "Goals",
 * Kuvera "Goal planning") — framed around the user's own number, not a
 * generic benchmark.
 *
 * The goal is stored client-side (localStorage, per user) rather than in
 * the stocks table: it's a planning aid, not portfolio data, and keeping
 * it local avoids a schema migration for this feature.
 */
export function GoalProgress({
  userId,
  projectedValue,
}: {
  userId: string;
  projectedValue: number;
}) {
  const storageKey = `predifolio-goal-${userId}`;
  const [goal, setGoal] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const parsed = saved ? Number(saved) : NaN;
    setGoal(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
  }, [storageKey]);

  const rawProgress = goal ? Math.max(0, Math.min(100, (projectedValue / goal) * 100)) : 0;
  const animatedProgress = useCountUp(rawProgress, 900);
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference * (1 - animatedProgress / 100);

  function save(e: FormEvent) {
    e.preventDefault();
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) return;
    window.localStorage.setItem(storageKey, String(amount));
    setGoal(amount);
    setEditing(false);
  }

  function clearGoal() {
    window.localStorage.removeItem(storageKey);
    setGoal(null);
    setEditing(false);
  }

  if (editing || !goal) {
    return (
      <form onSubmit={save} className="goal-card goal-card--empty">
        <p className="text-sm font-semibold">Set a portfolio goal</p>
        <p className="mt-1 text-xs text-muted-foreground">
          e.g. a house down payment, or a retirement number — track your target scenario against it.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            type="number"
            min="1"
            step="any"
            placeholder="Goal amount (₹)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus={editing}
          />
          <Button type="submit">Set</Button>
          {goal && (
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="goal-card">
      <svg viewBox="0 0 100 100" className="goal-ring" aria-hidden="true">
        <circle cx="50" cy="50" r="42" className="goal-ring-track" />
        <circle
          cx="50"
          cy="50"
          r="42"
          className="goal-ring-fill"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="goal-card-body">
        <p className="text-xs font-medium uppercase text-muted-foreground">Goal progress</p>
        <p className="mt-1 text-2xl font-semibold">{number(animatedProgress)}%</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Target scenario {money(projectedValue)} of {money(goal)} goal
        </p>
      </div>
      <div className="goal-card-actions">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setInput(String(goal));
            setEditing(true);
          }}
          aria-label="Edit goal"
          title="Edit goal"
        >
          <Pencil className="size-4" />
        </Button>
        <button
          type="button"
          onClick={clearGoal}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
