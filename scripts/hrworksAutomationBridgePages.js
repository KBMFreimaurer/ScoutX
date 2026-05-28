export function isHrworksPageUrl(url) {
  const value = String(url || "");
  return value.startsWith("https://ssl4.hrworks.de/") || value.startsWith("https://login.hrworks.de/");
}

function isBrowserNewTabUrl(url) {
  const value = String(url || "");
  return value === "about:blank" || value.startsWith("chrome://newtab");
}

export function pickPreferredHrworksPage(pages) {
  const availablePages = Array.isArray(pages)
    ? pages.filter((page) => !page?.isClosed?.() && !String(page?.url?.() || "").startsWith("devtools://"))
    : [];

  const hrworksPages = availablePages.filter((page) => isHrworksPageUrl(page.url()));
  if (hrworksPages.length > 0) {
    return hrworksPages.at(-1) || null;
  }

  return availablePages.find((page) => isBrowserNewTabUrl(page.url())) || availablePages.at(-1) || null;
}

export async function openHrworksLoginTab(context, startUrl, onReady = null) {
  const page = await context.newPage();
  if (!isHrworksPageUrl(page.url())) {
    try {
      await page.goto(startUrl, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!String(error?.message || error || "").includes("ERR_ABORTED") || !isHrworksPageUrl(page.url())) {
        throw error;
      }
    }
  }
  if (typeof onReady === "function") {
    await onReady(page);
  }
  return page;
}
