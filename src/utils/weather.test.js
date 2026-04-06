import { describe, expect, it, vi } from "vitest";
import { fetchWeatherForGame } from "./weather";

describe("weather utils", () => {
  it("holt Wetterdaten von Open-Meteo und mappt Felder", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hourly: {
          time: ["2026-04-11T14:00"],
          temperature_2m: [13.4],
          precipitation_probability: [25],
          weather_code: [61],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const weather = await fetchWeatherForGame({
      lat: 51.5,
      lon: 6.8,
      date: "2026-04-11",
      time: "14:00",
    });

    expect(weather).toEqual({
      temperatureC: 13.4,
      precipitationProbability: 25,
      weatherCode: 61,
      type: "rain",
    });
  });
});
