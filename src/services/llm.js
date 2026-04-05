const LLM_TIMEOUT_MS = Number(import.meta.env?.VITE_LLM_TIMEOUT_MS || 120000);
const LLM_TIMEOUT_OLLAMA_MS = Number(import.meta.env?.VITE_LLM_TIMEOUT_OLLAMA_MS || 180000);
const LLM_TIMEOUT_OPENAI_MS = Number(import.meta.env?.VITE_LLM_TIMEOUT_OPENAI_MS || LLM_TIMEOUT_MS);

function normalizeTimeout(value, fallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed);
  }
  return fallback;
}

function resolveTimeoutMs({ timeoutMs, isOllama, prompt }) {
  const explicitTimeout = normalizeTimeout(timeoutMs, 0);
  if (explicitTimeout > 0) {
    return explicitTimeout;
  }

  const base = isOllama
    ? normalizeTimeout(LLM_TIMEOUT_OLLAMA_MS, 180000)
    : normalizeTimeout(LLM_TIMEOUT_OPENAI_MS, 120000);
  const promptText = String(prompt || "");
  const bonusBlocks = Math.floor(promptText.length / 2000);
  const promptBonusMs = Math.min(90000, bonusBlocks * 10000);

  return base + promptBonusMs;
}

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

async function fetchWithTimeoutRetry(url, options, timeoutMs, errorPrefix, retries = 1) {
  let lastError = null;
  let currentTimeout = timeoutMs;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchWithTimeout(url, options, currentTimeout, errorPrefix);
    } catch (error) {
      lastError = error;
      const isTimeout = /timeout/i.test(String(error?.message || ""));
      if (!isTimeout || attempt >= retries) {
        throw error;
      }

      currentTimeout = Math.round(currentTimeout * 1.5);
    }
  }

  throw lastError || new Error(`${errorPrefix} Anfrage fehlgeschlagen.`);
}

export async function callLLM({ endpoint, isOllama, model, apiKey, prompt, timeoutMs }) {
  const url = isOllama ? `${endpoint}/api/generate` : `${endpoint}/v1/chat/completions`;
  const resolvedTimeoutMs = resolveTimeoutMs({ timeoutMs, isOllama, prompt });
  const body = isOllama
    ? JSON.stringify({ model, prompt, stream: false })
    : JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.7 });

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetchWithTimeoutRetry(url, { method: "POST", headers, body }, resolvedTimeoutMs, "LLM", 1);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }

  const data = await response.json();
  return isOllama ? data.response ?? "" : data.choices?.[0]?.message?.content ?? "";
}

async function testOllamaConnection(endpoint, timeoutMs = LLM_TIMEOUT_MS) {
  const resolvedTimeoutMs = normalizeTimeout(timeoutMs, normalizeTimeout(LLM_TIMEOUT_OLLAMA_MS, 180000));
  const response = await fetchWithTimeout(`${endpoint}/api/tags`, {}, resolvedTimeoutMs, "LLM-Verbindungstest");
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
