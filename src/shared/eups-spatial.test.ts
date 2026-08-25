import { expect, test } from "bun:test";
import { isSpatialFactorsResponse } from "./eups-spatial";

test("accepts a spatial-factor response with an explicit K review requirement", () => {
  expect(isSpatialFactorsResponse({
    coordinate: { latitude: -22.9, longitude: -43.1 },
    queriedAt: "2026-08-23T00:00:00.000Z",
    rainfallErosivity: { value: 8421, unit: "MJ·mm·ha⁻¹·h⁻¹·ano⁻¹", source: "Embrapa", scale: "nacional", status: "available" },
    soilErodibility: { value: 0.027, unit: "t·h·MJ⁻¹·mm⁻¹", source: "Embrapa", scale: "1:500.000", status: "available", requiresReview: true },
    slope: { value: 14.7, unit: "%", source: "TOPODATA/INPE", scale: "30 m", status: "available" },
  })).toBe(true);
});

test("rejects an incomplete spatial response", () => {
  expect(isSpatialFactorsResponse({ coordinate: { latitude: 0, longitude: 0 } })).toBe(false);
});
