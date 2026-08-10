import { describe, expect, test } from "bun:test";
import {
  buildInmetValidationDataset,
  compareStationWithEra5,
  type InmetMonthlyRecord,
  type InmetStation,
} from "./inmet-validation";

const completeMonthly = Array.from({ length: 12 }, (_, index) => index + 1);

describe("INMET validation helpers", () => {
  test("keeps only stations with complete precipitation, temperature and coordinates", () => {
    const stations: InmetStation[] = [
      station("1", "Completa", -15.8, -47.9),
      station("2", "Sem temperatura", -10, -40),
      station("3", "Sem coordenada", null, -40),
      station("4", "Chuva incompleta", -20, -45),
    ];
    const precipitationRecords: InmetMonthlyRecord[] = [
      monthlyRecord("1", completeMonthly),
      monthlyRecord("2", completeMonthly),
      monthlyRecord("3", completeMonthly),
      monthlyRecord("4", [1, null, ...completeMonthly.slice(2)]),
    ];
    const temperatureRecords: InmetMonthlyRecord[] = [
      monthlyRecord("1", completeMonthly),
      monthlyRecord("3", completeMonthly),
      monthlyRecord("4", completeMonthly),
    ];

    const dataset = buildInmetValidationDataset({
      stations,
      precipitationRecords,
      temperatureRecords,
    });

    expect(dataset.validStations).toHaveLength(1);
    expect(dataset.validStations[0].station.code).toBe("1");
    expect(dataset.excludedStations).toEqual([
      {
        code: "2",
        name: "Sem temperatura",
        uf: "DF",
        reason: "sem registro de temperatura",
      },
      {
        code: "3",
        name: "Sem coordenada",
        uf: "DF",
        reason: "sem coordenada válida",
      },
      {
        code: "4",
        name: "Chuva incompleta",
        uf: "DF",
        reason: "precipitação mensal incompleta",
      },
    ]);
  });

  test("compares INMET and ERA5 with the same water balance calculation", () => {
    const dataset = buildInmetValidationDataset({
      stations: [station("83377", "BRASILIA", -15.78972221, -47.92583332)],
      precipitationRecords: [monthlyRecord("83377", Array(12).fill(100))],
      temperatureRecords: [monthlyRecord("83377", Array(12).fill(22))],
    });
    const comparison = compareStationWithEra5(
      dataset.validStations[0],
      Array.from({ length: 12 }, () => ({
        precipitation: 90,
        temperature: 21,
      })),
    );

    expect(comparison.factorSelection).toEqual({
      hemisphere: "south",
      latitude: 15,
    });
    expect(comparison.inmet.result.isComplete).toBe(true);
    expect(comparison.era5.result.isComplete).toBe(true);
    expect(comparison.metrics.precipitationAnnualDiff).toBe(-120);
    expect(comparison.metrics.precipitationAnnualDiffPercent).toBe(-10);
    expect(comparison.metrics.meanTemperatureDiff).toBe(-1);
    expect(comparison.inmet.annual.surplusTotal).not.toBeNull();
    expect(comparison.inmet.annual.deficitTotal).not.toBeNull();
  });
});

function station(
  code: string,
  name: string,
  latitude: number | null,
  longitude: number | null,
): InmetStation {
  return {
    code,
    name,
    uf: "DF",
    latitude,
    longitude,
    altitude: 1000,
    status: "Operante",
  };
}

function monthlyRecord(
  code: string,
  monthly: Array<number | null>,
): InmetMonthlyRecord {
  return {
    code,
    name: code,
    uf: "DF",
    monthly,
    annual:
      monthly.every((value): value is number => typeof value === "number")
        ? monthly.reduce((total, value) => total + value, 0)
        : null,
  };
}
