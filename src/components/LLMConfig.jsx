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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <SectionHeader num="05">KI Engine</SectionHeader>

        {connStatus && connStatus !== "testing" ? (
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 11,
              minHeight: 0,
              background: connStatus.ok ? C.greenDim : C.errorDim,
              border: `1px solid ${connStatus.ok ? C.greenBorder : "rgba(239,68,68,0.2)"}`,
              color: connStatus.ok ? C.green : "#fca5a5",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: connStatus.ok ? C.green : C.error }} />
            {connStatus.ok
              ? `${connStatus.models.length} Modell${connStatus.models.length !== 1 ? "e" : ""}`
              : "Offline"}
          </div>
        ) : null}

        {connStatus === "testing" ? <div className="skeleton" style={{ width: 120, height: 24, borderRadius: 6 }} /> : null}
      </div>

      <div className="preset-btns">
        {Object.entries(presets).map(([presetType, preset]) => {
          const selected = llmType === presetType;
          return (
            <button
              key={presetType}
              onClick={() => onApplyPreset(presetType)}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                minHeight: 36,
                border: `1px solid ${selected ? C.greenBorder : C.border}`,
                background: selected ? C.green : "rgba(255,255,255,0.03)",
                color: selected ? C.bg : C.grayLight,
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: selected ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <span>{preset.label}</span>
              {preset.recommended ? (
                <span style={{ fontSize: 9, color: selected ? "rgba(6,6,9,0.6)" : C.grayDark, fontWeight: 500 }}>EMPFOHLEN</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="llm-row" style={{ marginBottom: 10 }}>
        <div>
          <label style={lbl}>Endpoint</label>
          <input
            className="scout-input"
            value={llmEndpoint}
            onChange={(event) => onSetLlmEndpoint(event.target.value)}
            style={inp}
          />
        </div>

        <div>
          <label style={lbl}>Modell</label>
          {connStatus?.ok && connStatus.models.length > 0 ? (
            <select
              className="scout-select"
              value={llmModel}
              onChange={(event) => onSetLlmModel(event.target.value)}
              style={{ ...inp, cursor: "pointer" }}
            >
              {connStatus.models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="scout-input"
              value={llmModel}
              onChange={(event) => onSetLlmModel(event.target.value)}
              placeholder="qwen2.5:7b"
              style={inp}
            />
          )}
        </div>
      </div>

      {!llmIsOllama ? (
        <div style={{ marginBottom: 10 }}>
          <label style={lbl}>API Key</label>
          <input
            className="scout-input"
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
              style={{ minHeight: 16, minWidth: 16, accentColor: C.green }}
            />
            <label htmlFor="remember-api-key" style={{ color: C.gray, fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
              API-Key lokal speichern
            </label>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <label style={{ ...lbl, marginBottom: 0 }}>Protokoll</label>
        <button
          onClick={onToggleProtocol}
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            minHeight: 0,
            border: `1px solid ${llmIsOllama ? C.greenBorder : C.border}`,
            background: llmIsOllama ? C.greenDim : "rgba(255,255,255,0.03)",
            color: llmIsOllama ? C.green : C.gray,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {llmIsOllama ? "OLLAMA" : "OPENAI"}
        </button>
      </div>

      <button
        onClick={onTestConnection}
        disabled={connStatus === "testing"}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 10,
          minHeight: 44,
          border: `1px solid ${connStatus?.ok ? C.greenBorder : C.border}`,
          background: connStatus?.ok ? C.greenDim : "rgba(255,255,255,0.04)",
          color: connStatus?.ok ? C.green : C.offWhite,
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          cursor: connStatus === "testing" ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {connStatus === "testing" ? (
          <>
            <span className="skeleton" style={{ width: 16, height: 16, borderRadius: "50%" }} />
            Verbindung wird geprüft...
          </>
        ) : connStatus?.ok ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Verbunden
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Verbindung testen
          </>
        )}
      </button>

      {connStatus?.ok === false ? (
        <div style={{ marginTop: 10, padding: "14px", background: C.errorDim, border: `1px solid rgba(239,68,68,0.15)`, borderRadius: 10, fontSize: 12 }}>
          <div
            style={{
              fontWeight: 600,
              color: "#fca5a5",
              marginBottom: 6,
              fontFamily: "'Inter',sans-serif",
              fontSize: 12,
            }}
          >
            Verbindung fehlgeschlagen
          </div>
          <div style={{ color: "#f87171", marginBottom: 10, fontSize: 12 }}>{connStatus.error}</div>
          <code
            style={{
              display: "block",
              background: "rgba(0,0,0,0.3)",
              padding: "8px 12px",
              borderRadius: 8,
              color: C.greenLight,
              fontSize: 11,
              marginBottom: 4,
              fontFamily: "'JetBrains Mono',monospace",
            }}
          >
            OLLAMA_ORIGINS=&quot;*&quot; ollama serve
          </code>
          <code style={{ display: "block", background: "rgba(0,0,0,0.3)", padding: "8px 12px", borderRadius: 8, color: C.greenLight, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
            ollama pull {presets.qwen.model}
          </code>
        </div>
      ) : null}

      {connStatus?.ok && connStatus.models.length > 0 ? (
        <div style={{ marginTop: 10, padding: "14px", background: C.greenDim, border: `1px solid ${C.greenBorder}`, borderRadius: 10 }}>
          <div
            style={{
              color: C.green,
              marginBottom: 8,
              fontWeight: 600,
              fontSize: 11,
              fontFamily: "'Inter',sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Verfügbare Modelle
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {connStatus.models.map((model) => (
              <button
                key={model}
                onClick={() => onSetLlmModel(model)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  fontSize: 11,
                  minHeight: 0,
                  border: `1px solid ${llmModel === model ? C.green : C.greenBorder}`,
                  background: llmModel === model ? "rgba(0,200,83,0.15)" : "transparent",
                  color: llmModel === model ? C.white : C.green,
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: "all 0.15s ease",
                }}
              >
                {llmModel === model ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ marginRight: 4 }}><polyline points="20 6 9 17 4 12"/></svg>
                ) : null}
                {model}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
