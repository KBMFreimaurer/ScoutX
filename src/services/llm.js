export async function callLLM({ endpoint, isOllama, model, apiKey, prompt }) {
  const url = isOllama ? `${endpoint}/api/generate` : `${endpoint}/v1/chat/completions`;
  const body = isOllama
    ? JSON.stringify({ model, prompt, stream: false })
    : JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.7 });

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, { method: "POST", headers, body });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }

  const data = await response.json();
  return isOllama ? data.response ?? "" : data.choices?.[0]?.message?.content ?? "";
}

async function testOllamaConnection(endpoint) {
  const response = await fetch(`${endpoint}/api/tags`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return (data.models ?? []).map((item) => item.name);
}

export async function testConnection({ endpoint, isOllama, model, apiKey }) {
  if (isOllama) {
    const models = await testOllamaConnection(endpoint);
    return { ok: true, models };
  }

  await callLLM({
    endpoint,
    isOllama: false,
    model,
    apiKey,
    prompt: "Hi",
  });

  return { ok: true, models: [model] };
}
