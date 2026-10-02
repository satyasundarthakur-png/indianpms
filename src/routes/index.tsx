import { createFileRoute } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import type { User } from "@supabase/supabase-js";
import type { Quote, Stock, Target } from "@/lib/portfolio";
import {
  holdingCagr,
  liveSummary,
  money,
  number,
  portfolioXirr,
  portfolioXirrCurrent,
  projected,
  summary,
  targetHits,
  targets,
  validateTargets,
} from "@/lib/portfolio";
import { fetchQuote } from "@/lib/quotes";
import { toCsv } from "@/lib/csv";
import { readStorage, writeStorage } from "@/lib/storage";
import type { AiProviderId, AiProviderStatus } from "@/lib/ai-providers";
import { getAiProviders, getPortfolioInsight } from "@/lib/insights.functions";
import { useCountUp } from "@/lib/useCountUp";
import { AllocationChart } from "@/components/AllocationChart";
import { GoalProgress } from "@/components/GoalProgress";
import { InfoTip, TERMS } from "@/components/InfoTip";
import { InlineTargets } from "@/components/InlineTargets";
import { Section } from "@/components/Section";
import { TargetAlerts } from "@/components/TargetAlerts";
import { TargetsChart } from "@/components/TargetsChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Gauge,
  Send,
  Sun,
  Target as TargetIcon,
  Trash2,
  TrendingUp,
  X,
  Pencil,
} from "lucide-react";

const THEME_KEY = "predifolio-theme";
const AI_PROVIDER_KEY = "predifolio-ai-provider";
type Suggestion = { id: number; name: string };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const emptyForm = () => ({
  stock_name: "",
  buy_date: today(),
  buy_price: "",
  buy_stocks: "",
  notes: "",
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PrediFolio — Portfolio & Sell Target Tracker" },
      {
        name: "description",
        content:
          "Track Indian stock holdings, model sell targets, and explore AI-powered portfolio insights.",
      },
      { property: "og:title", content: "PrediFolio — Portfolio & Sell Target Tracker" },
      {
        property: "og:description",
        content:
          "Track Indian stock holdings, model sell targets, and explore AI-powered portfolio insights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = readStorage(THEME_KEY) === "dark";
    setDark(saved);
    document.documentElement.classList.toggle("dark", saved);
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        /* offline or auth service down: fall through to the sign-in screen instead of hanging */
      })
      .finally(() => {
        if (active) setReady(true);
      });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    writeStorage(THEME_KEY, next ? "dark" : "light");
  }
  return (
    <>
      <Toaster position="top-right" richColors />
      {!ready ? (
        <div className="flex min-h-screen items-center justify-center">
          <Activity className="animate-pulse text-primary" />
        </div>
      ) : user ? (
        <Portfolio key={user.id} user={user} dark={dark} toggleTheme={toggleTheme} />
      ) : (
        <Auth dark={dark} toggleTheme={toggleTheme} />
      )}
    </>
  );
}

