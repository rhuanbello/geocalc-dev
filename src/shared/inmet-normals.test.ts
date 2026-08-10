import { describe, expect, test } from "bun:test";
import {
  getInmetNormalsDataset,
  getInmetStationByCode,
  inmetStationLabel,
  inmetStationToMonthlyInputs,
  listInmetStations,
  searchInmetStations,
} from "./inmet-normals";

describe("INMET normals dataset", () => {
  test("exposes only complete 1991-2020 stations", () => {
    const dataset = getInmetNormalsDataset();

    expect(dataset.period).toBe("1991-2020");
    expect(dataset.stationCount).toBe(109);
    expect(listInmetStations()).toHaveLength(109);
    expect(
      listInmetStations().every(
        (station) =>
          station.precipitation.length === 12 &&
          station.temperature.length === 12 &&
          station.precipitation.every(Number.isFinite) &&
          station.temperature.every(Number.isFinite),
      ),
    ).toBe(true);
  });

  test("exposes only complete 1981-2010 stations", () => {
    const dataset = getInmetNormalsDataset("1981-2010");

    expect(dataset.period).toBe("1981-2010");
    expect(dataset.stationCount).toBe(297);
    expect(listInmetStations("1981-2010")).toHaveLength(297);
    expect(
      listInmetStations("1981-2010").every(
        (station) =>
          station.precipitation.length === 12 &&
          station.temperature.length === 12 &&
          station.precipitation.every(Number.isFinite) &&
          station.temperature.every(Number.isFinite),
      ),
    ).toBe(true);
    expect(getInmetStationByCode("82989", "1981-2010")?.name).toBe(
      "ÁGUA BRANCA",
    );
    expect(
      searchInmetStations("agua branca", "1981-2010").some(
        (station) => station.code === "82989",
      ),
    ).toBe(true);
  });

  test("exposes only complete 1961-1990 stations", () => {
    const dataset = getInmetNormalsDataset("1961-1990");

    expect(dataset.period).toBe("1961-1990");
    expect(dataset.stationCount).toBe(280);
    expect(listInmetStations("1961-1990")).toHaveLength(280);
    expect(getInmetStationByCode("82704", "1961-1990")?.name).toBe("Cruzeiro do Sul");
  });

  test("finds stations by code, name and UF", () => {
    expect(getInmetStationByCode("83377")?.name).toBe("BRASILIA");
    expect(searchInmetStations("brasilia").some((station) => station.code === "83377")).toBe(true);
    expect(searchInmetStations("DF").some((station) => station.code === "83377")).toBe(true);
  });

  test("converts a station into water balance monthly inputs", () => {
    const station = getInmetStationByCode("83377");
    if (!station) {
      throw new Error("Station not found");
    }

    expect(inmetStationLabel(station)).toBe("83377 - BRASILIA, DF");
    const inputs = inmetStationToMonthlyInputs(station);
    expect(inputs).toHaveLength(12);
    expect(inputs[0]).toEqual({
      precipitation: 206,
      temperature: 21.9,
    });
  });
});
