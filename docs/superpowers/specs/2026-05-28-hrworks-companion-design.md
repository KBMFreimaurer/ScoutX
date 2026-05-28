# HRworks Companion Design

**Datum:** 2026-05-28

## Ziel

ScoutX soll die HRworks-Automation nicht länger als browserabhängigen Sonderfall behandeln. Stattdessen läuft echte Desktop-Automation über einen lokalen `ScoutX Companion`, während die Web-App nur noch Jobs vorbereitet, Status anzeigt und den Benutzer durch den Login führt.

## Produktentscheidungen

- Desktop zuerst, mit Fokus auf macOS und Windows.
- HRworks-Login bleibt nutzergeführt; ScoutX speichert keine HRworks-Zugangsdaten dauerhaft.
- Browser-only bleibt ein schwächerer Fallback und ist nicht der primäre Automationspfad.
- Die bestehende HRworks-Bridge wird kurzfristig nicht ersetzt, sondern in einen generischeren Companion-Vertrag überführt.

## Companion-Vertrag

Der lokale Companion spricht über HTTP auf `127.0.0.1:8791` und meldet Capabilities statt einzelner Produkt-Hacks.

- `GET /health`
  Liefert Companion-Metadaten und die verfügbaren Capabilities.
- `GET /api/companion/capabilities/hrworks-import`
  Beschreibt die HRworks-Import-Capability.
- `POST /api/companion/capabilities/hrworks-import/open-login`
  Öffnet den HRworks-Login im kontrollierten Browser-Kontext.
- `POST /api/companion/capabilities/hrworks-import/run`
  Führt den vorbereiteten HRworks-Import aus.

Bestehende Legacy-Routen wie `/api/hrworks/open-login` und `/api/hrworks/import` bleiben als Kompatibilitätsalias bestehen.

## Frontend-Richtung

- Die Web-App spricht mit einem generischen `scoutXCompanionClient`.
- `hrworksAutomationClient` bleibt als kompatible Fassade für den bestehenden Plan-Flow erhalten.
- Die UI kommuniziert `ScoutX Companion` explizit als primären Desktop-Automationspfad.
- Wenn derselbe Browser nicht attachbar ist, wird transparent auf ein kontrolliertes Companion-Fenster umgestellt.

## Warum das die richtige nächste Stufe ist

- Der Companion-Vertrag entkoppelt ScoutX von einer konkreten Browser-App.
- macOS- und Windows-Support werden dadurch realistischer, weil die Web-App nur noch mit einer lokalen Capability spricht.
- Mobile kann später einen eigenen Fallback oder einen App-nativen Companion erhalten, ohne den HRworks-Flow in der Web-App neu zu erfinden.
- Die vorhandene Playwright-Automation bleibt nutzbar, wird aber architektonisch an die richtige Stelle verschoben.
