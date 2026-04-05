import React from "react";
import { C } from "../styles/theme";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Unbekannter Fehler" };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) {
      this.props.onError(error, info);
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
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
