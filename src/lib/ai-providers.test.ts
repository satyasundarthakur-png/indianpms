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

  it("needs both key and model for Groq (no guessed default)", () => {
    vi.stubEnv("GROQ_API_KEY", "q-key");
    vi.stubEnv("GROQ_MODEL", "");
    expect(getProviderConfig("groq")).toBeNull();
    vi.stubEnv("GROQ_MODEL", "some-model");
    expect(getProviderConfig("groq")).toEqual({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: "q-key",
      model: "some-model",
    });
  });
});
