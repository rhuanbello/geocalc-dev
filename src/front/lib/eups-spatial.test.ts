import { expect, test } from "bun:test";
import { topodataPixelWindow } from "./eups-spatial";

test("locates the TOPODATA pixel for a coordinate", () => {
  expect(topodataPixelWindow({
    longitude: -43.1,
    latitude: -22.9,
    boundingBox: [-45, -25, -40, -20],
    width: 100,
    height: 100,
  })).toEqual([37, 57, 38, 58]);
});

test("rejects a coordinate outside the returned TOPODATA block", () => {
  expect(() => topodataPixelWindow({
    longitude: -39,
    latitude: -22.9,
    boundingBox: [-45, -25, -40, -20],
    width: 100,
    height: 100,
  })).toThrow("fora do bloco TOPODATA");
});
