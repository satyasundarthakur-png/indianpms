import type { AiProviderId } from "./ai-providers";

export type AiProviderConfig = { baseURL: string; apiKey: string; model: string };

const read = (name: string) => process.env[name]?.trim() || undefined;

/**
 * Resolves a provider id to its OpenAI-compatible endpoint, key and model from
 * server-side environment secrets or a key supplied for this request.
 *
 *   gemini: GEMINI_API_KEY            (GEMINI_MODEL optional, default gemini-2.5-flash-lite)
 *   groq:   GROQ_API_KEY (GROQ_MODEL optional, default openai/gpt-oss-120b)
 *
 * Groq retires models often (llama-3.3-70b-versatile was shut down for free and
 * developer accounts on 2026-08-16). The default is a production-tier model;
 * check https://console.groq.com/docs/deprecations and override with GROQ_MODEL
 * if it is ever retired.
 */
export function getProviderConfig(id: AiProviderId, suppliedKey?: string): AiProviderConfig | null {
  switch (id) {
    case "gemini": {
      const apiKey = suppliedKey?.trim() || read("GEMINI_API_KEY");
      if (!apiKey) return null;
      return {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        apiKey,
        model: read("GEMINI_MODEL") ?? "gemini-2.5-flash-lite",
      };
    }
    case "groq": {
      const apiKey = suppliedKey?.trim() || read("GROQ_API_KEY");
      const model = read("GROQ_MODEL") ?? "openai/gpt-oss-120b";
      if (!apiKey) return null;
      return { baseURL: "https://api.groq.com/openai/v1", apiKey, model };
    }
  }
}
