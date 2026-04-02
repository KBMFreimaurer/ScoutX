# Features Research: Football Scouting PDF Tool

**Research Date:** 2026-04-02
**Domain:** Youth football scouting match-day planning with fussball.de data

## Table Stakes (Must Have)

Features users expect from a scouting match-day planner:

### Data Ingestion
- **Real game data from fussball.de** — filtered by district (Kreis), age group (Jugendklasse), and date range. Without real data, the tool has no value. Complexity: High (scraping, normalization, error handling).
- **Team filtering** — show only games involving selected teams. Complexity: Medium (fuzzy matching needed for variant spellings).
- **Date range selection** — at minimum a "this weekend" view. Complexity: Low (existing).

### PDF Export
- **Clean match schedule** — time, home vs away, age group, venue/address per game. This is the core deliverable. Complexity: Medium.
- **Sortable by time** — chronological order so the scout knows what's next. Complexity: Low.
- **Print-friendly layout** — works on A4, readable font sizes, no cut-off tables. Complexity: Medium.
- **Venue/address included** — scouts need to know where to drive. Complexity: Medium (requires scraping venue data from match detail pages).

### Deployment
- **Accessible via browser** — no app install, just a URL. Complexity: Low (existing SPA).
- **Reliable uptime** — server stays up without manual restarts. Complexity: Low (Docker restart policies).

## Differentiators (Competitive Advantage)

Features that set this apart from a manual spreadsheet or WhatsApp group:

- **AI-powered prioritization** — Qwen ranks which games are most worth scouting based on team quality, distance, and focus area. Complexity: High. Dependency: Ollama + working data pipeline. *Deferred to next milestone.*
- **Route optimization** — suggest an efficient driving order between venues. Complexity: High. Dependency: Geocoding + routing API. *Deferred.*
- **Multi-scout coordination** — assign different scouts to different games. Complexity: High. *Out of scope.*
- **Historical tracking** — which games were scouted, which players spotted. Complexity: High. *Out of scope.*
- **Dark theme PDF** — matches the app aesthetic, looks professional. Complexity: Medium.
- **One-click PDF download** — no print dialog, direct `.pdf` file. Complexity: Medium (requires @react-pdf/renderer or similar).

## Anti-Features (Do NOT Build)

- **User accounts / login** — internal tool, no auth needed. Adds complexity without value.
- **Mobile app** — web works on mobile already. Native app is maintenance burden.
- **Real-time notifications** — "new game added" alerts are over-engineering for weekly planning.
- **Social features** — comments, sharing, likes. This is a utility, not a social platform.
- **Complex admin panel** — the setup wizard IS the admin interface.

## Feature Dependencies

```
fussball.de scraper working
    ↓
Adapter returns real games
    ↓
Frontend displays real games
    ↓
PDF export with real data ←── Dark theme styling
    ↓
[Future] AI prioritization ←── Ollama/Qwen on server
```

## Complexity Assessment

| Feature | Complexity | New Code | Risk |
|---------|-----------|----------|------|
| fussball.de scraper validation | High | Low (code exists) | High (untested) |
| Adapter integration | Medium | Low (pipeline exists) | Medium |
| PDF dark theme redesign | Medium | Medium | Low |
| PDF real data integration | Low | Low | Low |
| Docker deployment | Medium | Low (compose exists) | Medium |
| Ollama setup on VPS | Medium | Low | Medium (RAM) |

---
*Features research: 2026-04-02*
