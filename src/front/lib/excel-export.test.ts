import { describe, expect, test } from "bun:test";
import { calculateWaterBalance, type MonthlyInput } from "$/water-balance";
import {
  getInmetStationByCode,
  inmetStationToMonthlyInputs,
} from "$/inmet-normals";
import { createWaterBalanceWorkbook } from "./excel-export";

const spreadsheetInputs: MonthlyInput[] = [
  { precipitation: 111, temperature: 24.7 },
  { precipitation: 107, temperature: 24.6 },
  { precipitation: 94, temperature: 23.5 },
  { precipitation: 104, temperature: 20.2 },
  { precipitation: 102, temperature: 17 },
  { precipitation: 137, temperature: 14.5 },
  { precipitation: 121, temperature: 14.1 },
  { precipitation: 122, temperature: 15.4 },
  { precipitation: 135, temperature: 16.6 },
  { precipitation: 117, temperature: 19.2 },
  { precipitation: 93, temperature: 21.4 },
  { precipitation: 97, temperature: 23.3 },
];

describe("Excel export", () => {
  test("creates a detailed workbook with main and chart-data sheets", () => {
    const result = calculateWaterBalance(spreadsheetInputs, {
      hemisphere: "south",
      latitude: 30,
    });
    const workbook = createWaterBalanceWorkbook({
      result,
      location: {
        id: 1,
        name: "Niterói",
        admin1: "Rio de Janeiro",
        country: "Brasil",
        latitude: -22.8832,
        longitude: -43.1034,
        timezone: "America/Sao_Paulo",
      },
      point: { latitude: -22.8832, longitude: -43.1034 },
      startYear: 1991,
      endYear: 2020,
      effectiveEndDate: "2020-12-31",
      sourceState: "open-meteo",
      climateModel: "ERA5",
    });

    const mainSheet = workbook.getWorksheet("Balanço hídrico");
    const chartSheet = workbook.getWorksheet("Dados para gráfico");
    const referencesSheet = workbook.getWorksheet("Referências e fontes");

    expect(mainSheet).toBeDefined();
    expect(chartSheet).toBeDefined();
    expect(referencesSheet).toBeDefined();
    expect(mainSheet?.getCell("A1").value).toBe("PPG Geoquímica/UFF");
    expect(mainSheet?.getCell("A2").value).toBe("GeoCalc - Balanço hídrico");
    expect(mainSheet?.getCell("A3").value).toBe(
      "Base técnica e metodológica preparada para o GeoCalc",
    );
    expect(mainSheet?.getCell("C4").value).toBe(
      "Niterói, Rio de Janeiro, Brasil",
    );
    expect(mainSheet?.getCell("C6").value).toBe("1991-2020");
    expect(mainSheet?.getCell("C7").value).toBe("31/12/2020");
    expect(mainSheet?.getCell("A9").value).toBe("Modelo");
    expect(mainSheet?.getCell("C9").value).toBe("ERA5");
    expect(mainSheet?.getCell("A10").value).toBe("Data de geração");
    expect(mainSheet?.getCell("A18").value).toBe("Mês");
    expect(mainSheet?.getCell("A19").value).toBe("Janeiro");
    expect(mainSheet?.getCell("B19").value).toBe(111);
    expect(mainSheet?.getCell("G19").value as number).toBeCloseTo(138.5, 1);
    expect(mainSheet?.getCell("H18").value).toBe("SH");
    expect(mainSheet?.getCell("I18").value).toBe("DH");
    expect(mainSheet?.getCell("I19").value as number).toBeCloseTo(-27.5, 1);
    expect(mainSheet?.getCell("A33").value).toBe("Legenda, metodologia e interpretação");
    expect(mainSheet?.getCell("A34").value).toBe("P");
    expect(mainSheet?.getCell("B34").value).toContain("Precipitação mensal");
    expect(mainSheet?.getCell("B45").value).toContain("ERA5");

    expect(chartSheet?.getCell("A1").value).toBe("Mês");
    expect(chartSheet?.getCell("B1").value).toBe("P (mm)");
    expect(chartSheet?.getCell("A13").value).toBe("Dezembro");
    expect(referencesSheet?.getCell("A1").value).toBe("Fonte");
    expect(referencesSheet?.getCell("A2").value).toBe("Thornthwaite, 1948");
    expect(JSON.stringify(referencesSheet?.model)).toContain(
      "https://doi.org/10.2307/210739",
    );
    expect(JSON.stringify(referencesSheet?.model)).not.toContain("jstor.org");
    expect(referencesSheet?.getCell("A3").value).toBe(
      "Open-Meteo Historical Weather API",
    );
    expect(referencesSheet?.getCell("A4").value).toBe(
      "INMET Normais Climatológicas do Brasil",
    );
    expect(referencesSheet?.getCell("A7").value).toBe("Nominatim");
    expect(JSON.stringify(workbook.model)).not.toContain("Edison");
    expect(JSON.stringify(workbook.model)).not.toContain("apostila");
  });

  test("exports INMET source without Open-Meteo metadata", () => {
    const station = getInmetStationByCode("83377");
    if (!station) {
      throw new Error("Station not found");
    }

    const result = calculateWaterBalance(inmetStationToMonthlyInputs(station), {
      hemisphere: "south",
      latitude: 20,
    });
    const workbook = createWaterBalanceWorkbook({
      result,
      location: {
        id: Number(station.code),
        name: station.name,
        admin1: station.uf,
        country: "Brasil",
        latitude: station.latitude,
        longitude: station.longitude,
        timezone: "auto",
      },
      point: { latitude: station.latitude, longitude: station.longitude },
      startYear: 1991,
      endYear: 2020,
      effectiveEndDate: "2020-12-31",
      sourceState: "inmet",
      selectedInmetStation: station,
      climateModel: "ERA5",
    });

    const mainSheet = workbook.getWorksheet("Balanço hídrico");
    expect(mainSheet?.getCell("C8").value).toBe(
      "INMET Normais Climatológicas do Brasil",
    );
    expect(mainSheet?.getCell("A9").value).toBe("Estação INMET");
    expect(mainSheet?.getCell("C9").value).toBe("83377 - BRASILIA, DF");
    expect(mainSheet?.getCell("A45").value).toBe("INMET");
    expect(mainSheet?.getCell("B45").value).toContain("Normais Climatológicas");
    expect(mainSheet?.getCell("B45").value).not.toContain("série diária");
  });

  test("identifies the selected INMET normal period in the export", () => {
    const station = getInmetStationByCode("82989", "1981-2010");
    if (!station) {
      throw new Error("Station not found");
    }

    const result = calculateWaterBalance(inmetStationToMonthlyInputs(station), {
      hemisphere: "south",
      latitude: 10,
    });
    const workbook = createWaterBalanceWorkbook({
      result,
      location: null,
      point: { latitude: station.latitude, longitude: station.longitude },
      startYear: 1981,
      endYear: 2010,
      effectiveEndDate: "2010-12-31",
      sourceState: "inmet",
      selectedInmetStation: station,
      inmetPeriod: "1981-2010",
    });

    const mainSheet = workbook.getWorksheet("Balanço hídrico");
    expect(mainSheet?.getCell("C6").value).toBe("1981-2010");
    expect(mainSheet?.getCell("B45").value).toContain("1981-2010");
  });
});
