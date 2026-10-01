import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import type { User } from '@supabase/supabase-js';
import type { Stock, Target } from '@/lib/portfolio';
import { money, number, projected, summary, targets } from '@/lib/portfolio';
import { getPortfolioInsight } from '@/lib/insights.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Toaster, toast } from 'sonner';
import { Activity, ArrowDownRight, ArrowUpRight, BrainCircuit, ChevronDown, Download, Eye, EyeOff, LogOut, Moon, Plus, RefreshCw, Search, Send, Sun, Target as TargetIcon, Trash2, TrendingUp, X, Pencil } from 'lucide-react';

type Suggestion = { id: number; name: string };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const emptyForm = () => ({ stock_name: '', buy_date: today(), buy_price: '', buy_stocks: '', notes: '' });

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'PrediFolio — Portfolio & Sell Target Tracker' },
    { name: 'description', content: 'Track Indian stock holdings, model sell targets, and explore AI-powered portfolio insights.' },
    { property: 'og:title', content: 'PrediFolio — Portfolio & Sell Target Tracker' },
    { property: 'og:description', content: 'Track Indian stock holdings, model sell targets, and explore AI-powered portfolio insights.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Index,
});

function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem('predifolio-theme') === 'dark';
    setDark(saved);
    document.documentElement.classList.toggle('dark', saved);
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setReady(true); });
    return () => listener.subscription.unsubscribe();
  }, []);
  function toggleTheme() { setDark(prev => { document.documentElement.classList.toggle('dark', !prev); window.localStorage.setItem('predifolio-theme', !prev ? 'dark' : 'light'); return !prev; }); }
  return <><Toaster position="top-right" richColors />{!ready ? <div className="flex min-h-screen items-center justify-center"><Activity className="animate-pulse text-primary" /></div> : user ? <Portfolio key={user.id} user={user} dark={dark} toggleTheme={toggleTheme} /> : <Auth dark={dark} toggleTheme={toggleTheme} />}</>;
}

