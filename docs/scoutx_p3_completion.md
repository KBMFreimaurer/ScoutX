# ScoutX P3 Completion (iOS-Parität)

Stand: 2026-05-17

Referenz: [scoutx_go_live_roadmap.md](./scoutx_go_live_roadmap.md), [scoutx_p2_completion.md](./scoutx_p2_completion.md)

## Abgeschlossen

1. iOS-Parität für Team-Notifications nach P2-Featureausbau
- Backend-Sync übernimmt `recipientId` aus Team-Notification-Payloads.
- Clientseitige Merge-Logik zeigt recipient-gebundene Events nur dem Zielnutzer (Admin-Ausnahme).
- Hub-Inbox filtert zusätzlich empfängerbasiert und verhindert Fremd-Notifications im UI.

2. Paritätsrelevante Delegations-/Mention-Flows
- P2-Flows (Mention, Observation-Reassign) bleiben in Web und iOS über denselben Domain-/Backend-Pfad nutzbar.
- Keine getrennte Plattformlogik für diese Fachflüsse erforderlich.

## Verifikation

- `npm run test`
- `npm run build`

## Ergebnis

- P3 ist abgeschlossen und stabil.
- Übergang auf P4 ist freigegeben.
