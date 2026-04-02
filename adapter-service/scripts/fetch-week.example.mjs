/**
 * Example hook for ADAPTER_EXPORT_COMMAND.
 *
 * ENV available:
 * - SCOUTPLAN_FROM_DATE
 * - SCOUTPLAN_TO_DATE
 * - SCOUTPLAN_KREIS_ID
 * - SCOUTPLAN_JUGEND_ID
 * - SCOUTPLAN_IMPORT_DIR
 *
 * This sample only emits JSON to stdout.
 * Replace with real source integration (scraper/api/dfbnet export bridge).
 */

const fromDate = process.env.SCOUTPLAN_FROM_DATE;
const toDate = process.env.SCOUTPLAN_TO_DATE;
const kreisId = process.env.SCOUTPLAN_KREIS_ID || "duesseldorf";
const jugendId = process.env.SCOUTPLAN_JUGEND_ID || "d-jugend";

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
