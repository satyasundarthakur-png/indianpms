import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/api/screener')({
  server: { handlers: { GET: async ({ request }) => {
    const params = new URL(request.url).searchParams;
    const parsed = z.object({ q: z.string().trim().min(2).max(80).optional(), id: z.coerce.number().int().positive().optional() }).safeParse({ q: params.get('q') || undefined, id: params.get('id') || undefined });
    if (!parsed.success || (!parsed.data.q && !parsed.data.id)) return Response.json({ error: 'Invalid request' }, { status: 400 });
    const url = parsed.data.id
      ? `https://www.screener.in/api/company/${parsed.data.id}/chart/?q=Price&days=1`
      : `https://www.screener.in/api/company/search/?q=${encodeURIComponent(parsed.data.q ?? '')}`;
    try {
      const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 PrediFolio/1.0' } });
      if (!response.ok) return Response.json({ error: 'Market data is temporarily unavailable' }, { status: 502 });
      return new Response(response.body, { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' } });
    } catch { return Response.json({ error: 'Market data is temporarily unavailable' }, { status: 502 }); }
  } } },
});
