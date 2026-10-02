import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AI_PROVIDER_IDS,
  AI_PROVIDER_LABELS,
  type AiProviderId,
  type AiProviderStatus,
} from "./ai-providers";
import { projected, summary, targets } from "./portfolio";

/** Which AI providers are configured on the server (never exposes keys or model names). */
export const getAiProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<AiProviderStatus[]> => {
    const { getProviderConfig } = await import("./ai-providers.server");
    return AI_PROVIDER_IDS.map((id) => ({
      id,
      label: AI_PROVIDER_LABELS[id],
      available: getProviderConfig(id) !== null,
    }));
  });

export const getPortfolioInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        question: z.string().max(500).optional(),
        provider: z.enum(AI_PROVIDER_IDS).optional(),
        apiKey: z.string().trim().min(1).max(512).optional(),
      })
      .parse(input),
  )
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
    const { getProviderConfig } = await import("./ai-providers.server");
    const requested: AiProviderId | undefined = data.provider;
    const chosen = requested ?? AI_PROVIDER_IDS.find((id) => getProviderConfig(id) !== null);
    const config = chosen ? getProviderConfig(chosen, data.apiKey) : null;
    if (!config) throw new Error("Paste your provider key to analyze this portfolio.");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    // Gemini and Groq both expose OpenAI-compatible chat-completions endpoints.
    const provider = createOpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
    let text: string;
    try {
      const result = streamText({
        model: provider.chat(config.model),
        maxRetries: 0,
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
      text = await result.text;
    } catch (error) {
      // SDK errors can include request headers; never log an error containing a pasted key.
      const status = error && typeof error === "object" && "statusCode" in error ? error.statusCode : undefined;
      if (status === 401 || status === 403) throw new Error("The provider rejected this key. Check your key and account access.");
      if (status === 429) throw new Error("The provider is rate-limiting requests. Please try again later.");
      throw new Error("The AI provider couldn't complete this request. Check your key and try again.");
    }
    if (!text.trim()) throw new Error("No insight was returned. Please try again.");
    return text.trim();
  });
