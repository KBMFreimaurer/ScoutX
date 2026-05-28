export function buildHrworksOpenLoginResponse(session, page) {
  const context = session?.context;
  const pages = typeof context?.pages === "function" ? context.pages() : [];
  return {
    ok: true,
    status: "ready",
    browserMode: session?.mode || "",
    sameBrowser: session?.sameBrowser === true,
    warning: String(session?.attachError || ""),
    url: typeof page?.url === "function" ? page.url() : "",
    pageCount: Array.isArray(pages) ? pages.length : 0,
  };
}
