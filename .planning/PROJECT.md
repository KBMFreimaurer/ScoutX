# ScoutX

## What This Is

ScoutX (ScoutPlan) ist eine React-SPA für Jugend-Scouting im Fußball (FVN/Niederrhein). Scouts wählen Kreis, Jugendklasse und Teams, die App holt echte Spieldaten von fussball.de und erzeugt einen druckfertigen PDF-Tagesplan. Die App läuft auf einem eigenen Server mit Docker und nutzt perspektivisch Qwen via Ollama für KI-gestützte Spielpriorisierung.

## Core Value

Ein Scout kann mit wenigen Klicks einen echten Tagesplan als PDF bekommen — basierend auf realen Spieldaten aus fussball.de, nicht auf Mock-Daten.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Multi-Step-Wizard (Setup → Games → Plan) — existing
- ✓ Kreis/Jugendklasse/Team-Auswahl mit Niederrhein-Daten — existing
- ✓ CSV/JSON-Upload als Datenquelle — existing
- ✓ Mock-Daten-Generator — existing
- ✓ LLM-Integration (Ollama + OpenAI-kompatibel) — existing
- ✓ Responsive Design (Mobile + Desktop) — existing
- ✓ Dark Theme UI — existing
- ✓ Adapter Service Architektur (Node.js, Port 8787) — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] fussball.de Adapter funktioniert und liefert echte Spieldaten
- [ ] PDF-Export im Dark Theme mit Spielzeit, Teams, Jugendklasse und Spielort
- [ ] Docker-Deployment auf VPS (IP: 152.53.147.185, Port 8090)
- [ ] Ollama + Qwen auf dem Server installiert und erreichbar

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- KI-Analyse/Priorisierung — kommt als nächster Milestone, erstmal echte Daten + PDF
- Multi-Sprachen/i18n — App bleibt auf Deutsch
- OAuth/Login-System — kein Bedarf, interne Nutzung
- Mobile App — Web-first reicht

## Context

- Bestehende Codebase: React 19 + Vite 6 SPA mit Node.js Adapter Service
- fussball.de Scraper existiert als Code (`adapter-service/lib/fussballde.js`, `scripts/fetch-week.fussballde.mjs`), ist aber ungetestet
- PDF-Export existiert als Komponente (`src/components/PDFExport.jsx`), nutzt aber aktuell den KI-Plan-Text — muss auf strukturierte Spieldaten umgestellt werden
- Server ist ein VPS mit Docker, erreichbar unter `http://152.53.147.185:8090/`
- Docker Compose Setup existiert bereits (dev + prod Profile)
- Ziel-LLM: Qwen via Ollama, lokal auf dem Server

## Constraints

- **Deployment**: Docker Compose auf VPS — kein CI/CD, manuelles `docker compose up`
- **Datenquelle**: fussball.de hat kein offizielles API — Scraping muss robust sein
- **LLM**: Qwen via Ollama, Modellgröße begrenzt durch Server-RAM/GPU
- **Sprache**: Alle UI-Texte und Daten auf Deutsch

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Erstmal ohne KI-Analyse | Core-Wert ist echte Daten + PDF, KI kommt danach | — Pending |
| Dark Theme PDF | Konsistent mit App-Design | — Pending |
| Qwen via Ollama auf Server | Lokale Inferenz, keine API-Kosten | — Pending |
| Docker Compose Deployment | Bereits vorbereitet, einfachster Weg | — Pending |

---
*Last updated: 2026-04-02 after initialization*
