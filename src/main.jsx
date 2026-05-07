import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isNativeCapacitorRuntime } from "./native/deepLinks";
import { registerServiceWorker } from "./pwa/registerServiceWorker";

registerServiceWorker();

function isIosNativeWebview() {
  if (typeof window === "undefined") {
    return false;
  }
  if (!isNativeCapacitorRuntime()) {
    return false;
  }
  return String(window.Capacitor?.getPlatform?.() || "") === "ios";
}

function bootstrapIosViewportGuards() {
  if (typeof window === "undefined" || !isIosNativeWebview()) {
    return () => {};
  }

  const root = document.documentElement;
  root.setAttribute("data-ios-webview", "true");
  root.setAttribute("data-ios-keyboard-open", "false");

  const updateViewportVars = () => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      root.style.setProperty("--keyboard-offset", "0px");
      root.setAttribute("data-ios-keyboard-open", "false");
      return;
    }

    // iOS WebViews can report unstable offsetTop values while scrolling with keyboard open.
    // Derive the keyboard offset primarily from viewport height delta for smoother bottom-bar behavior.
    const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight || 0);
    const keyboardOffsetRaw = Math.max(0, Math.round(layoutHeight - visualViewport.height));
    const keyboardOffset = keyboardOffsetRaw > 80 ? keyboardOffsetRaw : 0;
    root.style.setProperty("--keyboard-offset", `${Math.round(keyboardOffset)}px`);
    root.setAttribute("data-ios-keyboard-open", keyboardOffset > 0 ? "true" : "false");
  };

  let rafId = null;
  const scheduleUpdate = () => {
    if (rafId !== null) {
      return;
    }
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      updateViewportVars();
    });
  };

  const visualViewport = window.visualViewport;
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("orientationchange", scheduleUpdate, { passive: true });
  document.addEventListener("focusin", scheduleUpdate, { passive: true });
  document.addEventListener("focusout", scheduleUpdate, { passive: true });

  if (visualViewport) {
    visualViewport.addEventListener("resize", scheduleUpdate, { passive: true });
  }

  scheduleUpdate();

  return () => {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    window.removeEventListener("resize", scheduleUpdate);
    window.removeEventListener("orientationchange", scheduleUpdate);
    document.removeEventListener("focusin", scheduleUpdate);
    document.removeEventListener("focusout", scheduleUpdate);
    visualViewport?.removeEventListener("resize", scheduleUpdate);
  };
}

const teardownIosViewportGuards = bootstrapIosViewportGuards();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardownIosViewportGuards();
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary
      onError={(error, info) => {
        console.error("[ScoutX ErrorBoundary]", error, info);
      }}
    >
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
