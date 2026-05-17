# ScoutX P8 QA And TestFlight Checklist

Stand: 2026-05-17

## Automated Baseline (Local)

- [x] `npm run lint`
- [x] `npm run test`
- [x] `npm run build`
- [x] `npm run test:e2e:release` (skip ohne DB-URL ist akzeptiert)
- [x] iOS Simulator Build (`build_sim` für Scheme `App`)

## Simulator Manual Smoke

- [ ] Erststart nach Neuinstallation
- [ ] Setup-Flow
- [ ] Spieleauswahl und Planübernahme
- [ ] Team-Feed / Seen-Status
- [ ] Scout Sheet
- [ ] Dashboard
- [ ] Export/Share Sheet
- [ ] Offline-Zustand
- [ ] API-Ausfall-Zustand

## Real Device Smoke

- [ ] Erststart auf physischem iPhone
- [ ] Setup + Login
- [ ] Planungsflow + Feed
- [ ] Share/Export prüfen
- [ ] Crash-freier Durchlauf dokumentiert

## TestFlight

- [ ] Internal Testing gestartet
- [ ] Internal Tester-Feedback dokumentiert
- [ ] External Testing (optional)
- [ ] Bekannte Einschränkungen gegen Metadata/Guidelines gegengeprüft

## Artefakte

- QA-Protokoll: dieses Dokument
- Release-Status: `docs/app_store_release_status.md`
- P8-Abschluss: `docs/scoutx_p8_completion.md`
