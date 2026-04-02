# Requirements: ScoutX

**Defined:** 2026-04-02
**Core Value:** Ein Scout bekommt mit wenigen Klicks einen echten Tagesplan als PDF — basierend auf realen Spieldaten aus fussball.de.

## v1 Requirements

### Daten-Pipeline

- [ ] **DATA-01**: Adapter liefert echte Spieldaten von fussball.de für eine gewählte Kalenderwoche
- [ ] **DATA-02**: Spieldaten enthalten Spielzeit, Heim-/Gastmannschaft, Jugendklasse und Spielort/Adresse
- [ ] **DATA-03**: Spiele werden nach Kreis, Jugendklasse und Datumsbereich gefiltert
- [ ] **DATA-04**: Team-Filterung zeigt nur Spiele der ausgewählten Mannschaften (fuzzy matching mit fussball.de Namensvarianten)
- [ ] **DATA-05**: Scraper-Concurrency ist auf produktionstaugliche Werte reduziert (max 3 parallel)

### PDF-Export

- [ ] **PDF-01**: PDF wird im Dark Theme generiert (dunkler Hintergrund, BMG-Grün als Akzent, helle Schrift)
- [ ] **PDF-02**: PDF zeigt pro Spiel: Uhrzeit, Heim vs. Gast, Jugendklasse, Spielort/Adresse
- [ ] **PDF-03**: Spiele sind chronologisch sortiert
- [ ] **PDF-04**: PDF öffnet sich in einem neuen Tab zur Vorschau und kann von dort heruntergeladen werden
- [ ] **PDF-05**: PDF ist A4-druckfertig mit lesbaren Schriftgrößen

### Deployment

- [ ] **DEPL-01**: App läuft via Docker Compose auf dem VPS (Frontend + Adapter + Ollama)
- [ ] **DEPL-02**: Qwen-Modell ist via Ollama auf dem Server installiert und erreichbar
- [ ] **DEPL-03**: ADAPTER_TOKEN ist gesetzt und schützt den Adapter-Endpunkt
- [ ] **DEPL-04**: CORS ist auf die Frontend-Origin eingeschränkt
- [ ] **DEPL-05**: Nicht benötigte Ports sind nicht öffentlich erreichbar

## v2 Requirements

### KI-Analyse

- **AI-01**: Qwen priorisiert Spiele nach Relevanz (Teamqualität, Entfernung, Scout-Fokus)
- **AI-02**: KI generiert einen strukturierten Scout-Plan mit Top-5 Spielen
- **AI-03**: Routenoptimierung zwischen Spielorten

### Erweiterte Daten

- **EDATA-01**: Historische Spieldaten über mehrere Wochen abrufbar
- **EDATA-02**: Team-Aliases werden automatisch aus Scraper-Daten gelernt

## Out of Scope

| Feature | Reason |
|---------|--------|
| User Accounts / Login | Internes Tool, kein Auth nötig |
| Mobile App | Web funktioniert auf Mobile, Native wäre Wartungsaufwand |
| Echtzeit-Benachrichtigungen | Wöchentliche Planung, kein Push nötig |
| Multi-Scout-Koordination | Zu komplex für v1, kein validierter Bedarf |
| i18n / Mehrsprachigkeit | App bleibt auf Deutsch |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |
| DATA-04 | — | Pending |
| DATA-05 | — | Pending |
| PDF-01 | — | Pending |
| PDF-02 | — | Pending |
| PDF-03 | — | Pending |
| PDF-04 | — | Pending |
| PDF-05 | — | Pending |
| DEPL-01 | — | Pending |
| DEPL-02 | — | Pending |
| DEPL-03 | — | Pending |
| DEPL-04 | — | Pending |
| DEPL-05 | — | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after initial definition*
