const LLM_TIMEOUT_MS = Number(import.meta.env?.VITE_LLM_TIMEOUT_MS || 30000);

function createTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function fetchWithTimeout(url, options, timeoutMs, errorPrefix) {
  const { signal, clear } = createTimeoutController(timeoutMs);

  try {
    return await fetch(url, { ...options, signal });
  } catch (error) {
    const message = String(error?.message || "");
    const isNetworkError =
      error instanceof TypeError ||
      error?.name === "TypeError" ||
      /load failed|failed to fetch|networkerror/i.test(message);

    if (error?.name === "AbortError") {
      throw new Error(`${errorPrefix} Timeout nach ${timeoutMs}ms`);
    }
    if (isNetworkError) {
      throw new Error(`${errorPrefix} nicht erreichbar (${url}). Prüfe Endpoint/Proxy/CORS.`);
    }
    throw error;
  } finally {
    clear();
  }
}

export async function callLLM({ endpoint, isOllama, model, apiKey, prompt, timeoutMs = LLM_TIMEOUT_MS }) {
  const url = isOllama ? `${endpoint}/api/generate` : `${endpoint}/v1/chat/completions`;
  const body = isOllama
    ? JSON.stringify({ model, prompt, stream: false })
    : JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.7 });

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetchWithTimeout(url, { method: "POST", headers, body }, timeoutMs, "LLM");
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }

  const data = await response.json();
  return isOllama ? data.response ?? "" : data.choices?.[0]?.message?.content ?? "";
}

async function testOllamaConnection(endpoint, timeoutMs = LLM_TIMEOUT_MS) {
  const response = await fetchWithTimeout(`${endpoint}/api/tags`, {}, timeoutMs, "LLM-Verbindungstest");
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return (data.models ?? []).map((item) => item.name);
}

export async function testConnection({ endpoint, isOllama, model, apiKey, timeoutMs = LLM_TIMEOUT_MS }) {
  if (isOllama) {
    const models = await testOllamaConnection(endpoint, timeoutMs);
    return { ok: true, models };
  }

  await callLLM({
    endpoint,
    isOllama: false,
    model,
    apiKey,
    prompt: "Hi",
    timeoutMs,
  });

  return { ok: true, models: [model] };
}
