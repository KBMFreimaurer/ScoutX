import { isNativeCapacitorRuntime } from "./deepLinks";

function fallbackDownload(blob, fileName) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

function extractBase64Payload(dataUrl) {
  const payload = String(dataUrl || "").split(",", 2)[1] || "";
  if (!payload) {
    throw new Error("Exportdatei konnte nicht kodiert werden.");
  }
  return payload;
}

function toSafeExportFileName(fileName) {
  const raw = String(fileName || "ScoutX-Export.pdf").trim() || "ScoutX-Export.pdf";
  const normalized = raw.replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.toLowerCase().endsWith(".pdf") ? normalized : `${normalized}.pdf`;
}

async function shareAsNativeFile(blob, fileName, title) {
  const [{ Share }, { Filesystem, Directory }] = await Promise.all([
    import("@capacitor/share"),
    import("@capacitor/filesystem"),
  ]);

  const safeFileName = toSafeExportFileName(fileName);
  const exportPath = `scoutx-exports/${Date.now()}-${safeFileName}`;
  const base64Data = extractBase64Payload(await blobToDataUrl(blob));
  const writeResult = await Filesystem.writeFile({
    path: exportPath,
    data: base64Data,
    directory: Directory.Cache,
    recursive: true,
  });
  const fileUri = String(writeResult?.uri || "");
  if (!fileUri) {
    throw new Error("Datei-URI konnte nicht erstellt werden.");
  }

  await Share.share({
    title,
    text: fileName,
    url: fileUri,
    files: [fileUri],
    dialogTitle: title,
  });

  return { ok: true, method: "share-file", fallbackUsed: false };
}

async function shareAsDataUrl(blob, fileName, title) {
  const { Share } = await import("@capacitor/share");
  const dataUrl = await blobToDataUrl(blob);
  await Share.share({
    title,
    text: fileName,
    url: dataUrl,
    dialogTitle: title,
  });
  return { ok: true, method: "share", fallbackUsed: false };
}

export async function shareOrDownloadBlob(blob, fileName, title = "ScoutX Export") {
  if (!(blob instanceof Blob)) {
    return { ok: false, method: "none", error: "Ungültige Datei für Export." };
  }

  if (typeof window === "undefined") {
    return { ok: false, method: "none", error: "Export nur im Browser verfügbar." };
  }

  if (!isNativeCapacitorRuntime()) {
    fallbackDownload(blob, fileName);
    return { ok: true, method: "download", fallbackUsed: false };
  }

  try {
    return await shareAsNativeFile(blob, fileName, title);
  } catch {
    try {
      return await shareAsDataUrl(blob, fileName, title);
    } catch {
      fallbackDownload(blob, fileName);
      return {
        ok: false,
        method: "download",
        fallbackUsed: true,
        error: "Teilen war nicht möglich. Die PDF wurde stattdessen als Download bereitgestellt.",
      };
    }
  }
}
