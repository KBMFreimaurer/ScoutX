const COMPANION_DOWNLOADS = Object.freeze([
  {
    platform: "macos",
    label: "Companion für macOS herunterladen",
    href: "/downloads/scoutx-companion-macos.zip",
    fileName: "scoutx-companion-macos.zip",
    installHint: "ZIP entpacken und install.command öffnen.",
  },
  {
    platform: "windows",
    label: "Companion für Windows herunterladen",
    href: "/downloads/scoutx-companion-windows.zip",
    fileName: "scoutx-companion-windows.zip",
    installHint: "ZIP entpacken und install.bat öffnen.",
  },
]);

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function detectDesktopPlatform({ platform = "", userAgent = "" } = {}) {
  const platformText = normalizeText(platform);
  const userAgentText = normalizeText(userAgent);
  if (platformText.includes("mac") || userAgentText.includes("mac os x") || userAgentText.includes("macintosh")) {
    return "macos";
  }
  if (platformText.includes("win") || userAgentText.includes("windows")) {
    return "windows";
  }
  return "unknown";
}

export function getScoutXCompanionInstallOptions() {
  return COMPANION_DOWNLOADS.map((download) => ({ ...download }));
}

export function resolveScoutXCompanionInstallTarget(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const platform = detectDesktopPlatform({
    platform: source.platform ?? (typeof navigator !== "undefined" ? navigator.platform : ""),
    userAgent: source.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : ""),
  });
  const downloads = getScoutXCompanionInstallOptions();
  return {
    platform,
    primaryDownload: downloads.find((download) => download.platform === platform) || null,
    downloads,
  };
}
