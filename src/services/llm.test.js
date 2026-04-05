import { describe, expect, it, vi, beforeEach } from "vitest";
import { callLLM, testConnection } from "./llm";

describe("llm service", () => {
  beforeEach(() => {
    vi.useRealTimers();
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

  it("retries on 504 gateway timeout and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 504,
        text: async () => "<html><h1>504 Gateway Time-out</h1></html>",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: "Antwort nach Retry" }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await callLLM({
      endpoint: "http://localhost:11434",
      isOllama: true,
      model: "qwen2.5:7b",
      apiKey: "",
      prompt: "Test",
    });

    expect(result).toBe("Antwort nach Retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("normalizes gateway html error text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 504,
        text: async () =>
          "<html><head><title>504 Gateway Time-out</title></head><body><center><h1>504 Gateway Time-out</h1></center></body></html>",
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
    ).rejects.toThrow("HTTP 504: 504 Gateway Time-out");
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

  it("throws timeout error when llm call aborts", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(
      callLLM({
        endpoint: "http://localhost:11434",
        isOllama: true,
        model: "qwen2.5:7b",
        apiKey: "",
        prompt: "Test",
        timeoutMs: 2000,
      }),
    ).rejects.toThrow("LLM Timeout");
  });
});
