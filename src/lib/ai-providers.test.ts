import { afterEach, describe, expect, it, vi } from "vitest";
import { getProviderConfig } from "./ai-providers.server";

afterEach(() => vi.unstubAllEnvs());

describe("getProviderConfig", () => {
  it("is unavailable without keys", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");
    expect(getProviderConfig("gemini")).toBeNull();
    expect(getProviderConfig("groq")).toBeNull();
  });

  it("configures Gemini with the Flash Lite default model", () => {
    vi.stubEnv("GEMINI_API_KEY", "g-key");
    vi.stubEnv("GEMINI_MODEL", "");
    expect(getProviderConfig("gemini")).toEqual({
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: "g-key",
      model: "gemini-2.5-flash-lite",
    });
  });

  it("lets GEMINI_MODEL override the default", () => {
    vi.stubEnv("GEMINI_API_KEY", "g-key");
    vi.stubEnv("GEMINI_MODEL", " gemini-custom ");
    expect(getProviderConfig("gemini")?.model).toBe("gemini-custom");
  });

  it("uses the Groq default model with a supplied key", () => {
    vi.stubEnv("GROQ_API_KEY", "q-key");
    vi.stubEnv("GROQ_MODEL", "");
    expect(getProviderConfig("groq")).toEqual({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: "q-key",
      model: "openai/gpt-oss-120b",
    });
    expect(getProviderConfig("groq", " pasted-key ")?.apiKey).toBe("pasted-key");
    vi.stubEnv("GROQ_MODEL", "some-model");
    expect(getProviderConfig("groq")?.model).toBe("some-model");
  });

  it("accepts a pasted Gemini key without a server key", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(getProviderConfig("gemini", " pasted-key ")?.apiKey).toBe("pasted-key");
  });
});
