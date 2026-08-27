import { expect, test } from "bun:test";
import { colorForK, featureContainsPoint } from "./eups-spatial-utils";

test("EUPS spatial map keeps K = 0 as the neutral source category", () => {
  expect(colorForK(0)).toBe("#64748b");
  expect(colorForK(0)).not.toBe(colorForK(0.01));
});

test("EUPS spatial map identifies a point inside a FlatGeobuf polygon", () => {
  const feature: GeoJSON.Feature = {
    type: "Feature",
    properties: { k_solos: 0.024 },
    geometry: {
      type: "Polygon",
      coordinates: [[[-50, -15], [-49, -15], [-49, -14], [-50, -14], [-50, -15]]],
    },
  };

  expect(featureContainsPoint(feature, { longitude: -49.5, latitude: -14.5 })).toBe(true);
  expect(featureContainsPoint(feature, { longitude: -48.5, latitude: -14.5 })).toBe(false);
});
