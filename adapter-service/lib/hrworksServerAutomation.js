// Serverseitiger HRworks-Worker: nutzt die bestehende Playwright-Automation
// (loginToHrworks + fillHrworksTravelExpenseForm aus e2e/helpers/hrworksAutomation.js).
// Kein Neuschreiben der Kernlogik, nur Orchestrierung für Queue-Jobs.

const DEFAULT_START_URL = "https://ssl4.hrworks.de/";

function needsAction(message) {
  const error = new Error(message);
  error.kind = "needs_action";
  return error;
}

export function createHrworksJobRunner({ env = process.env, logger = console } = {}) {
  const startUrl = String(env.HRWORKS_SERVER_START_URL || DEFAULT_START_URL).trim();
  const headless = String(env.HRWORKS_SERVER_HEADLESS || "true") !== "false";
  const navigationTimeoutMs = Number(env.HRWORKS_SERVER_TIMEOUT_MS || 45000);

  return async function runHrworksImportJob({ job, payloads, credentials }) {
    if (!credentials || !String(credentials.username || "").trim() || !String(credentials.password || "")) {
      throw needsAction("HRworks-Zugangsdaten fehlen für diesen Auftrag.");
    }
    if (!Array.isArray(payloads) || payloads.length === 0) {
      throw new Error("Keine Import-Tage im Auftrag enthalten.");
    }

    // Dynamische Imports: Playwright und die Automation werden nur geladen,
    // wenn tatsächlich ein Job läuft (hält Serverstart und Tests leichtgewichtig).
    const { chromium } = await import("playwright");
    const { fillHrworksTravelExpenseForm, loginToHrworks } = await import("../../e2e/helpers/hrworksAutomation.js");

    const loginUrl = String(credentials.baseUrl || "").trim() || startUrl;
    let browser = null;
    try {
      browser = await chromium.launch({ headless });
      const context = await browser.newContext();
      const page = await context.newPage();
      page.setDefaultTimeout(navigationTimeoutMs);
      await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

      const login = await loginToHrworks(page, credentials);
      if (login.mfaRequired) {
        return {
          status: "needs_action",
          message: "HRworks verlangt eine Zwei-Faktor-Bestätigung. Bitte den Import manuell in HRworks abschließen.",
        };
      }
      logger?.info?.("hrworks server login ok", { jobId: job?.id });

      let completedDays = 0;
      for (const payload of payloads) {
        await fillHrworksTravelExpenseForm(page, payload, {
          confirmBeforeSave: true,
          runRouteFlow: true,
          completeWorkflow: true,
        });
        completedDays += 1;
        logger?.info?.("hrworks server day imported", { jobId: job?.id, date: payload?.date, completedDays });
      }

      return {
        status: "completed",
        summary: `HRworks-Import abgeschlossen: ${completedDays} Tag(e) übertragen.`,
      };
    } finally {
      await browser?.close?.().catch(() => {});
    }
  };
}
