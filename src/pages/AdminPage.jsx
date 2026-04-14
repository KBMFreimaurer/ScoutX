import { useCallback, useEffect, useMemo, useState } from "react";
import { GhostButton, PrimaryButton } from "../components/Buttons";
import { useScoutX } from "../context/ScoutXContext";
import { fetchAdapterAdminStatus, fetchAdapterHealth, resolveAdapterAdminUrl, triggerAdapterAdminRefresh } from "../services/adapterAdmin";
import { C } from "../styles/theme";

function formatDateTime(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "-";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
}

function renderMetaValue(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "-";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Objekt]";
    }
  }

  return String(value);
}

export function AdminPage() {
  const { adapterEndpoint, adapterToken } = useScoutX();
  const [status, setStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const adminStatusUrl = useMemo(() => resolveAdapterAdminUrl(adapterEndpoint, "status"), [adapterEndpoint]);
  const authEnabled = Boolean(String(adapterToken || "").trim());

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [nextStatus, nextHealth] = await Promise.all([
        fetchAdapterAdminStatus(adapterEndpoint, adapterToken),
        fetchAdapterHealth(adapterEndpoint).catch(() => null),
      ]);

      setStatus(nextStatus || null);
      setHealth(nextHealth || null);
    } catch (loadError) {
      setError(`Adapter-Status konnte nicht geladen werden: ${String(loadError?.message || loadError || "Unbekannter Fehler")}`);
    } finally {
      setLoading(false);
    }
  }, [adapterEndpoint, adapterToken]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const onManualRefresh = async () => {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    setError("");
    setNotice("");

    try {
      const refreshed = await triggerAdapterAdminRefresh(adapterEndpoint, adapterToken);
      setStatus(refreshed || null);
      setNotice("Daten-Refresh wurde erfolgreich ausgelöst.");
      const latestHealth = await fetchAdapterHealth(adapterEndpoint).catch(() => null);
      if (latestHealth) {
        setHealth(latestHealth);
      }
    } catch (refreshError) {
      setError(`Adapter-Refresh fehlgeschlagen: ${String(refreshError?.message || refreshError || "Unbekannter Fehler")}`);
    } finally {
      setRefreshing(false);
    }
  };

  const statusMeta = status?.meta && typeof status.meta === "object" ? status.meta : {};

  return (
    <div className="fu">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              letterSpacing: "-0.4px",
              fontWeight: 800,
              color: C.white,
            }}
          >
            Adapter-Admin
          </h1>
          <p style={{ margin: "6px 0 0", color: C.gray, fontSize: 13 }}>
            Additive MVP-Erweiterung: Status prüfen und manuellen Refresh auslösen, ohne bestehende ScoutX-Flows zu verändern.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <GhostButton onClick={() => void loadStatus()} disabled={loading || refreshing}>
            {loading ? "Lade Status..." : "Status aktualisieren"}
          </GhostButton>
          <PrimaryButton onClick={onManualRefresh} disabled={loading || refreshing}>
            {refreshing ? "Refresh läuft..." : "Daten-Refresh starten"}
          </PrimaryButton>
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginBottom: 14,
            border: `1px solid rgba(239,68,68,0.22)`,
            background: C.errorDim,
            color: "#fca5a5",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          style={{
            marginBottom: 14,
            border: `1px solid ${C.greenBorder}`,
            background: C.greenDim,
            color: C.greenLight,
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
          }}
        >
          {notice}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <section
          className="fu2"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div style={{ color: C.offWhite, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Verbindung</div>
          <div style={{ color: C.gray, fontSize: 12, lineHeight: 1.6 }}>
            <div>
              Admin-Status URL: <code style={{ color: C.offWhite }}>{adminStatusUrl}</code>
            </div>
            <div>
              Adapter-Token gesetzt: <strong style={{ color: authEnabled ? C.greenLight : C.warn }}>{authEnabled ? "Ja" : "Nein"}</strong>
            </div>
            <div>
              Health-Endpoint erreichbar: <strong style={{ color: health?.ok ? C.greenLight : C.warn }}>{health?.ok ? "Ja" : "Unbekannt"}</strong>
            </div>
          </div>
        </section>

        <section
          className="fu2"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div style={{ color: C.offWhite, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Adapter-Status</div>
          <div style={{ color: C.gray, fontSize: 12, lineHeight: 1.6 }}>
            <div>
              Spiele im Store: <strong style={{ color: C.offWhite }}>{renderMetaValue(status?.count)}</strong>
            </div>
            <div>
              Letzter Refresh-Grund: <strong style={{ color: C.offWhite }}>{renderMetaValue(status?.lastRefreshReason)}</strong>
            </div>
            <div>
              Letzter Fehler: <strong style={{ color: status?.lastError ? "#fca5a5" : C.grayLight }}>{renderMetaValue(status?.lastError)}</strong>
            </div>
            <div>
              Meta aktualisiert: <strong style={{ color: C.offWhite }}>{formatDateTime(statusMeta?.updatedAt)}</strong>
            </div>
            <div>
              Health Zeitstempel: <strong style={{ color: C.offWhite }}>{formatDateTime(health?.timestamp)}</strong>
            </div>
          </div>
        </section>

        <section
          className="fu2"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div style={{ color: C.offWhite, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Meta (Kurzansicht)</div>
          <div style={{ color: C.gray, fontSize: 12, lineHeight: 1.6 }}>
            <div>
              Counts: <code style={{ color: C.offWhite }}>{renderMetaValue(statusMeta?.counts || {})}</code>
            </div>
            <div>
              Warnings: <code style={{ color: C.offWhite }}>{renderMetaValue(statusMeta?.warnings || [])}</code>
            </div>
            <div>
              Laden aktiv: <strong style={{ color: loading ? C.warn : C.grayLight }}>{loading ? "Ja" : "Nein"}</strong>
            </div>
            <div>
              Refresh aktiv: <strong style={{ color: refreshing ? C.warn : C.grayLight }}>{refreshing ? "Ja" : "Nein"}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
