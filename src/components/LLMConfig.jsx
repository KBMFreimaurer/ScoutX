import { C, card, inp, lbl } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function LLMConfig({
  llmType,
  llmModel,
  llmEndpoint,
  llmKey,
  rememberApiKey,
  llmIsOllama,
  connStatus,
  presets,
  onApplyPreset,
  onSetLlmModel,
  onSetLlmEndpoint,
  onSetLlmKey,
  onSetRememberApiKey,
  onToggleProtocol,
  onTestConnection,
}) {
  return (
    <div style={card}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: C.green }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <SectionHeader num="05">LLM verbinden</SectionHeader>

        {connStatus && connStatus !== "testing" ? (
          <div
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 11,
              minHeight: 0,
              background: connStatus.ok ? C.greenDim : C.errorDim,
              border: `1px solid ${connStatus.ok ? C.green : C.error}`,
              color: connStatus.ok ? C.green : "#ff8080",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              letterSpacing: "0.5px",
            }}
          >
            {connStatus.ok
              ? `✓ VERBUNDEN · ${connStatus.models.length} Modell${connStatus.models.length !== 1 ? "e" : ""}`
              : "✗ KEINE VERBINDUNG"}
          </div>
        ) : null}

        {connStatus === "testing" ? <div className="skeleton" style={{ width: 160, height: 28 }} /> : null}
      </div>

      <div className="preset-btns">
        {Object.entries(presets).map(([presetType, preset]) => {
          const selected = llmType === presetType;
          return (
            <button
              key={presetType}
              onClick={() => onApplyPreset(presetType)}
              style={{
                padding: "7px 14px",
                borderRadius: 5,
                minHeight: 44,
                border: `1px solid ${selected ? C.green : C.border}`,
                background: selected ? C.greenDark : "#111",
                color: selected ? C.white : C.gray,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 12,
                fontWeight: selected ? 700 : 600,
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                letterSpacing: "0.5px",
              }}
            >
              <span>{preset.label}</span>
              {preset.recommended ? (
                <span style={{ fontSize: 9, color: selected ? C.green : C.grayDark, letterSpacing: "1px" }}>EMPFOHLEN</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="llm-row" style={{ marginBottom: 10 }}>
        <div>
          <label style={lbl}>Endpoint</label>
          <input
            value={llmEndpoint}
            onChange={(event) => onSetLlmEndpoint(event.target.value)}
            style={inp}
          />
        </div>

        <div>
          <label style={lbl}>Modell</label>
          {connStatus?.ok && connStatus.models.length > 0 ? (
            <select value={llmModel} onChange={(event) => onSetLlmModel(event.target.value)} style={{ ...inp, cursor: "pointer" }}>
              {connStatus.models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          ) : (
            <input value={llmModel} onChange={(event) => onSetLlmModel(event.target.value)} placeholder="qwen2.5:7b" style={inp} />
          )}
        </div>
      </div>

      {!llmIsOllama ? (
        <div style={{ marginBottom: 10 }}>
          <label style={lbl}>API Key</label>
          <input
            type="password"
            placeholder="sk-..."
            value={llmKey}
            onChange={(event) => onSetLlmKey(event.target.value)}
            style={inp}
          />
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <input
              id="remember-api-key"
              type="checkbox"
              checked={rememberApiKey}
              onChange={(event) => onSetRememberApiKey(event.target.checked)}
              style={{ minHeight: 16, minWidth: 16 }}
            />
            <label htmlFor="remember-api-key" style={{ color: C.gray, fontSize: 12, fontFamily: "'Barlow', sans-serif" }}>
              API-Key lokal speichern (nur wenn nötig)
            </label>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <label style={{ ...lbl, marginBottom: 0 }}>Protokoll</label>
        <button
          onClick={onToggleProtocol}
          style={{
            padding: "4px 12px",
            borderRadius: 20,
            minHeight: 0,
            border: `1px solid ${llmIsOllama ? C.green : C.border}`,
            background: llmIsOllama ? C.greenDim : "transparent",
            color: llmIsOllama ? C.green : C.gray,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.5px",
          }}
        >
          {llmIsOllama ? "✓ OLLAMA API" : "OPENAI-KOMPATIBEL"}
        </button>
      </div>

      <button
        onClick={onTestConnection}
        disabled={connStatus === "testing"}
        style={{
          width: "100%",
          padding: "11px",
          borderRadius: 5,
          minHeight: 44,
          border: `1px solid ${connStatus?.ok ? C.green : C.border}`,
          background: connStatus?.ok ? C.greenDim : "#111",
          color: connStatus?.ok ? C.green : C.offWhite,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "1px",
          cursor: connStatus === "testing" ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          textTransform: "uppercase",
        }}
      >
        {connStatus === "testing"
          ? "Verbindung wird geprüft..."
          : connStatus?.ok
            ? "✓ Verbunden - neu testen"
            : "⚡ Verbindung testen"}
      </button>

      {connStatus?.ok === false ? (
        <div style={{ marginTop: 10, padding: "12px 14px", background: C.errorDim, border: `1px solid ${C.error}`, borderRadius: 5, fontSize: 12 }}>
          <div
            style={{
              fontWeight: 700,
              color: "#ff8080",
              marginBottom: 4,
              fontFamily: "'Barlow Condensed',sans-serif",
              letterSpacing: "0.5px",
            }}
          >
            VERBINDUNG FEHLGESCHLAGEN
          </div>
          <div style={{ color: "#cc5050", marginBottom: 8 }}>{connStatus.error}</div>
          <code
            style={{
              display: "block",
              background: "#0a0a0a",
              padding: "6px 10px",
              borderRadius: 4,
              color: "#80c880",
              fontSize: 11,
              marginBottom: 4,
            }}
          >
            OLLAMA_ORIGINS=&quot;*&quot; ollama serve
          </code>
          <code style={{ display: "block", background: "#0a0a0a", padding: "6px 10px", borderRadius: 4, color: "#80c880", fontSize: 11 }}>
            ollama pull {presets.qwen.model}
          </code>
        </div>
      ) : null}

      {connStatus?.ok && connStatus.models.length > 0 ? (
        <div style={{ marginTop: 10, padding: "12px 14px", background: C.greenDim, border: `1px solid ${C.greenDark}`, borderRadius: 5 }}>
          <div
            style={{
              color: C.green,
              marginBottom: 8,
              fontWeight: 700,
              fontSize: 11,
              fontFamily: "'Barlow Condensed',sans-serif",
              letterSpacing: "1px",
            }}
          >
            VERFÜGBARE MODELLE
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {connStatus.models.map((model) => (
              <button
                key={model}
                onClick={() => onSetLlmModel(model)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 4,
                  fontSize: 12,
                  minHeight: 0,
                  border: `1px solid ${llmModel === model ? C.green : C.greenDark}`,
                  background: llmModel === model ? C.greenDark : "transparent",
                  color: llmModel === model ? C.white : C.green,
                  cursor: "pointer",
                  fontFamily: "'Barlow', sans-serif",
                }}
              >
                {llmModel === model ? "✓ " : ""}
                {model}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
