import { describe, expect, it, vi, beforeEach } from "vitest";
import { callLLM, testConnection } from "./llm";

describe("llm service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ollama response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: "Antwort" }),
      }),
    );

    const result = await callLLM({
      endpoint: "http://localhost:11434",
      isOllama: true,
      model: "qwen2.5:7b",
      apiKey: "",
      prompt: "Test",
    });

    expect(result).toBe("Antwort");
  });

  it("returns openai compatible response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "Hello" } }] }),
      }),
    );

    const result = await callLLM({
      endpoint: "http://localhost:1234",
      isOllama: false,
      model: "local-model",
      apiKey: "x",
      prompt: "Test",
    });

    expect(result).toBe("Hello");
  });

  it("throws on non-200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "broken",
      }),
    );

    await expect(
      callLLM({
        endpoint: "http://localhost:11434",
        isOllama: true,
        model: "qwen2.5:7b",
        apiKey: "",
        prompt: "Test",
      }),
    ).rejects.toThrow("HTTP 500");
  });

  it("tests ollama connection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: "qwen2.5:7b" }, { name: "llama3" }] }),
      }),
    );

    const result = await testConnection({
      endpoint: "http://localhost:11434",
      isOllama: true,
      model: "qwen2.5:7b",
      apiKey: "",
    });

    expect(result).toEqual({ ok: true, models: ["qwen2.5:7b", "llama3"] });
  });
});