function Auth({ dark, toggleTheme }: { dark: boolean; toggleTheme: () => void }) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const result = signup
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name.trim() } },
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) setNotice(result.error.message);
      else if (signup && !result.data.session)
        setNotice("Check your inbox to confirm your email, then sign in.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setNotice("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) setNotice(result.error.message);
      if (!result.redirected) setBusy(false);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Google sign-in failed. Please try again.");
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Brand />
        <ThemeToggle dark={dark} toggleTheme={toggleTheme} />
      </header>
      <main className="mx-auto grid min-h-[calc(100vh-90px)] max-w-7xl items-center gap-14 px-6 pb-16 lg:grid-cols-[1.15fr_.85fr]">
        <section className="relative overflow-hidden py-8">
          <div className="mb-7 inline-flex items-center gap-2 border-l-2 border-primary pl-3 text-xs font-bold uppercase text-primary">
            Your market, in perspective
          </div>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.08] sm:text-7xl">
            Know your holdings.
            <br />
            <span className="text-primary">Plan your next move.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-relaxed text-muted-foreground">
            A clearer view of what you own, where you want to sell, and how each decision shapes
            your portfolio.
          </p>
          <div className="mt-12 grid max-w-md grid-cols-3 gap-5 border-t border-border pt-6 text-sm">
            <div>
              <TargetIcon className="mb-3 text-primary" />
              <span className="font-medium">Sell targets</span>
            </div>
            <div>
              <Activity className="mb-3 text-primary" />
              <span className="font-medium">Market prices</span>
            </div>
            <div>
              <BrainCircuit className="mb-3 text-primary" />
              <span className="font-medium">AI insights</span>
            </div>
          </div>
          <div className="market-art" aria-hidden="true">
            <div className="market-bars">
              {[25, 40, 35, 57, 48, 66, 58, 80, 72, 88, 78, 100].map((height, i) => (
                <span key={i} style={{ height: `${height}%` }} />
              ))}
            </div>
            <svg viewBox="0 0 600 200" preserveAspectRatio="none">
              <polyline points="0,180 60,165 110,175 165,138 210,145 270,100 315,115 375,75 420,95 475,42 530,63 600,12" />
            </svg>
          </div>
        </section>
        <section className="w-full max-w-md justify-self-center border border-border bg-card p-7 shadow-sm sm:p-9">
          <div className="mb-8 flex border-b border-border">
            <Button
              variant="ghost"
              className={`flex-1 rounded-none border-b-2 ${!signup ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              onClick={() => {
                setSignup(false);
                setNotice("");
              }}
            >
              Sign in
            </Button>
            <Button
              variant="ghost"
              className={`flex-1 rounded-none border-b-2 ${signup ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              onClick={() => {
                setSignup(true);
                setNotice("");
              }}
            >
              Create account
            </Button>
          </div>
          <h2 className="text-2xl font-semibold">
            {signup ? "Start your portfolio" : "Welcome back"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {signup ? "Create an account to save your holdings." : "Sign in to see your portfolio."}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            {signup && (
              <label className="block text-sm font-medium">
                Full name
                <Input
                  className="mt-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                />
              </label>
            )}
            <label className="block text-sm font-medium">
              Email address
              <Input
                className="mt-2"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <div className="relative mt-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete={signup ? "new-password" : "current-password"}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 6 characters"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </label>
            {notice && (
              <p role="status" className="text-sm text-destructive">
                {notice}
              </p>
            )}
            <Button type="submit" disabled={busy} className="h-11 w-full">
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
            </Button>
          </form>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            OR
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="h-11 w-full" disabled={busy} onClick={google}>
            Continue with Google
          </Button>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Your holdings stay private to your account.
          </p>
        </section>
      </main>
    </div>
  );
}
function ThemeToggle({ dark, toggleTheme }: { dark: boolean; toggleTheme: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      title={dark ? "Light mode" : "Dark mode"}
      aria-label="Toggle theme"
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 text-xl font-bold">
      <span className="flex size-9 items-center justify-center bg-primary text-primary-foreground">
        <TrendingUp size={20} />
      </span>
      Predi<span className="-ml-2.5 text-primary">Folio</span>
    </div>
  );
}

function Portfolio({
  user,
  dark,
  toggleTheme,
}: {
  user: User;
  dark: boolean;
  toggleTheme: () => void;
}) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Stock | "new" | null>(null);
  const [insights, setInsights] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "value">("recent");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quotesBusy, setQuotesBusy] = useState(false);
  const [dismissedHits, setDismissedHits] = useState("");
  const attempted = useRef(new Set<string>());
  const inflight = useRef(0);
  async function load() {
    const { data, error } = await supabase
      .from("stocks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setStocks(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);
  /** Fetches quotes for the given holdings and merges them into state; returns how many succeeded. */
  async function fetchQuotesFor(list: Stock[]) {
    if (!list.length) return 0;
    inflight.current += 1;
    setQuotesBusy(true);
    // Holdings of the same stock (several buys) share one lookup.
    const lookups = new Map<string, Promise<Quote | null>>();
    const lookup = (name: string) => {
      const key = name.trim().toLowerCase();
      if (!lookups.has(key)) lookups.set(key, fetchQuote(name));
      return lookups.get(key)!;
    };
    const pairs = await Promise.all(
      list.map(async (stock) => [stock.id, await lookup(stock.stock_name)] as const),
    );
    const fresh = pairs.filter((p): p is readonly [string, Quote] => p[1] !== null);
    setQuotes((prev) => ({ ...prev, ...Object.fromEntries(fresh) }));
    inflight.current -= 1;
    if (inflight.current === 0) setQuotesBusy(false);
    return fresh.length;
  }
  async function refreshPrices() {
    const ok = await fetchQuotesFor(stocks);
    if (stocks.length && !ok) toast.error("Market prices are temporarily unavailable.");
  }
  // Price every holding we haven't tried yet: all of them on first load, and any newly added later.
  useEffect(() => {
    const pending = stocks.filter((s) => !attempted.current.has(s.id));
    if (!pending.length) return;
    pending.forEach((s) => attempted.current.add(s.id));
    void fetchQuotesFor(pending);
  }, [stocks]);
  const hits = useMemo(() => targetHits(stocks, quotes), [stocks, quotes]);
  const hitsKey = hits.map((h) => h.key).join("|");
  // Toast once per newly reached target (remembered per user; editing a target's price re-arms it).
  useEffect(() => {
    if (!hits.length) return;
    const storageKey = `predifolio-seen-hits-${user.id}`;
    let seen: string[] = [];
    try {
      const raw: unknown = JSON.parse(readStorage(storageKey) ?? "[]");
      seen = Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string") : [];
    } catch {
      seen = [];
    }
    const fresh = hits.filter((h) => !seen.includes(h.key));
    if (!fresh.length) return;
    const first = fresh[0]!;
    const message =
      fresh.length === 1
        ? `${first.stockName}: ${first.kind === "profit" ? "sell target" : "stop-loss"} ${money(first.target.price)} reached`
        : `${fresh.length} sell targets reached`;
    if (fresh.some((h) => h.kind === "stop")) toast.warning(message);
    else toast.success(message);
    writeStorage(storageKey, JSON.stringify([...seen, ...fresh.map((h) => h.key)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitsKey, user.id]);
  const totals = summary(stocks);
  const xirr = portfolioXirr(stocks);
  const live = liveSummary(stocks, quotes);
  const xirrLive = portfolioXirrCurrent(stocks, quotes);
  const pricedNote =
    live.total === 0
      ? ""
      : live.priced === live.total
        ? "Live market prices"
        : live.priced === 0
          ? quotesBusy
            ? "Fetching prices…"
            : "Prices unavailable — tap Prices"
          : `${live.priced} of ${live.total} holdings priced`;
  const filtered = stocks
    .filter((s) => s.stock_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "name"
        ? a.stock_name.localeCompare(b.stock_name)
        : sort === "value"
          ? Number(b.invested_amount) - Number(a.invested_amount)
          : b.created_at.localeCompare(a.created_at),
    );
  function exportCsv() {
    const rows = [
      [
        "Stock",
        "Buy date",
        "Buy price",
        "Shares",
        "Invested",
        "Sell targets",
        "Projected value",
        "Notes",
      ],
      ...stocks.map((s) => [
        s.stock_name,
        s.buy_date,
        s.buy_price,
        s.buy_stocks,
        s.invested_amount,
        targets(s)
          .map((t) => `${t.stocks} @ ${t.price}`)
          .join("; "),
        projected(s) ?? "",
        s.notes ?? "",
      ]),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    a.download = "predifolio-holdings.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Brand />
          <div className="flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">
              {user.user_metadata?.["full_name"] || user.email}
            </span>
            <ThemeToggle dark={dark} toggleTheme={toggleTheme} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => supabase.auth.signOut()}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-primary">Portfolio overview</p>
            <h1 className="text-3xl font-semibold sm:text-4xl">Your holdings</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Track purchases and plan target-based outcomes.
            </p>
          </div>
          <Button className="h-10" onClick={() => setEditor("new")}>
            <Plus />
            Add holding
          </Button>
        </div>
        <div className="metric-strip grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Amount invested"
            amount={totals.invested}
            sub={`${stocks.length} holding${stocks.length === 1 ? "" : "s"}`}
            accent="var(--chart-1)"
          />
          <Metric
            label="Current value"
            amount={live.value}
            sub={pricedNote || "Add a holding to begin"}
            accent="var(--chart-2)"
          />
          <Metric
            label="Unrealised P&L"
            amount={live.pnl}
            sub={
              live.pnlPct === null
                ? "Needs a live price"
                : `${live.pnlPct > 0 ? "+" : ""}${number(live.pnlPct)}% on priced holdings`
            }
            positive={(live.pnl ?? 0) > 0}
            negative={(live.pnl ?? 0) < 0}
            info={{ label: "Unrealised P&L", text: TERMS.pnl }}
            accent="var(--chart-3)"
          />
          <Metric
            label="XIRR"
            amount={xirrLive}
            suffix="%"
            sub={
              xirrLive === null ? "Needs prices for every holding" : "Annualized, money-weighted"
            }
            positive={(xirrLive ?? 0) > 0}
            negative={(xirrLive ?? 0) < 0}
            info={{ label: "XIRR", text: TERMS.xirr }}
            icon={<Gauge className="size-3.5" />}
            accent="var(--chart-5)"
          />
        </div>
        {hits.length > 0 && dismissedHits !== hitsKey && (
          <TargetAlerts hits={hits} onDismiss={() => setDismissedHits(hitsKey)} />
        )}
        <Section
          className="mt-8"
          title="If your targets are hit"
          description="A plan-based scenario, separate from live market value"
        >
          <div className="metric-strip mt-4 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Target scenario"
              amount={totals.projectedValue}
              sub={`${totals.withTargets} with sell targets`}
              info={{ label: "Target scenario", text: TERMS.scenario }}
              accent="var(--chart-1)"
            />
            <Metric
              label="Potential difference"
              amount={totals.potential}
              sub="Against amount invested"
              positive={totals.potential > 0}
              negative={totals.potential < 0}
              accent="var(--chart-3)"
            />
            <Metric
              label="Potential return"
              amount={totals.percentage}
              suffix="%"
              sub="Based on sell targets"
              positive={totals.percentage > 0}
              negative={totals.percentage < 0}
              accent="var(--chart-4)"
            />
            <Metric
              label="Scenario XIRR"
              amount={xirr}
              suffix="%"
              sub={
                xirr === null || totals.withTargets === 0
                  ? "Need at least one target"
                  : "If targets sold today"
              }
              positive={(xirr ?? 0) > 0}
              negative={(xirr ?? 0) < 0}
              info={{ label: "XIRR", text: TERMS.xirr }}
              icon={<Gauge className="size-3.5" />}
              accent="var(--chart-5)"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Target scenarios are estimates, not live valuations or guaranteed returns. Market prices
            may be delayed.
          </p>
        </Section>
        {stocks.length > 0 && (
          <Section
            className="mt-8"
            title="Overview"
            description="Goal, allocation and target progress"
          >
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
              <GoalProgress userId={user.id} projectedValue={totals.projectedValue} />
              <AllocationChart stocks={stocks} />
            </div>
            <div className="mt-4">
              <TargetsChart stocks={stocks} quotes={quotes} />
            </div>
          </Section>
        )}
        <Section
          className="mt-10"
          title="Holdings"
          count={stocks.length}
          description="Your positions and planned exits"
        >
          <div className="sticky top-0 z-30 -mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/90 px-5 py-2 backdrop-blur sm:-mx-8 sm:px-8">
            <p className="text-xs text-muted-foreground">
              {quotesBusy
                ? "Fetching prices…"
                : stocks.length
                  ? `${Object.keys(quotes).filter((id) => stocks.some((s) => s.id === id)).length} of ${stocks.length} priced`
                  : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshPrices}
                disabled={quotesBusy || !stocks.length}
                title="Refresh market prices"
                aria-label="Refresh market prices"
              >
                <RefreshCw className={quotesBusy ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Prices</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={!stocks.length}
                title="Download CSV"
                aria-label="Download CSV"
              >
                <Download />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setInsights(true)}
                disabled={!stocks.length}
                aria-label="AI insights"
              >
                <BrainCircuit />
                <span className="hidden sm:inline">AI insights</span>
              </Button>
              <Button size="sm" onClick={() => setEditor("new")} aria-label="Add holding">
                <Plus />
                <span className="hidden sm:inline">Add holding</span>
              </Button>
            </div>
          </div>
          {stocks.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="relative min-w-48 flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search holdings"
                  aria-label="Search holdings"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="relative">
                <select
                  aria-label="Sort holdings"
                  className="h-9 appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                >
                  <option value="recent">Most recent</option>
                  <option value="name">Name</option>
                  <option value="value">Amount invested</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4" />
              </div>
            </div>
          )}
          {loading ? (
            <p className="py-20 text-center text-muted-foreground">Loading holdings…</p>
          ) : !stocks.length ? (
            <div className="mt-8 border border-dashed border-border px-6 py-20 text-center">
              <div className="mx-auto mb-5 flex size-14 items-center justify-center bg-secondary text-primary">
                <TrendingUp />
              </div>
              <h3 className="text-xl font-semibold">No holdings yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your first stock to start tracking your portfolio.
              </p>
              <Button className="mt-6" onClick={() => setEditor("new")}>
                <Plus />
                Add holding
              </Button>
            </div>
          ) : !filtered.length ? (
            <p className="py-20 text-center text-muted-foreground">
              No holdings match your search.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((stock, i) => (
                <Holding
                  key={stock.id}
                  stock={stock}
                  quote={quotes[stock.id]}
                  index={i}
                  onEdit={() => setEditor(stock)}
                  onChange={load}
                />
              ))}
            </div>
          )}
        </Section>
      </main>
      <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        PrediFolio · Market prices may be delayed. For educational use only.
      </footer>
      <HoldingEditor
        key={editor === "new" ? "new" : (editor?.id ?? "closed")}
        stock={editor === "new" ? null : editor}
        open={editor !== null}
        onClose={() => setEditor(null)}
        onSaved={load}
        userId={user.id}
      />
      <Insights open={insights} onClose={() => setInsights(false)} />
    </div>
  );
}
function Metric({
  label,
  amount,
  suffix = "",
  sub,
  positive,
  negative,
  accent,
  icon,
  info,
}: {
  label: string;
  /** Raw numeric value to animate (null shows "—"); money amounts are formatted, percentages use `suffix="%"`. */
  amount: number | null;
  suffix?: string;
  sub: string;
  positive?: boolean;
  negative?: boolean;
  accent?: string;
  icon?: ReactNode;
  info?: { label: string; text: string };
}) {
  const animated = useCountUp(amount ?? 0);
  const display = amount === null ? "—" : suffix === "%" ? `${number(animated)}%` : money(animated);
  return (
    <div
      className="metric-tile min-w-0 bg-card p-6"
      style={accent ? ({ "--accent-bar": accent } as CSSProperties) : undefined}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
        {icon}
        {label}
        {info && <InfoTip label={info.label} text={info.text} />}
      </p>
      <p
        className={`mt-3 break-words text-2xl font-semibold tabular-nums sm:text-3xl ${
          amount === null
            ? "text-muted-foreground"
            : positive
              ? "text-profit"
              : negative
                ? "text-destructive"
                : ""
        }`}
      >
        {display}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
function Holding({
  stock,
  quote,
  index,
  onEdit,
  onChange,
}: {
  stock: Stock;
  quote: Quote | undefined;
  index: number;
  onEdit: () => void;
  onChange: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const plans = targets(stock);
  const scenario = projected(stock);
  const difference = scenario === null ? null : scenario - Number(stock.invested_amount);
  const marketValue = quote ? quote.price * Number(stock.buy_stocks) : null;
  const pnl = marketValue === null ? null : marketValue - Number(stock.invested_amount);
  const pnlPct = pnl === null ? null : (pnl / Number(stock.invested_amount)) * 100;
  const cagr = quote ? holdingCagr(stock, quote.price) : null;
  // Accent follows real P&L when a live price is known, otherwise the target scenario.
  const accentValue = pnl ?? difference;
  const targetedShares = plans.reduce((sum, p) => sum + Math.max(0, p.stocks), 0);
  const targetProgress =
    Number(stock.buy_stocks) > 0
      ? Math.min(100, (targetedShares / Number(stock.buy_stocks)) * 100)
      : 0;
  async function remove() {
    if (!window.confirm(`Delete ${stock.stock_name}?`)) return;
    setDeleting(true);
    const { error } = await supabase.from("stocks").delete().eq("id", stock.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Holding removed");
      onChange();
    }
    setDeleting(false);
  }
  return (
    <article
      className={`holding-card fade-in-up flex min-w-0 flex-col border border-border bg-card p-5 pl-6 ${
        accentValue === null ? "" : accentValue >= 0 ? "holding-card--profit" : "holding-card--loss"
      }`}
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold" title={stock.stock_name}>
            {stock.stock_name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Bought{" "}
            {new Date(`${stock.buy_date}T12:00:00`).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label={`Edit ${stock.stock_name}`}
            title="Edit holding"
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={deleting}
            aria-label={`Delete ${stock.stock_name}`}
            title="Delete holding"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5">
        <div>
          <p className="text-xs text-muted-foreground">Invested</p>
          <p className="mt-1 font-semibold">{money(Number(stock.invested_amount))}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Shares · buy price</p>
          <p className="mt-1 font-semibold">
            {number(Number(stock.buy_stocks))} · {money(Number(stock.buy_price))}
          </p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Target scenario</p>
          <p className="mt-1 font-semibold">
            {scenario === null ? "No target set" : money(scenario)}
          </p>
        </div>
        {difference !== null && (
          <span
            className={`flex items-center text-sm font-semibold ${difference >= 0 ? "text-profit" : "text-destructive"}`}
          >
            {difference >= 0 ? (
              <ArrowUpRight className="size-4" />
            ) : (
              <ArrowDownRight className="size-4" />
            )}
            {money(Math.abs(difference))}
          </span>
        )}
      </div>
      {quote && marketValue !== null && pnl !== null && pnlPct !== null && (
        <div className="mt-4 space-y-1.5 bg-secondary px-3 py-2 text-xs">
          <div className="flex justify-between gap-2">
            <span>Market price · {quote.date}</span>
            <strong>{money(quote.price)}</strong>
          </div>
          <div className="flex justify-between gap-2">
            <span>Value · P&amp;L</span>
            <strong className={pnl >= 0 ? "text-profit" : "text-destructive"}>
              {money(marketValue)} · {pnl >= 0 ? "+" : "−"}
              {money(Math.abs(pnl))} ({pnlPct > 0 ? "+" : ""}
              {number(pnlPct)}%)
            </strong>
          </div>
          {cagr !== null && (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1">
                CAGR <InfoTip label="CAGR" text={TERMS.cagr} />
              </span>
              <strong className={cagr >= 0 ? "text-profit" : "text-destructive"}>
                {cagr > 0 ? "+" : ""}
                {number(cagr)}%
              </strong>
            </div>
          )}
        </div>
      )}
      <InlineTargets stock={stock} quote={quote} onChange={onChange} />
      {plans.length > 0 && (
        <div
          className="target-progress-track mt-3"
          role="progressbar"
          aria-label="Shares allocated to sell targets"
          aria-valuenow={Math.round(targetProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          title={`${Math.round(targetProgress)}% of shares allocated to sell targets`}
        >
          <div className="target-progress-fill" style={{ width: `${targetProgress}%` }} />
        </div>
      )}
      {stock.notes && (
        <p className="mt-4 line-clamp-2 border-t border-border pt-3 text-xs text-muted-foreground">
          {stock.notes}
        </p>
      )}
    </article>
  );
}

function HoldingEditor({
  stock,
  open,
  onClose,
  onSaved,
  userId,
}: {
  stock: Stock | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
}) {
  const [form, setForm] = useState(() =>
    stock
      ? {
          stock_name: stock.stock_name,
          buy_date: stock.buy_date,
          buy_price: String(stock.buy_price),
          buy_stocks: String(stock.buy_stocks),
          notes: stock.notes ?? "",
        }
      : emptyForm(),
  );
  const [plans, setPlans] = useState<Target[]>(() => (stock ? targets(stock) : []));
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const invested = Number(form.buy_price) * Number(form.buy_stocks);
  async function findStocks(value: string) {
    setForm((f) => ({ ...f, stock_name: value }));
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const response = await fetch(`/api/screener?q=${encodeURIComponent(value)}`);
      const data = await response.json();
      setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []);
    } catch {
      setSuggestions([]);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(invested) || invested <= 0) {
      toast.error("Enter a buy price and number of shares above zero.");
      return;
    }
    const targetError = validateTargets(plans, Number(form.buy_stocks));
    if (targetError) {
      toast.error(targetError);
      return;
    }
    setBusy(true);
    const payload = {
      stock_name: form.stock_name.trim(),
      buy_date: form.buy_date,
      buy_price: Number(form.buy_price),
      buy_stocks: Number(form.buy_stocks),
      invested_amount: Number(invested.toFixed(2)),
      notes: form.notes.trim() || null,
      sell_predictions: plans,
      updated_at: new Date().toISOString(),
    };
    const result = stock
      ? await supabase.from("stocks").update(payload).eq("id", stock.id)
      : await supabase.from("stocks").insert({ ...payload, user_id: userId });
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(stock ? "Holding updated" : "Holding added");
      onSaved();
      onClose();
    }
    setBusy(false);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{stock ? "Edit holding" : "Add holding"}</DialogTitle>
          <DialogDescription>Record your purchase and optional sell targets.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4 pt-2">
          <label className="relative block text-sm font-medium">
            Stock name
            <Input
              className="mt-1.5"
              value={form.stock_name}
              onChange={(e) => void findStocks(e.target.value)}
              required
              maxLength={100}
              placeholder="e.g. Reliance Industries"
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full border border-border bg-popover shadow-md">
                {suggestions.map((s) => (
                  <Button
                    variant="ghost"
                    type="button"
                    key={s.id}
                    className="w-full justify-start rounded-none"
                    onClick={() => {
                      setForm((f) => ({ ...f, stock_name: s.name }));
                      setSuggestions([]);
                    }}
                  >
                    {s.name}
                  </Button>
                ))}
              </div>
            )}
          </label>
          <label className="block text-sm font-medium">
            Buy date
            <Input
              className="mt-1.5"
              type="date"
              value={form.buy_date}
              onChange={(e) => setForm((f) => ({ ...f, buy_date: e.target.value }))}
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-medium">
              Buy price (₹)
              <Input
                className="mt-1.5"
                type="number"
                min="0.01"
                step="any"
                required
                value={form.buy_price}
                onChange={(e) => setForm((f) => ({ ...f, buy_price: e.target.value }))}
              />
            </label>
            <label className="block text-sm font-medium">
              Shares
              <Input
                className="mt-1.5"
                type="number"
                min="0.0001"
                step="any"
                required
                value={form.buy_stocks}
                onChange={(e) => setForm((f) => ({ ...f, buy_stocks: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-between bg-secondary p-3 text-sm">
            <span>Amount invested</span>
            <strong>{money(Number.isFinite(invested) ? invested : 0)}</strong>
          </div>
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Sell targets</h3>
              <Button
                variant="ghost"
                type="button"
                size="sm"
                onClick={() =>
                  setPlans((p) => [...p, { id: crypto.randomUUID(), price: 0, stocks: 0 }])
                }
              >
                <Plus />
                Add target
              </Button>
            </div>
            {plans.map((plan, i) => (
              <div key={plan.id} className="mt-3 flex items-end gap-2">
                <label className="min-w-0 flex-1 text-xs">
                  Target price (₹)
                  <Input
                    className="mt-1"
                    type="number"
                    min="0.01"
                    step="any"
                    value={plan.price || ""}
                    onChange={(e) =>
                      setPlans((p) =>
                        p.map((v, j) => (i === j ? { ...v, price: Number(e.target.value) } : v)),
                      )
                    }
                    required
                  />
                </label>
                <label className="min-w-0 flex-1 text-xs">
                  Shares to sell
                  <Input
                    className="mt-1"
                    type="number"
                    min="0.0001"
                    step="any"
                    value={plan.stocks || ""}
                    onChange={(e) =>
                      setPlans((p) =>
                        p.map((v, j) => (i === j ? { ...v, stocks: Number(e.target.value) } : v)),
                      )
                    }
                    required
                  />
                </label>
                <Button
                  variant="ghost"
                  type="button"
                  size="icon"
                  aria-label="Remove target"
                  onClick={() => setPlans((p) => p.filter((_, j) => j !== i))}
                >
                  <X />
                </Button>
              </div>
            ))}
            {plans.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Unallocated shares remain at buy price in the target scenario.
              </p>
            )}
          </div>
          <label className="block text-sm font-medium">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea
              className="mt-1.5 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.notes}
              maxLength={500}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Your investment thesis"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : stock ? "Save changes" : "Add holding"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Insights({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [providers, setProviders] = useState<AiProviderStatus[] | null>(null);
  const [provider, setProvider] = useState<AiProviderId>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  // Learn which AI providers are configured (keys live on the server) the first time the dialog opens.
  useEffect(() => {
    if (!open || providers) return;
    let active = true;
    getAiProviders()
      .then((list) => {
        if (!active) return;
        setProviders(list);
        const saved = readStorage(AI_PROVIDER_KEY);
        setProvider(list.find((p) => p.id === saved)?.id ?? "gemini");
      })
      .catch(() => {
        if (active) setProviders([]);
      });
    return () => {
      active = false;
    };
  }, [open, providers]);
  const serverKeyAvailable = providers?.find((p) => p.id === provider)?.available ?? false;
  async function ask(value?: string) {
    setBusy(true);
    setError("");
    try {
      const response = await getPortfolioInsight({
        data: { question: value, provider, ...(apiKey.trim() && { apiKey: apiKey.trim() }) },
      });
      setAnswer(response);
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate an insight.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setApiKey("");
          setShowKey(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrainCircuit className="text-primary" />
            AI portfolio insights
          </DialogTitle>
          <DialogDescription>
            Commentary on your holdings and target scenarios, not investment advice.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-3">
          <div className="mb-4 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Model</span>
              <select
                aria-label="AI model"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={provider}
                disabled={busy}
                onChange={(e) => {
                  const next = e.target.value as AiProviderId;
                  setProvider(next);
                  setApiKey("");
                  setAnswer("");
                  setError("");
                  writeStorage(AI_PROVIDER_KEY, next);
                }}
              >
                <option value="gemini">Gemini 2.5 Flash Lite</option>
                <option value="groq">Groq</option>
              </select>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">{provider === "groq" ? "Groq" : "Gemini"} API key {serverKeyAvailable ? "(optional)" : ""}</span>
              <span className="flex gap-2">
                <Input
                  aria-label={`${provider === "groq" ? "Groq" : "Gemini"} API key`}
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={serverKeyAvailable ? "Use configured key or paste yours" : "Paste your API key"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={busy}
                />
                <Button type="button" variant="outline" size="icon" aria-label={showKey ? "Hide API key" : "Show API key"} title={showKey ? "Hide API key" : "Show API key"} onClick={() => setShowKey((v) => !v)}>
                  {showKey ? <EyeOff /> : <Eye />}
                </Button>
              </span>
            </label>
            <p className="text-xs text-muted-foreground">Your key is used for this request and cleared when you close this window. Your holdings are sent to the selected provider for analysis.</p>
          </div>
          {!answer && !busy && (
            <Button onClick={() => void ask()} disabled={!apiKey.trim() && !serverKeyAvailable}>
              Analyze my portfolio
            </Button>
          )}
          {busy && (
            <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Activity className="animate-pulse" />
              Analyzing your portfolio…
            </p>
          )}
          {error && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {error}
            </p>
          )}
          {answer && (
            <div className="whitespace-pre-wrap border-l-2 border-primary bg-secondary p-5 text-sm leading-7">
              {answer}
            </div>
          )}
          {answer && (
            <form
              className="mt-5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (question.trim()) void ask(question.trim());
              }}
            >
              <Input
                aria-label="Ask a follow-up"
                placeholder="Ask a follow-up question"
                maxLength={500}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <Button
                type="submit"
                size="icon"
                disabled={busy || !question.trim()}
                aria-label="Ask question"
              >
                <Send />
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
