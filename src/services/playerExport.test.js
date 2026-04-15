import { describe, expect, it } from "vitest"
import { buildPlayersCsv, buildPlayersJson } from "./playerExport"

describe("buildPlayersCsv", () => {
  it("creates CSV with escaped values and expected headers", () => {
    const csv = buildPlayersCsv([
      {
        id: "p-1",
        name: "Max Mustermann",
        club: "TSV \"Nord\"",
        birthDate: "2011-09-10",
        jerseyNumber: "10",
        dominantFoot: "right",
        position: "LA",
        strengths: "Tempo; Dribbling\nAbschluss",
        createdAt: "2026-04-15T08:00:00.000Z",
        updatedAt: "2026-04-15T08:05:00.000Z",
      },
    ])

    const lines = csv.trimEnd().split("\n")
    expect(lines[0]).toBe("id;name;club;birthDate;jerseyNumber;dominantFoot;position;strengths;createdAt;updatedAt")
    expect(lines[1]).toContain('"TSV ""Nord"""')
    expect(lines[1]).toContain('"Tempo; Dribbling')
  })
})

describe("buildPlayersJson", () => {
  it("normalizes entries and returns pretty JSON", () => {
    const json = buildPlayersJson([
      {
        id: "p-2",
        name: "  Ayoub  ",
        club: "  SF Hamborn 07 ",
        birthDate: "invalid",
        strengths: " Übersicht ",
      },
    ])

    const parsed = JSON.parse(json)
    expect(parsed).toEqual([
      {
        id: "p-2",
        name: "Ayoub",
        club: "SF Hamborn 07",
        birthDate: "",
        jerseyNumber: "",
        dominantFoot: "",
        position: "",
        strengths: "Übersicht",
        createdAt: "",
        updatedAt: "",
      },
    ])
  })
})
