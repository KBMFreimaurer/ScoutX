import React from "react";
import { C } from "../styles/theme";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Unbekannter Fehler" };
  }

  componentDidCatch(error, info) {
    console.error("ScoutX ErrorBoundary captured an error", error, info);

    if (this.props.onError) {
      this.props.onError(error, info);
    }
  }

  handleReload() {
    if (typeof this.props.onReload === "function") {
      this.props.onReload();
      return;
    }

    if (typeof window !== "undefined" && window.location?.reload) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: C.bg,
            color: C.offWhite,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 520,
              width: "100%",
              background: "rgba(255,255,255,0.03)",
              border: `1px solid rgba(239,68,68,0.2)`,
              borderRadius: 16,
              padding: 24,
            }}
          >
            <h2 style={{
              margin: "0 0 8px",
              color: "#fca5a5",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: "-0.2px",
            }}>
              Unerwarteter Fehler
            </h2>
            <p style={{ margin: "0 0 16px", color: C.gray, fontSize: 14, lineHeight: 1.5 }}>
              Die Anwendung ist abgestürzt. Bitte Seite neu laden.
            </p>
            <pre
              style={{
                margin: 0,
                padding: 14,
                borderRadius: 10,
                background: "rgba(0,0,0,0.3)",
                color: "#fca5a5",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {this.state.message}
            </pre>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                marginTop: 14,
                borderRadius: 8,
                border: `1px solid rgba(252,165,165,0.35)`,
                background: "rgba(239,68,68,0.12)",
                color: "#fecaca",
                minHeight: 36,
                padding: "8px 12px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Seite neu laden
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
