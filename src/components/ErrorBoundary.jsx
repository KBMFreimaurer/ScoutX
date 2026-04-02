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
            fontFamily: "'Barlow', sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 620,
              width: "100%",
              background: C.surface,
              border: `1px solid ${C.error}`,
              borderRadius: 8,
              padding: 20,
            }}
          >
            <h2 style={{ margin: "0 0 8px", color: "#ff8080", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase" }}>
              Unerwarteter Fehler
            </h2>
            <p style={{ margin: "0 0 16px", color: C.gray }}>Die Anwendung ist abgestürzt. Bitte Seite neu laden.</p>
            <pre
              style={{
                margin: 0,
                padding: 12,
                borderRadius: 6,
                background: "#111",
                color: "#ff8080",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
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
