/**
 * AI providers a user can pick for portfolio insights. Safe to import in the
 * browser: it holds only ids and labels — never keys or model names. The server
 * resolves an id to a real endpoint/model (see ai-providers.server.ts).
 */
export const AI_PROVIDER_IDS = ["gemini", "groq"] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  gemini: "Gemini 2.5 Flash Lite",
  groq: "Groq",
};

export type AiProviderStatus = { id: AiProviderId; label: string; available: boolean };
