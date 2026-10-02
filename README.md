# PrediFolio

A personal portfolio and sell-target tracker for Indian investors. Record your
holdings, plan sell targets (profit targets and stop-losses), and see live
market value, unrealised P&L, XIRR and per-holding CAGR. Optional AI commentary
summarises your portfolio.

Built with TanStack Start (React 19), Supabase (auth + Postgres with row-level
security), Tailwind and shadcn/ui, and edited through Lovable.

## Develop

```bash
bun install      # or: npm install --legacy-peer-deps
bun run dev
bun run test     # vitest
bunx tsc --noEmit
```

## AI insights (optional)

The "AI insights" button lets the user choose Gemini or Groq. The key can come
from a **server-side secret** (set once for everyone; never commit it) or be
pasted by the user in the dialog, in which case it is used for that request only
and is never stored.

| Provider              | Secrets                                                               |
| --------------------- | --------------------------------------------------------------------- |
| Gemini 2.5 Flash Lite | `GEMINI_API_KEY` (optional `GEMINI_MODEL` to override the model id)   |
| Groq                  | `GROQ_API_KEY` (optional `GROQ_MODEL`; default `openai/gpt-oss-120b`) |

Both are called through their OpenAI-compatible endpoints. Only your holdings
and totals are sent to the provider you choose. Groq retires models often, so if
requests start failing with a "model decommissioned" error, check
<https://console.groq.com/docs/deprecations> and set `GROQ_MODEL`.

## Notes

- Live prices come from a server-side proxy to Screener.in (`/api/screener`) and
  may be delayed or unavailable.
- Target-scenario figures are plans, not forecasts. Nothing here is investment advice.
