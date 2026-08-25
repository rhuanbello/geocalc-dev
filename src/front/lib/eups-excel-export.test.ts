import { expect, test } from "bun:test";
import { calculateEups } from "$/eups";
import { createEupsWorkbook } from "./eups-excel-export";

test("creates a detailed EUPS workbook", () => {
  const result = calculateEups({
    rainfall: [],
    rainfallMethod: "spatial",
    spatialR: 7946.147214194946,
    k: 0.027,
    slopeLength: 120,
    slopePercent: 20,
    cp: 1,
  });
  const workbook = createEupsWorkbook({
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
    slopeLineLength: 120,
    k: 0.027,
    slopePercent: 20,
    cp: 1,
    rainfallMethod: "spatial",
    spatialR: 7946.147214194946,
  });

  const sheet = workbook.getWorksheet("EUPS");
  const chartSheet = workbook.getWorksheet("Dados para gráfico");
  expect(sheet?.getCell("A1").value).toBe("PPG Geoquímica/UFF");
  expect(sheet?.getCell("A2").value).toBe("GeoCalc - Equação Universal de Perda de Solo (EUPS)");
  expect(sheet?.getCell("B11").value).toBe(0.027);
  expect(sheet?.getCell("B12").value).toBeCloseTo(7946.147214194946, 10);
  expect(sheet?.getCell("B18").value).toBeCloseTo(1477.7979141303176, 10);
  expect(chartSheet?.getCell("A1").value).toBe("Mês");
});
