# ScoutX Team Role Matrix (Web, Backend-enforced)

Stand: 2026-05-16

Rollen:

- `admin`
- `coordinator`
- `scout`
- `readonly`

Grundregel:

- Lesen: alle Rollen mit gültiger Session
- Schreiben: nur `admin`, `coordinator`, `scout`
- `readonly`: keine Team-Write-Aktionen

## API-Matrix

| Endpoint | admin | coordinator | scout | readonly | Hinweis |
|---|---:|---:|---:|---:|---|
| `GET /api/team/state` | ✅ | ✅ | ✅ | ✅ | Teamzustand lesen |
| `GET /api/team/notifications` | ✅ | ✅ | ✅ | ✅ | Feed/Inbox lesen |
| `POST /api/team/notifications/read` | ✅ | ✅ | ✅ | ❌ | Read-Status ändern |
| `POST /api/team/notifications/push/subscribe` | ✅ | ✅ | ✅ | ❌ | Push/SSE Subscription speichern |
| `GET /api/team/notifications/push/pending` | ✅ | ✅ | ✅ | ✅ | Pending Outbox lesen |
| `GET /api/team/notifications/push/stream` | ✅ | ✅ | ✅ | ✅ | Live-Stream lesen |
| `POST /api/team/notifications/push/ack` | ✅ | ✅ | ✅ | ❌ | Pending Events bestätigen |
| `GET /api/team/conflicts` | ✅ | ✅ | ✅ | ✅ | Konflikte lesen |
| `POST /api/team/plans` | ✅ | ✅ | ✅ | ❌ | Plan publizieren |
| `POST /api/team/manual-games` | ✅ | ✅ | ✅ | ❌ | Inoffizielle/manuelle Spiele |
| `POST /api/team/goals` | ✅ | ✅ | ✅ | ❌ | Teamprioritäten pflegen |
| `POST /api/team/observations/seen` | ✅ | ✅ | ✅ | ❌ | Sichtung abschließen |
| `POST /api/team/observations/report` | ✅ | ✅ | ✅ | ❌ | Bericht verknüpfen |
| `POST /api/team/observations/note` | ✅ | ✅ | ✅ | ❌ | Sichtungsnotiz/Follow-up |
| `POST /api/team/members` | ✅ | ✅ | ❌ | ❌ | Teammitglieder verwalten |
| `POST /api/team/invitations/create` | ✅ | ✅ | ❌ | ❌ | Einladung erstellen |
| `POST /api/team/invitations/accept` | ✅ | ✅ | ✅ | ✅ | Token-basierte Annahme (ohne Session möglich) |
| `POST /api/team/tournaments` | ✅ | ✅ | ✅ | ❌ | Turnier anlegen |
| `POST /api/team/tournaments/:id/matches` | ✅ | ✅ | ✅ | ❌ | Turnierspiele pflegen |
| `POST /api/team/tournaments/import/meinturnierplan` | ✅ | ✅ | ✅ | ❌ | Turnierimport |
| `POST /api/team/import/dfb-national-games` | ✅ | ✅ | ✅ | ❌ | Länderspielimport |
| `POST /api/team/import/kreis-pdf` | ✅ | ✅ | ✅ | ❌ | Kreisauswahl-PDF Import |

## Objektbezogene Zusatzregeln

- Sichtung `seen/report/note`:
  - eigener Scout-Eintrag: `admin`, `coordinator`, `scout`
  - fremder Scout-Eintrag: nur `admin`, `coordinator`
- Teammitglied-Verwaltung:
  - nur `admin` und `coordinator`

## Release-Gate (Rollen)

Für Produktionsfreigabe müssen alle Endpunkte dieser Matrix mit Positiv- und Negativtests abgedeckt sein (insb. `readonly` und cross-scout Schreibversuche).
