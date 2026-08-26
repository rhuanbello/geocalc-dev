import { describe, expect, test } from "bun:test";
import { calculateEups, calculateMonthlyErosivity, calculateTopographicFactor } from "./eups";

const completeRainfall = [208, 168, 260, 225, 208, 272, 45, 26, 42, 36, 42, 26];

describe("EUPS-base", () => {
  test("calculates P, R, LS and PS from the twelve manual monthly values", () => {
    const result = calculateEups({ rainfall: completeRainfall, k: 0.027, slopeLength: 120, slopePercent: 20, cp: 1 });

    expect(result.precipitationTotal).toBe(1558);
    expect(result.rainfallErosivity).toBeCloseTo(8170.944807289601, 10);
    expect(result.topographicFactor).toBeCloseTo(6.888024422845518, 10);
    expect(result.soilLoss).toBeCloseTo(1519.605019539005, 10);
    expect("naturalErosionPotential" in result).toBe(false);
    expect(result.classification).toBe("Alta");
    expect(result.isComplete).toBe(true);
  });

  test("keeps the original eleven-month spreadsheet exercise as an internal regression", () => {
    const exerciseRainfall = [208, 168, 260, 225, 272, 45, 26, 42, 36, 42, 26];
    const total = exerciseRainfall.reduce((sum, value) => sum + value, 0);
    const erosivity = exerciseRainfall.reduce((sum, value) => sum + (calculateMonthlyErosivity(value, total) ?? 0), 0);

    expect(total).toBe(1350);
    expect(erosivity).toBeCloseTo(7946.147214194946, 10);
    expect(calculateTopographicFactor(120, 20)).toBeCloseTo(6.888024422845518, 10);
  });

  test("requires every month and a positive annual precipitation", () => {
    const incomplete = calculateEups({ rainfall: completeRainfall.slice(0, 11), k: 0.027, slopeLength: 120, slopePercent: 20, cp: 1 });
    const dry = calculateEups({ rainfall: Array.from({ length: 12 }, () => 0), k: 0.027, slopeLength: 120, slopePercent: 20, cp: 1 });

    expect(incomplete.isComplete).toBe(false);
    expect(incomplete.errors).toContain("Dezembro: informe a precipitação mensal.");
    expect(dry.isComplete).toBe(false);
    expect(dry.errors).toContain("A precipitação anual deve ser maior que zero.");
  });

  test("rejects invalid manual factors", () => {
    const result = calculateEups({ rainfall: completeRainfall, k: -0.01, slopeLength: 0, slopePercent: -2, cp: 1.2 });

    expect(result.isComplete).toBe(false);
    expect(result.errors).toContain("K não pode ser negativo.");
    expect(result.errors).toContain("L deve ser maior que zero.");
    expect(result.errors).toContain("S não pode ser negativa.");
    expect(result.errors).toContain("CP deve estar entre 0 e 1.");
  });
});
