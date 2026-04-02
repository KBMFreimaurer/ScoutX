export const C = {
  bg: "#0d0d0d",
  surface: "#1a1a1a",
  surfaceHi: "#222222",
  border: "#2e2e2e",
  borderHi: "#3d3d3d",
  green: "#00873E",
  greenDark: "#005C2A",
  greenDim: "#001f10",
  greenBorder: "#00873E44",
  white: "#FFFFFF",
  offWhite: "#E8E8E8",
  gray: "#888888",
  grayDark: "#555555",
  warn: "#E8A000",
  warnDim: "#1a1200",
  error: "#CC3333",
  errorDim: "#1a0808",
};

export const LLM_PRESETS = {
  qwen: {
    label: "Qwen",
    endpoint: "http://127.0.0.1:11434",
    model: "qwen2.5:7b",
    key: "",
    isOllama: true,
    recommended: true,
  },
  llama: {
    label: "Llama 3",
    endpoint: "http://127.0.0.1:11434",
    model: "llama3",
    key: "",
    isOllama: true,
  },
  mistral: {
    label: "Mistral",
    endpoint: "http://127.0.0.1:11434",
    model: "mistral",
    key: "",
    isOllama: true,
  },
  lmstudio: {
    label: "LM Studio",
    endpoint: "http://localhost:1234",
    model: "local-model",
    key: "",
    isOllama: false,
  },
  openai: {
    label: "OpenAI API",
    endpoint: "https://api.openai.com",
    model: "gpt-4o-mini",
    key: "",
    isOllama: false,
  },
};

export const STEPS = ["setup", "games", "plan"];

export const STORAGE_KEYS = {
  setup: "scoutplan.setup.v1",
  llm: "scoutplan.llm.v1",
  llmSessionKey: "scoutplan.llm.sessionKey.v1",
};

export const DATA_SOURCE_OPTIONS = [
  { value: "auto", label: "Auto (CSV -> Adapter -> Mock)" },
  { value: "csv", label: "CSV/JSON Import" },
  { value: "adapter", label: "Live-Adapter (HTTP)" },
  { value: "mock", label: "Demo (Zufallsdaten)" },
];