function Auth({ dark, toggleTheme }: { dark: boolean; toggleTheme: () => void }) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setNotice('');
    const result = signup ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } }) : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setNotice(result.error.message);
    else if (signup && !result.data.session) setNotice('Check your inbox to confirm your email, then sign in.');
    setBusy(false);
  }
  async function google() {
    setBusy(true); setNotice('');
    const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
    if (result.error) setNotice(result.error.message);
    if (!result.redirected) setBusy(false);
  }
  return <div className="min-h-screen bg-background text-foreground">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6"><Brand /><Button variant="ghost" size="icon" onClick={toggleTheme} title={dark ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">{dark ? <Sun /> : <Moon />}</Button></header>
    <main className="mx-auto grid min-h-[calc(100vh-90px)] max-w-7xl items-center gap-14 px-6 pb-16 lg:grid-cols-[1.15fr_.85fr]">
      <section className="relative overflow-hidden py-8"><div className="mb-7 inline-flex items-center gap-2 border-l-2 border-primary pl-3 text-xs font-bold uppercase text-primary">Your market, in perspective</div><h1 className="max-w-2xl text-5xl font-semibold leading-[1.08] sm:text-7xl">Know your holdings.<br/><span className="text-primary">Plan your next move.</span></h1><p className="mt-7 max-w-lg text-base leading-relaxed text-muted-foreground">A clearer view of what you own, where you want to sell, and how each decision shapes your portfolio.</p><div className="mt-12 grid max-w-md grid-cols-3 gap-5 border-t border-border pt-6 text-sm"><div><TargetIcon className="mb-3 text-primary"/><span className="font-medium">Sell targets</span></div><div><Activity className="mb-3 text-primary"/><span className="font-medium">Market prices</span></div><div><BrainCircuit className="mb-3 text-primary"/><span className="font-medium">AI insights</span></div></div><div className="market-art" aria-hidden="true"><div className="market-bars">{[25,40,35,57,48,66,58,80,72,88,78,100].map((height,i) => <span key={i} style={{ height: `${height}%` }} />)}</div><svg viewBox="0 0 600 200" preserveAspectRatio="none"><polyline points="0,180 60,165 110,175 165,138 210,145 270,100 315,115 375,75 420,95 475,42 530,63 600,12" /></svg></div></section>
      <section className="w-full max-w-md justify-self-center border border-border bg-card p-7 shadow-sm sm:p-9"><div className="mb-8 flex border-b border-border"><Button variant="ghost" className={`flex-1 rounded-none border-b-2 ${!signup ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => { setSignup(false); setNotice(''); }}>Sign in</Button><Button variant="ghost" className={`flex-1 rounded-none border-b-2 ${signup ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => { setSignup(true); setNotice(''); }}>Create account</Button></div><h2 className="text-2xl font-semibold">{signup ? 'Start your portfolio' : 'Welcome back'}</h2><p className="mt-2 text-sm text-muted-foreground">{signup ? 'Create an account to save your holdings.' : 'Sign in to see your portfolio.'}</p><form onSubmit={submit} className="mt-8 space-y-5">{signup && <label className="block text-sm font-medium">Full name<Input className="mt-2" value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" /></label>}<label className="block text-sm font-medium">Email address<Input className="mt-2" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" /></label><label className="block text-sm font-medium">Password<div className="relative mt-2"><Input type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={6} value={password} onChange={e => setPassword(e.target.value)} required placeholder="At least 6 characters" className="pr-10"/><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff/> : <Eye/>}</Button></div></label>{notice && <p role="status" className="text-sm text-destructive">{notice}</p>}<Button type="submit" disabled={busy} className="h-11 w-full">{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</Button></form><div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>OR<span className="h-px flex-1 bg-border"/></div><Button variant="outline" className="h-11 w-full" disabled={busy} onClick={google}>Continue with Google</Button><p className="mt-8 text-center text-xs text-muted-foreground">Your holdings stay private to your account.</p></section>
    </main>
  </div>;
}
function Brand() { return <div className="flex items-center gap-2.5 text-xl font-bold"><span className="flex size-9 items-center justify-center bg-primary text-primary-foreground"><TrendingUp size={20}/></span>Predi<span className="-ml-2.5 text-primary">Folio</span></div>; }

function Portfolio({ user, dark, toggleTheme }: { user: User; dark: boolean; toggleTheme: () => void }) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Stock | 'new' | null>(null);
  const [insights, setInsights] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'recent' | 'name' | 'value'>('recent');
  const [quotes, setQuotes] = useState<Record<string, { price: number; date: string }>>({});
  const [quotesBusy, setQuotesBusy] = useState(false);
  async function load() { const { data, error } = await supabase.from('stocks').select('*').order('created_at', { ascending: false }); if (error) toast.error(error.message); else setStocks(data ?? []); setLoading(false); }
  useEffect(() => { void load(); }, []);
  async function refreshPrices() {
    setQuotesBusy(true);
    const pairs = await Promise.all(stocks.map(async stock => {
      try {
        const searchResponse = await fetch(`/api/screener?q=${encodeURIComponent(stock.stock_name)}`);
        const matches: Suggestion[] = await searchResponse.json();
        if (!Array.isArray(matches) || !matches.length) return null;
        const chartResponse = await fetch(`/api/screener?id=${matches[0].id}`);
        const chart = await chartResponse.json();
        const prices = chart?.datasets?.find((d: { metric: string }) => d.metric === 'Price')?.values;
        const latest = prices?.[prices.length - 1];
        return latest ? [stock.id, { price: Number(latest[1]), date: latest[0] }] as const : null;
      } catch { return null; }
    }));
    setQuotes(Object.fromEntries(pairs.filter((p): p is NonNullable<typeof p> => p !== null)));
    if (pairs.every(p => p === null) && stocks.length) toast.error('Market prices are temporarily unavailable.');
    setQuotesBusy(false);
  }
  const totals = summary(stocks);
  const filtered = stocks.filter(s => s.stock_name.toLowerCase().includes(search.toLowerCase())).sort((a,b) => sort === 'name' ? a.stock_name.localeCompare(b.stock_name) : sort === 'value' ? Number(b.invested_amount) - Number(a.invested_amount) : b.created_at.localeCompare(a.created_at));
  function exportCsv() {
    const rows = [['Stock','Buy date','Buy price','Shares','Invested','Sell targets','Projected value','Notes'], ...stocks.map(s => [s.stock_name,s.buy_date,s.buy_price,s.buy_stocks,s.invested_amount,targets(s).map(t => `${t.stocks} @ ${t.price}`).join('; '),projected(s) ?? '',s.notes ?? ''])];
    const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"','""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'predifolio-holdings.csv'; a.click(); URL.revokeObjectURL(a.href);
  }
  return <div className="min-h-screen bg-background text-foreground"><header className="border-b border-border bg-card"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8"><Brand /><div className="flex items-center gap-2"><span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">{user.user_metadata?.full_name || user.email}</span><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" title={dark ? 'Light mode' : 'Dark mode'}>{dark ? <Sun/> : <Moon/>}</Button><Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} aria-label="Sign out" title="Sign out"><LogOut/></Button></div></div></header>
    <main className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8"><div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-2 text-xs font-bold uppercase text-primary">Portfolio overview</p><h1 className="text-3xl font-semibold sm:text-4xl">Your holdings</h1><p className="mt-2 text-sm text-muted-foreground">Track purchases and plan target-based outcomes.</p></div><Button className="h-10" onClick={() => setEditor('new')}><Plus/>Add holding</Button></div>
      <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4"><Metric label="Amount invested" value={money(totals.invested)} sub={`${stocks.length} holding${stocks.length === 1 ? '' : 's'}`} /><Metric label="Target scenario" value={money(totals.projectedValue)} sub={`${totals.withTargets} with sell targets`} /><Metric label="Potential difference" value={money(totals.potential)} sub="Against amount invested" positive={totals.potential > 0} /><Metric label="Potential return" value={`${number(totals.percentage)}%`} sub="Based on sell targets" positive={totals.percentage > 0} /></div>
      <p className="mt-3 text-xs text-muted-foreground">Target scenarios are estimates, not live portfolio valuations or guaranteed returns.</p>
      <div className="mt-10 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">Holdings <span className="text-muted-foreground">({stocks.length})</span></h2><p className="mt-1 text-sm text-muted-foreground">Your positions and planned exits</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={refreshPrices} disabled={quotesBusy || !stocks.length} title="Refresh market prices"><RefreshCw className={quotesBusy ? 'animate-spin' : ''}/>Prices</Button><Button variant="outline" size="sm" onClick={exportCsv} disabled={!stocks.length} title="Download CSV"><Download/>Export</Button><Button variant="secondary" size="sm" onClick={() => setInsights(true)} disabled={!stocks.length}><BrainCircuit/>AI insights</Button></div></div>
      {stocks.length > 0 && <div className="mt-6 flex flex-wrap gap-3"><div className="relative min-w-48 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input className="pl-9" placeholder="Search holdings" aria-label="Search holdings" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="relative"><select aria-label="Sort holdings" className="h-9 appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm" value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="recent">Most recent</option><option value="name">Name</option><option value="value">Amount invested</option></select><ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4"/></div></div>}
      {loading ? <p className="py-20 text-center text-muted-foreground">Loading holdings…</p> : !stocks.length ? <div className="mt-8 border border-dashed border-border px-6 py-20 text-center"><div className="mx-auto mb-5 flex size-14 items-center justify-center bg-secondary text-primary"><TrendingUp/></div><h3 className="text-xl font-semibold">No holdings yet</h3><p className="mt-2 text-sm text-muted-foreground">Add your first stock to start tracking your portfolio.</p><Button className="mt-6" onClick={() => setEditor('new')}><Plus/>Add holding</Button></div> : !filtered.length ? <p className="py-20 text-center text-muted-foreground">No holdings match your search.</p> : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(stock => <Holding key={stock.id} stock={stock} quote={quotes[stock.id]} onEdit={() => setEditor(stock)} onChange={load} />)}</div>}
    </main><footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">PrediFolio · Market prices may be delayed. For educational use only.</footer>
    <HoldingEditor key={editor === 'new' ? 'new' : editor?.id ?? 'closed'} stock={editor === 'new' ? null : editor} open={editor !== null} onClose={() => setEditor(null)} onSaved={load} userId={user.id}/><Insights open={insights} onClose={() => setInsights(false)}/>
  </div>;
}
function Metric({ label,value,sub,positive }: { label:string;value:string;sub:string;positive?:boolean }) { return <div className="min-w-0 bg-card p-6"><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className={`mt-3 break-words text-2xl font-semibold sm:text-3xl ${positive ? 'text-profit' : ''}`}>{value}</p><p className="mt-2 text-xs text-muted-foreground">{sub}</p></div>; }
function Holding({ stock, quote, onEdit, onChange }: { stock: Stock; quote?: {price:number;date:string}; onEdit:()=>void; onChange:()=>void }) {
  const [deleting, setDeleting] = useState(false);
  const plans = targets(stock); const scenario = projected(stock); const difference = scenario === null ? null : scenario - Number(stock.invested_amount);
  async function remove() { if (!window.confirm(`Delete ${stock.stock_name}?`)) return; setDeleting(true); const { error } = await supabase.from('stocks').delete().eq('id', stock.id); if (error) toast.error(error.message); else { toast.success('Holding removed'); onChange(); } setDeleting(false); }
  return <article className="flex min-w-0 flex-col border border-border bg-card p-5 transition-colors hover:border-primary/40"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-lg font-semibold" title={stock.stock_name}>{stock.stock_name}</h3><p className="mt-1 text-xs text-muted-foreground">Bought {new Date(`${stock.buy_date}T12:00:00`).toLocaleDateString('en-IN', { day:'numeric',month:'short',year:'numeric' })}</p></div><div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${stock.stock_name}`} title="Edit holding"><Pencil/></Button><Button variant="ghost" size="icon" onClick={remove} disabled={deleting} aria-label={`Delete ${stock.stock_name}`} title="Delete holding"><Trash2/></Button></div></div><div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5"><div><p className="text-xs text-muted-foreground">Invested</p><p className="mt-1 font-semibold">{money(Number(stock.invested_amount))}</p></div><div><p className="text-xs text-muted-foreground">Shares · buy price</p><p className="mt-1 font-semibold">{number(Number(stock.buy_stocks))} · {money(Number(stock.buy_price))}</p></div></div><div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4"><div><p className="text-xs text-muted-foreground">Target scenario</p><p className="mt-1 font-semibold">{scenario === null ? 'No target set' : money(scenario)}</p></div>{difference !== null && <span className={`flex items-center text-sm font-semibold ${difference >= 0 ? 'text-profit' : 'text-destructive'}`}>{difference >= 0 ? <ArrowUpRight className="size-4"/> : <ArrowDownRight className="size-4"/>}{money(Math.abs(difference))}</span>}</div>{plans.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{plans.length} sell target{plans.length === 1 ? '' : 's'} · {plans.map(p => `${number(p.stocks)} at ${money(p.price)}`).join(' · ')}</p>}{quote && <div className="mt-4 flex justify-between gap-2 bg-secondary px-3 py-2 text-xs"><span>Market price · {quote.date}</span><strong>{money(quote.price)}</strong></div>}{stock.notes && <p className="mt-4 line-clamp-2 border-t border-border pt-3 text-xs text-muted-foreground">{stock.notes}</p>}</article>;
}

