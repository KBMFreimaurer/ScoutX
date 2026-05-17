/**
 * Example hook for ADAPTER_EXPORT_COMMAND.
 *
 * ENV available:
 * - SCOUTX_FROM_DATE
 * - SCOUTX_TO_DATE
 * - SCOUTX_KREIS_ID
 * - SCOUTX_JUGEND_ID
 * - SCOUTX_IMPORT_DIR
 *
 * This sample only emits JSON to stdout.
 * Replace with real source integration (scraper/api/dfbnet export bridge).
 */

const fromDate = process.env.SCOUTX_FROM_DATE;
const toDate = process.env.SCOUTX_TO_DATE;
const kreisId = process.env.SCOUTX_KREIS_ID || "duesseldorf";
const jugendId = process.env.SCOUTX_JUGEND_ID || "d-jugend";

const games = [
  {
    date: fromDate,
    time: "10:00",
    home: "Fortuna Düsseldorf (U)",
    away: "SC Unterbach",
    venue: "Paul-Janes-Stadion Flehe",
    km: 8,
    kreisId,
    jugendId,
  },
  {
    date: toDate,
    time: "12:00",
    home: "SV Hilden-Nord",
    away: "FC Büderich",
    venue: "Sportanlage Höherweg",
    km: 14,
    kreisId,
    jugendId,
  },
];

process.stdout.write(`${JSON.stringify({ games })}\n`);
