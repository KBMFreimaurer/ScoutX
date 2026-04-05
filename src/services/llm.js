const LLM_TIMEOUT_MS = Number(import.meta.env?.VITE_LLM_TIMEOUT_MS || 120000);
const LLM_TIMEOUT_OLLAMA_MS = Number(import.meta.env?.VITE_LLM_TIMEOUT_OLLAMA_MS || 180000);
const LLM_TIMEOUT_OPENAI_MS = Number(import.meta.env?.VITE_LLM_TIMEOUT_OPENAI_MS || LLM_TIMEOUT_MS);
const LLM_MAX_OUTPUT_TOKENS = Number(import.meta.env?.VITE_LLM_MAX_OUTPUT_TOKENS || 1100);
const LLM_HTTP_RETRY_DELAYS_MS = [1000, 2000];
const SKIP_RETRY_WAIT = import.meta.env?.MODE === "test";

function normalizeTimeout(value, fallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed);
  }
  return fallback;
}

function normalizeMaxOutputTokens(value, fallback = 1100) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(200, Math.min(4000, Math.round(parsed)));
  }
  return fallback;
}

function normalizeRetryCount(value, fallback = 0, max = 3) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.max(0, Math.min(max, Math.round(parsed)));
  }
  return fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function summarizeHttpErrorText(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return "";
  }

  const h1 = raw.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1];
  if (h1) {
    return h1.trim();
  }

  const title = raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  if (title) {
    return title.trim();
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error) {
      return String(parsed.error);
    }
  } catch {
    // ignore JSON parse errors and fall back to plain-text summary
  }

  return raw.replace(/\s+/g, " ").slice(0, 140);
}

function buildHttpError(status, text) {
  const summary = summarizeHttpErrorText(text);
  return new Error(`HTTP ${status}${summary ? `: ${summary}` : ""}`);
}

function isRetryableHttpStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableLlmError(error) {
  const message = String(error?.message || "").toLowerCase();
  return /timeout|nicht erreichbar|network|failed to fetch|gateway time-out|gateway timeout/.test(message);
}

async function requestLlmWithRetry(url, options, timeoutMs, errorPrefix, retryOptions = {}) {
  const maxHttpRetries = normalizeRetryCount(retryOptions.maxHttpRetries, 2, 4);
  const maxTimeoutRetries = normalizeRetryCount(retryOptions.maxTimeoutRetries, 1, 3);
  let currentTimeout = timeoutMs;
  let lastError = null;

  for (let attempt = 0; attempt <= maxHttpRetries; attempt += 1) {
    try {
      const response = await fetchWithTimeoutRetry(url, options, currentTimeout, errorPrefix, maxTimeoutRetries);
      if (response.ok) {
        return response;
      }

      const text = await response.text().catch(() => "");
      const responseError = buildHttpError(response.status, text);
      lastError = responseError;

      const canRetryStatus = attempt < maxHttpRetries && isRetryableHttpStatus(response.status);
      if (!canRetryStatus) {
        throw responseError;
      }
    } catch (error) {
      lastError = error;
      const canRetryError = attempt < maxHttpRetries && isRetryableLlmError(error);
      if (!canRetryError) {
        throw error;
      }
    }

    const delayMs = LLM_HTTP_RETRY_DELAYS_MS[Math.min(attempt, LLM_HTTP_RETRY_DELAYS_MS.length - 1)] || 0;
    await sleep(SKIP_RETRY_WAIT ? 0 : delayMs);
    currentTimeout = Math.round(currentTimeout * 1.2);
  }

  throw lastError || new Error("LLM Anfrage fehlgeschlagen.");
}

export async function callLLM({
  endpoint,
  isOllama,
  model,
  apiKey,
  prompt,
  timeoutMs,
  maxOutputTokens,
  maxHttpRetries,
  maxTimeoutRetries,
}) {
  const url = isOllama ? `${endpoint}/api/generate` : `${endpoint}/v1/chat/completions`;
  const resolvedTimeoutMs = resolveTimeoutMs({ timeoutMs, isOllama, prompt });
  const resolvedMaxOutputTokens = normalizeMaxOutputTokens(
    maxOutputTokens,
    normalizeMaxOutputTokens(LLM_MAX_OUTPUT_TOKENS, 1100),
  );
  const body = isOllama
    ? JSON.stringify({ model, prompt, stream: false, options: { num_predict: resolvedMaxOutputTokens } })
    : JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: resolvedMaxOutputTokens,
    });

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await requestLlmWithRetry(
    url,
    { method: "POST", headers, body },
    resolvedTimeoutMs,
    "LLM",
    {
      maxHttpRetries,
      maxTimeoutRetries,
    },
  );

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
