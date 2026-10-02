import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { projected, summary, targets } from "./portfolio";

export const getPortfolioInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ question: z.string().max(500).optional() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: stocks, error } = await context.supabase
      .from("stocks")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Unable to load your holdings.");
    if (!stocks?.length) throw new Error("Add a holding before requesting an insight.");
    const totals = summary(stocks);
    const holdings = stocks.map((stock) => ({
      name: stock.stock_name,
      shares: Number(stock.buy_stocks),
      purchasePrice: Number(stock.buy_price),
      invested: Number(stock.invested_amount),
      buyDate: stock.buy_date,
      targets: targets(stock).map((t) => ({ shares: t.stocks, price: t.price })),
      projectedValue: projected(stock),
    }));
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const { createLovableAiGatewayRunIdFetch } = await import("./ai-run-id.server");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not available right now.");
    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      maxRetries: 0,
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
      system:
        "You are a careful portfolio commentary assistant for an Indian retail investor. All data is already calculated. Never invent live prices, guarantees or new figures. Explicitly distinguish target-based projections from actual returns and note when targets are missing. Highlight allocation and concentration risks when relevant. Respond in plain English, briefly (under 180 words), use ₹. End with: This is educational commentary, not investment advice.",
      prompt: JSON.stringify({
        holdings,
        totals,
        question:
          data.question ||
          "Summarize this portfolio, its target scenarios, and main concentration risks.",
      }),
    });
    const text = await result.text;
    if (!text.trim()) throw new Error("No insight was returned. Please try again.");
    return text.trim();
  });
