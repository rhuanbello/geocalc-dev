import { describe, expect, test } from "bun:test";
import {
  calculateEups,
  calculateMonthlyErosivity,
  calculateTopographicFactor,
} from "./eups";

const spreadsheetRainfall = [208, 168, 260, 225, null, 272, 45, 26, 42, 36, 42, 26];

describe("EUPS", () => {
  test("reproduces the spreadsheet factors with the original eleven-month fixture", () => {
    const rainfall = spreadsheetRainfall.filter(
      (value): value is number => value !== null,
    );
    const total = rainfall.reduce((sum, value) => sum + value, 0);
    const erosivity = rainfall.reduce(
      (sum, value) => sum + (calculateMonthlyErosivity(value, total) ?? 0),
      0,
    );
    const ls = calculateTopographicFactor(120, 20);

    expect(total).toBe(1350);
    expect(erosivity).toBeCloseTo(7946.147214194946, 10);
    expect(ls).toBeCloseTo(6.888024422845518, 10);
    expect(0.027 * erosivity * (ls ?? 0)).toBeCloseTo(1477.7979141303176, 10);
  });

  test("calculates PNE and PS from a spatial R", () => {
    const result = calculateEups({
      rainfall: [],
      rainfallMethod: "spatial",
      spatialR: 7946.147214194946,
      k: 0.027,
      slopeLength: 120,
      slopePercent: 20,
      cp: 1,
    });

    expect(result.topographicFactor).toBeCloseTo(6.888024422845518, 10);
    expect(result.naturalErosionPotential).toBeCloseTo(1477.7979141303176, 10);
    expect(result.soilLoss).toBeCloseTo(1477.7979141303176, 10);
    expect(result.classification).toBe("Alta");
    expect(result.isComplete).toBe(true);
  });

  test("requires all twelve months for rainfall-based R", () => {
    const result = calculateEups({
      rainfall: spreadsheetRainfall,
      rainfallMethod: "precipitation",
      spatialR: null,
      k: 0.027,
      slopeLength: 120,
      slopePercent: 20,
      cp: 1,
    });

    expect(result.rainfallErosivity).toBeNull();
    expect(result.isComplete).toBe(false);
    expect(result.errors).toContain("Maio: informe a precipitação mensal.");
  });

  test("rejects invalid CP and negative inputs", () => {
    const result = calculateEups({
      rainfall: [],
      rainfallMethod: "spatial",
      spatialR: -1,
      k: -0.01,
      slopeLength: 0,
      slopePercent: -2,
      cp: 1.2,
    });

    expect(result.isComplete).toBe(false);
    expect(result.errors).toHaveLength(5);
  });
});