function HoldingEditor({ stock, open, onClose, onSaved, userId }: { stock:Stock|null;open:boolean;onClose:()=>void;onSaved:()=>void;userId:string }) {
  const [form,setForm] = useState(() => stock ? { stock_name:stock.stock_name,buy_date:stock.buy_date,buy_price:String(stock.buy_price),buy_stocks:String(stock.buy_stocks),notes:stock.notes ?? '' } : emptyForm());
  const [plans,setPlans] = useState<Target[]>(() => stock ? targets(stock) : []);
  const [busy,setBusy] = useState(false); const [suggestions,setSuggestions] = useState<Suggestion[]>([]);
  const invested = Number(form.buy_price) * Number(form.buy_stocks);
  async function findStocks(value: string) { setForm(f => ({...f,stock_name:value})); if (value.trim().length < 2) {setSuggestions([]);return;} try { const response = await fetch(`/api/screener?q=${encodeURIComponent(value)}`); const data = await response.json(); setSuggestions(Array.isArray(data) ? data.slice(0,5) : []); } catch {setSuggestions([]);} }
  async function save(e:FormEvent) { e.preventDefault(); if (!Number.isFinite(invested) || invested <= 0 || plans.some(p => p.price <= 0 || p.stocks <= 0) || plans.reduce((n,p) => n + p.stocks,0) > Number(form.buy_stocks)) { toast.error('Check your shares, buy price, and sell targets.'); return; } setBusy(true); const payload = { stock_name:form.stock_name.trim(), buy_date:form.buy_date, buy_price:Number(form.buy_price), buy_stocks:Number(form.buy_stocks), invested_amount:Number(invested.toFixed(2)), notes:form.notes.trim() || null, sell_predictions:plans, updated_at:new Date().toISOString() }; const result = stock ? await supabase.from('stocks').update(payload).eq('id',stock.id) : await supabase.from('stocks').insert({...payload,user_id:userId}); if (result.error) toast.error(result.error.message); else { toast.success(stock ? 'Holding updated' : 'Holding added'); onSaved(); onClose(); } setBusy(false); }
  return <Dialog open={open} onOpenChange={v => { if(!v) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{stock ? 'Edit holding' : 'Add holding'}</DialogTitle><DialogDescription>Record your purchase and optional sell targets.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4 pt-2"><label className="relative block text-sm font-medium">Stock name<Input className="mt-1.5" value={form.stock_name} onChange={e => void findStocks(e.target.value)} required maxLength={100} placeholder="e.g. Reliance Industries" autoComplete="off" />{suggestions.length > 0 && <div className="absolute z-20 mt-1 w-full border border-border bg-popover shadow-md">{suggestions.map(s => <Button variant="ghost" type="button" key={s.id} className="w-full justify-start rounded-none" onClick={() => {setForm(f => ({...f,stock_name:s.name}));setSuggestions([]);}}>{s.name}</Button>)}</div>}</label><label className="block text-sm font-medium">Buy date<Input className="mt-1.5" type="date" value={form.buy_date} onChange={e => setForm(f => ({...f,buy_date:e.target.value}))} required /></label><div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">Buy price (₹)<Input className="mt-1.5" type="number" min="0.01" step="any" required value={form.buy_price} onChange={e => setForm(f => ({...f,buy_price:e.target.value}))}/></label><label className="block text-sm font-medium">Shares<Input className="mt-1.5" type="number" min="0.0001" step="any" required value={form.buy_stocks} onChange={e => setForm(f => ({...f,buy_stocks:e.target.value}))}/></label></div><div className="flex justify-between bg-secondary p-3 text-sm"><span>Amount invested</span><strong>{money(Number.isFinite(invested) ? invested : 0)}</strong></div><div className="border-t border-border pt-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Sell targets</h3><Button variant="ghost" type="button" size="sm" onClick={() => setPlans(p => [...p,{id:crypto.randomUUID(),price:0,stocks:0}])}><Plus/>Add target</Button></div>{plans.map((plan,i) => <div key={plan.id} className="mt-3 flex items-end gap-2"><label className="min-w-0 flex-1 text-xs">Target price (₹)<Input className="mt-1" type="number" min="0.01" step="any" value={plan.price || ''} onChange={e => setPlans(p => p.map((v,j) => i===j ? {...v,price:Number(e.target.value)} : v))} required /></label><label className="min-w-0 flex-1 text-xs">Shares to sell<Input className="mt-1" type="number" min="0.0001" step="any" value={plan.stocks || ''} onChange={e => setPlans(p => p.map((v,j) => i===j ? {...v,stocks:Number(e.target.value)} : v))} required /></label><Button variant="ghost" type="button" size="icon" aria-label="Remove target" onClick={() => setPlans(p => p.filter((_,j) => j!==i))}><X/></Button></div>)}{plans.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Unallocated shares remain at buy price in the target scenario.</p>}</div><label className="block text-sm font-medium">Notes <span className="font-normal text-muted-foreground">(optional)</span><textarea className="mt-1.5 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.notes} maxLength={500} onChange={e => setForm(f => ({...f,notes:e.target.value}))} placeholder="Your investment thesis"/></label><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : stock ? 'Save changes' : 'Add holding'}</Button></div></form></DialogContent></Dialog>;
}
function Insights({ open,onClose }: {open:boolean;onClose:()=>void}) {
  const [answer,setAnswer] = useState(''); const [question,setQuestion] = useState(''); const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  async function ask(value?:string) { setBusy(true);setError(''); try { const response = await getPortfolioInsight({data:{question:value}});setAnswer(response);setQuestion(''); } catch(e) { setError(e instanceof Error ? e.message : 'Unable to generate an insight.'); } finally {setBusy(false);} }
  return <Dialog open={open} onOpenChange={v => {if(!v) onClose();}}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><BrainCircuit className="text-primary"/>AI portfolio insights</DialogTitle><DialogDescription>Commentary on your holdings and target scenarios, not investment advice.</DialogDescription></DialogHeader><div className="pt-3">{!answer && !busy && <Button onClick={() => void ask()}>Analyze my portfolio</Button>}{busy && <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Activity className="animate-pulse"/>Analyzing your portfolio…</p>}{error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}{answer && <div className="whitespace-pre-wrap border-l-2 border-primary bg-secondary p-5 text-sm leading-7">{answer}</div>}{answer && <form className="mt-5 flex gap-2" onSubmit={e => {e.preventDefault();if(question.trim()) void ask(question.trim());}}><Input aria-label="Ask a follow-up" placeholder="Ask a follow-up question" maxLength={500} value={question} onChange={e => setQuestion(e.target.value)}/><Button type="submit" size="icon" disabled={busy || !question.trim()} aria-label="Ask question"><Send/></Button></form>}</div></DialogContent></Dialog>;
}
