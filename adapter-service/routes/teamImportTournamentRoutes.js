export async function handleTeamImportTournamentRoutes(req, res, routeContext) {
  const MAX_NATIONAL_IMPORT_GAMES = 500;
  const MAX_KREIS_PDF_PREVIEW_GAMES = 1000;
  const {
    url,
    origin,
    requestId,
    clientIp,
    requestLogger,
    nowIso,
    randomUUID,
    readBody,
    readRawBody,
    sendJson,
    requireTeamSession,
    requireTeamWriteAllowed,
    applyTeamStateMutation,
    runTeamWriteIdempotent,
    normalizeAccountId,
    formatWizardDateForMeinturnierplan,
    toFilterKeywords,
    extractMeinturnierplanJson,
    parseGermanDateToIso,
    meinturnierplanBaseUrl,
    parseMultipartFormData,
    extractTextFromPdfBuffer,
    parseKreisPdfGamesFromText,
    teamKreisPdfPreviews,
    hasTokenExpired,
    createGameProvenance,
    runtimeDbEnabled,
    persistRuntimeKreisPdfPreview,
    fetchRuntimeKreisPdfPreviewByToken,
    deleteRuntimeKreisPdfPreview,
    dfbNationalSourceUrlTemplate,
    dfbNationalSourceToken,
    dfbNationalSourceTimeoutMs,
  } = routeContext;

  const fillTemplate = (value, replacements) => {
    let output = String(value || "");
    for (const [key, raw] of Object.entries(replacements || {})) {
      output = output.replaceAll(`{${key}}`, encodeURIComponent(String(raw ?? "")));
    }
    return output;
  };

  const fetchJsonWithTimeout = async (urlToFetch, timeoutMs, token) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = {
        accept: "application/json,text/plain,*/*",
        "user-agent": "ScoutX-Adapter/1.0",
      };
      if (token) {
        headers.authorization = `Bearer ${token}`;
      }
      const response = await fetch(urlToFetch, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`Timeout nach ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  const loadNationalGamesFromSource = async (payload) => {
    const template = String(dfbNationalSourceUrlTemplate || "").trim();
    if (!template) {
      return [];
    }
    const builtUrl = fillTemplate(template, {
      fromDate: String(payload?.fromDate || ""),
      toDate: String(payload?.toDate || payload?.fromDate || ""),
      ageGroup: String(payload?.ageGroup || payload?.jugendId || ""),
      ageGroups: Array.isArray(payload?.ageGroups) ? payload.ageGroups.join(",") : "",
      team: String(payload?.team || ""),
      region: String(payload?.region || ""),
    });
    if (!/^https?:\/\//i.test(builtUrl)) {
      throw new Error("ADAPTER_DFB_NATIONAL_SOURCE_URL_TEMPLATE erzeugt keine gueltige URL.");
    }
    const sourcePayload = await fetchJsonWithTimeout(
      builtUrl,
      Number(dfbNationalSourceTimeoutMs || 20000),
      String(dfbNationalSourceToken || "").trim(),
    );
    if (Array.isArray(sourcePayload)) {
      return sourcePayload;
    }
    if (Array.isArray(sourcePayload?.games)) {
      return sourcePayload.games;
    }
    if (Array.isArray(sourcePayload?.data)) {
      return sourcePayload.data;
    }
    return [];
  };

  if (req.method === "POST" && url.pathname === "/api/team/tournaments/import/meinturnierplan") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) return true;
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) return true;

    try {
      const payload = await readBody(req);
      const fromSlot = formatWizardDateForMeinturnierplan(payload?.fromDate, false);
      const toSlot = formatWizardDateForMeinturnierplan(payload?.toDate || payload?.fromDate, true);
      if (!fromSlot || !toSlot) {
        sendJson(res, 400, { ok: false, error: "fromDate/toDate im Format YYYY-MM-DD erforderlich." }, origin, requestId);
        return true;
      }

      const base = meinturnierplanBaseUrl.replace(/\/+$/, "");
      const searchUrl = `${base}/suche/${encodeURIComponent(fromSlot)}/${encodeURIComponent(toSlot)}`;
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "user-agent": "ScoutX-Adapter/1.0",
          accept: "text/html,application/xhtml+xml",
        },
      });
      const html = await response.text();
      const json = extractMeinturnierplanJson(html);
      const features = Array.isArray(json?.features) ? json.features : [];
      const keywords = toFilterKeywords(payload);

      const tournaments = features
        .map((feature) => {
          const props = feature?.properties || {};
          const name = String(props?.name || "").trim();
          const relativeUrl = String(props?.url || "").trim();
          const id = normalizeAccountId(relativeUrl.replace(/^.*id=/, ""));
          const startDate = parseGermanDateToIso(props?.startDate);
          const endDate = parseGermanDateToIso(props?.endDate);
          if (!name || !relativeUrl || !id) return null;
          const normalizedName = String(name || "")
            .trim()
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ");
          if (keywords.length > 0 && !keywords.some((keyword) => normalizedName.includes(keyword))) {
            return null;
          }
          return {
            id: `mtp-${id}`,
            externalId: id,
            source: "tournament",
            provider: "meinturnierplan.de",
            name,
            dateFrom: startDate,
            dateTo: endDate,
            url: relativeUrl.startsWith("http") ? relativeUrl : `${base}${relativeUrl}`,
            venue: "",
            note: "",
          };
        })
        .filter(Boolean);

      sendJson(
        res,
        200,
        {
          ok: true,
          provider: "meinturnierplan.de",
          query: {
            fromDate: String(payload?.fromDate || ""),
            toDate: String(payload?.toDate || payload?.fromDate || ""),
            teams: Array.isArray(payload?.teams) ? payload.teams : [],
            kreisId: String(payload?.kreisId || ""),
            jugendId: String(payload?.jugendId || ""),
          },
          count: tournaments.length,
          tournaments,
        },
        origin,
        requestId,
      );
      return true;
    } catch (error) {
      requestLogger.warn("meinturnierplan import failed", { error });
      const statusCode = Number(error?.statusCode || 502);
      const message = statusCode === 502 ? "Turnierimport von meinturnierplan.de fehlgeschlagen." : String(error?.message || "Turnierimport fehlgeschlagen.");
      sendJson(res, statusCode, { ok: false, error: message }, origin, requestId);
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/tournaments") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) return true;
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) return true;

    try {
      const payload = await readBody(req);
      const { tournament } = await runTeamWriteIdempotent(req, context, "team-tournament-create", payload, async () => {
        const name = String(payload?.name || payload?.title || "").trim();
        if (!name) {
          const validationError = new Error("Turniername ist erforderlich.");
          validationError.statusCode = 400;
          throw validationError;
        }
        const tournament = {
          id: `tournament-${randomUUID()}`,
          name,
          source: "tournament",
          dateFrom: String(payload?.dateFrom || "").trim(),
          dateTo: String(payload?.dateTo || "").trim(),
          venue: String(payload?.venue || "").trim(),
          note: String(payload?.note || "").trim(),
          createdBy: context.account.id,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          matches: [],
        };
        await applyTeamStateMutation(requestLogger, "team-tournament-create", (currentState) => {
          const tournaments = Array.isArray(currentState?.tournaments) ? currentState.tournaments : [];
          return { ...currentState, tournaments: [tournament, ...tournaments] };
        });
        return { tournament };
      });
      sendJson(res, 201, { ok: true, tournament }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("tournament create failed", { error });
      const statusCode = Number(error?.statusCode || 400);
      sendJson(res, statusCode, { ok: false, error: String(error?.message || "Turnier konnte nicht erstellt werden.") }, origin, requestId);
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/import/dfb-national-games") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) return true;
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) return true;

    try {
      const payload = await readBody(req);
      const { games } = await runTeamWriteIdempotent(req, context, "team-import-national-games", payload, async () => {
        const providedGames = Array.isArray(payload?.games) ? payload.games : [];
        const sourceGames = providedGames.length > 0 ? providedGames : await loadNationalGamesFromSource(payload);
        if (providedGames.length === 0 && sourceGames.length === 0) {
          const error = new Error(
            "Keine U-Nationalspiele gefunden. Bitte Spiele im Payload uebergeben oder eine DFB-Quelle konfigurieren.",
          );
          error.statusCode = 400;
          throw error;
        }
        if (sourceGames.length > MAX_NATIONAL_IMPORT_GAMES) {
          const error = new Error(
            `Zu viele U-Nationalspiele im Import (${sourceGames.length}). Maximal ${MAX_NATIONAL_IMPORT_GAMES} pro Anfrage erlaubt.`,
          );
          error.statusCode = 413;
          throw error;
        }
        const importedAt = nowIso();
        const games = sourceGames
          .map((game) => ({
            id: normalizeAccountId(game?.id) || `national-${randomUUID()}`,
            source: "national",
            tournamentId: "",
            home: String(game?.home || "").trim(),
            away: String(game?.away || "").trim(),
            date: String(game?.date || "").trim(),
            time: String(game?.time || "").trim(),
            venue: String(game?.venue || "").trim(),
            status: String(game?.status || "scheduled").trim() === "cancelled" ? "cancelled" : "scheduled",
            note: String(game?.note || "").trim(),
            createdBy: context.account.id,
            createdAt: importedAt,
            updatedAt: importedAt,
            provenance: createGameProvenance({
              source: "national",
              method: "api-import",
              provider: "dfb-national-games",
              importedBy: context.account.id,
              requestId,
              ingestedAt: importedAt,
            }),
          }))
          .filter((game) => game.home && game.away);

        await applyTeamStateMutation(requestLogger, "team-import-national-games", (currentState) => {
          const existing = Array.isArray(currentState?.manualGames) ? currentState.manualGames : [];
          const byId = new Map(existing.map((game) => [String(game?.id || ""), game]));
          for (const game of games) byId.set(game.id, game);
          return { ...currentState, manualGames: [...byId.values()] };
        });
        return { games };
      });
      sendJson(res, 200, { ok: true, importedCount: games.length, games }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("national games import failed", { error });
      const statusCode = Number(error?.statusCode || 400);
      sendJson(res, statusCode, { ok: false, error: String(error?.message || "Import der U-Nationalspiele fehlgeschlagen.") }, origin, requestId);
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/import/kreis-pdf") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) return true;
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) return true;

    try {
      const contentType = String(req.headers["content-type"] || "");
      let payload = {};
      let multipartRawText = "";
      if (/^multipart\/form-data/i.test(contentType)) {
        const rawBody = await readRawBody(req);
        multipartRawText = rawBody.toString("utf8");
        const { fields, files } = parseMultipartFormData(rawBody, contentType);
        const primaryFile = files[0] || null;
        let extractedText = String(fields?.extractedText || "");
        if (!extractedText && primaryFile) {
          if (/^text\//i.test(primaryFile.mimeType) || /\.txt$/i.test(primaryFile.fileName)) {
            extractedText = primaryFile.content.toString("utf8");
          } else if (/pdf/i.test(primaryFile.mimeType) || /\.pdf$/i.test(primaryFile.fileName)) {
            extractedText = extractTextFromPdfBuffer(primaryFile.content);
          } else {
            extractedText = primaryFile.content.toString("utf8");
          }
        }
        if (!extractedText) extractedText = rawBody.toString("utf8");
        payload = {
          ...fields,
          mode: String(fields?.mode || "preview"),
          fileName: String(fields?.fileName || primaryFile?.fileName || "kreis-auswahl.pdf"),
          extractedText,
        };
      } else if (/^application\/json/i.test(contentType)) {
        payload = await readBody(req);
      } else {
        const rawBody = await readRawBody(req);
        multipartRawText = rawBody.toString("utf8");
        payload = { mode: "preview", fileName: "kreis-auswahl.pdf", extractedText: multipartRawText };
      }

      const mode = String(payload?.mode || "preview").trim().toLowerCase();
      if (mode === "preview") {
        let games = parseKreisPdfGamesFromText(payload?.extractedText);
        if (games.length === 0 && multipartRawText) games = parseKreisPdfGamesFromText(multipartRawText);
        if (games.length === 0) {
          sendJson(res, 400, { ok: false, error: "Keine importierbaren Spiele im PDF-Text gefunden." }, origin, requestId);
          return true;
        }
        if (games.length > MAX_KREIS_PDF_PREVIEW_GAMES) {
          sendJson(
            res,
            413,
            {
              ok: false,
              error: `Zu viele Spiele in der Kreis-PDF-Vorschau (${games.length}). Maximal ${MAX_KREIS_PDF_PREVIEW_GAMES} Spiele pro Upload erlaubt.`,
            },
            origin,
            requestId,
          );
          return true;
        }
        const previewToken = randomUUID();
        const createdAt = nowIso();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const preview = {
          token: previewToken,
          fileName: String(payload?.fileName || "kreis-auswahl.pdf"),
          games,
          createdBy: context.account.id,
          teamId: context.account.teamId,
          createdAt,
          expiresAt,
        };
        if (!runtimeDbEnabled) {
          teamKreisPdfPreviews.set(previewToken, preview);
        }
        if (runtimeDbEnabled) {
          const persisted = await persistRuntimeKreisPdfPreview(preview, requestLogger);
          if (!persisted) {
            sendJson(res, 500, { ok: false, error: "Import-Preview konnte nicht persistent gespeichert werden." }, origin, requestId);
            return true;
          }
        }
        sendJson(
          res,
          200,
          { ok: true, previewToken, preview: { fileName: String(payload?.fileName || "kreis-auswahl.pdf"), count: games.length, games } },
          origin,
          requestId,
        );
        return true;
      }

      if (mode === "confirm") {
        const previewToken = String(payload?.previewToken || "").trim();
        if (!previewToken) {
          sendJson(res, 400, { ok: false, error: "previewToken ist erforderlich." }, origin, requestId);
          return true;
        }
        const preview = runtimeDbEnabled
          ? await fetchRuntimeKreisPdfPreviewByToken(previewToken, requestLogger)
          : teamKreisPdfPreviews.get(previewToken);
        if (!preview) {
          sendJson(res, 404, { ok: false, error: "Import-Preview wurde nicht gefunden." }, origin, requestId);
          return true;
        }
        if (hasTokenExpired(preview.expiresAt)) {
          teamKreisPdfPreviews.delete(previewToken);
          if (runtimeDbEnabled) {
            await deleteRuntimeKreisPdfPreview(previewToken, requestLogger);
          }
          sendJson(res, 400, { ok: false, error: "Import-Preview ist abgelaufen." }, origin, requestId);
          return true;
        }
        if (preview.teamId !== context.account.teamId) {
          sendJson(res, 403, { ok: false, error: "Import-Preview gehoert zu einem anderen Team." }, origin, requestId);
          return true;
        }

        const { games } = await runTeamWriteIdempotent(
          req,
          { account: { id: `kreis-preview:${previewToken}`, teamId: context.account.teamId } },
          "team-import-kreis-pdf-confirm",
          payload,
          async () => {
            const importedAt = nowIso();
            const games = (Array.isArray(preview.games) ? preview.games : []).map((game) => ({
              ...game,
              source: "manual",
              createdBy: context.account.id,
              createdAt: importedAt,
              updatedAt: importedAt,
              provenance: createGameProvenance({
                source: "manual",
                method: "pdf-import",
                provider: "kreis-pdf",
                importedBy: context.account.id,
                requestId,
                ingestedAt: importedAt,
              }),
            }));
            await applyTeamStateMutation(requestLogger, "team-import-kreis-pdf", (currentState) => {
              const existing = Array.isArray(currentState?.manualGames) ? currentState.manualGames : [];
              const byId = new Map(existing.map((game) => [String(game?.id || ""), game]));
              for (const game of games) byId.set(String(game.id), game);
              return { ...currentState, manualGames: [...byId.values()] };
            });
            teamKreisPdfPreviews.delete(previewToken);
            if (runtimeDbEnabled) {
              await deleteRuntimeKreisPdfPreview(previewToken, requestLogger);
            }
            return { games };
          },
        );
        sendJson(res, 200, { ok: true, importedCount: games.length, games }, origin, requestId);
        return true;
      }

      sendJson(res, 400, { ok: false, error: "Ungueltiger Modus. Erlaubt: preview, confirm." }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("kreis pdf import failed", { error });
      const statusCode = Number(error?.statusCode || 400);
      sendJson(res, statusCode, { ok: false, error: String(error?.message || "Kreis-PDF-Import fehlgeschlagen.") }, origin, requestId);
      return true;
    }
  }

  const tournamentMatchRoute = req.method === "POST" ? url.pathname.match(/^\/api\/team\/tournaments\/([^/]+)\/matches$/) : null;
  if (tournamentMatchRoute) {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) return true;
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) return true;

    try {
      const tournamentId = normalizeAccountId(decodeURIComponent(String(tournamentMatchRoute[1] || "")));
      const payload = await readBody(req);
      const matchesInput = Array.isArray(payload?.matches) ? payload.matches : payload?.match ? [payload.match] : [];
      if (!tournamentId || matchesInput.length === 0) {
        sendJson(res, 400, { ok: false, error: "Turnier-ID und mindestens ein Match sind erforderlich." }, origin, requestId);
        return true;
      }

      const { mutationResult, nextMatches } = await runTeamWriteIdempotent(
        req,
        context,
        `team-tournament-matches:${tournamentId}`,
        payload,
        async () => {
          const createdAt = nowIso();
          const nextMatches = matchesInput
            .map((match) => ({
              id: `tournament-match-${randomUUID()}`,
              source: "tournament",
              tournamentId,
              home: String(match?.home || "").trim(),
              away: String(match?.away || "").trim(),
              date: String(match?.date || "").trim(),
              time: String(match?.time || "").trim(),
              venue: String(match?.venue || "").trim(),
              status: String(match?.status || "scheduled").trim() === "cancelled" ? "cancelled" : "scheduled",
              note: String(match?.note || "").trim(),
              createdBy: context.account.id,
              createdAt,
              updatedAt: createdAt,
              provenance: createGameProvenance({
                source: "tournament",
                method: "tournament-match-import",
                provider: "team-tournament",
                importedBy: context.account.id,
                requestId,
                ingestedAt: createdAt,
              }),
            }))
            .filter((match) => match.home && match.away);
          if (nextMatches.length === 0) {
            const validationError = new Error("Mindestens ein gueltiges Match ist erforderlich.");
            validationError.statusCode = 400;
            throw validationError;
          }

          const mutationResult = await applyTeamStateMutation(requestLogger, "team-tournament-matches", (currentState) => {
            const tournaments = Array.isArray(currentState?.tournaments) ? currentState.tournaments : [];
            const index = tournaments.findIndex((item) => item?.id === tournamentId);
            if (index < 0) {
              const error = new Error("Turnier wurde nicht gefunden.");
              error.statusCode = 404;
              throw error;
            }
            const nextTournaments = [...tournaments];
            const existingTournament = nextTournaments[index];
            nextTournaments[index] = {
              ...existingTournament,
              matches: [...(Array.isArray(existingTournament?.matches) ? existingTournament.matches : []), ...nextMatches],
              updatedAt: createdAt,
            };
            const manualGames = Array.isArray(currentState?.manualGames) ? currentState.manualGames : [];
            return {
              state: {
                ...currentState,
                tournaments: nextTournaments,
                manualGames: [...nextMatches, ...manualGames],
              },
              tournament: nextTournaments[index],
            };
          });
          return { mutationResult, nextMatches };
        },
      );
      sendJson(res, 200, { ok: true, tournament: mutationResult?.tournament, matches: nextMatches }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("tournament matches failed", { error });
      const statusCode = Number(error?.statusCode || 400);
      sendJson(res, statusCode, { ok: false, error: String(error?.message || "Turnier-Matches konnten nicht gespeichert werden.") }, origin, requestId);
      return true;
    }
  }

  return false;
}
