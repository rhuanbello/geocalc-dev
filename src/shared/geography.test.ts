import { expect, test } from "bun:test";
import { measureLine } from "./geography";

test("measures a drawn line in meters", () => {
  const distance = measureLine([
    { latitude: -22.9000, longitude: -43.1000 },
    { latitude: -22.9000, longitude: -43.0990 },
  ]);

  expect(distance).not.toBeNull();
  expect(distance).toBeGreaterThan(100);
  expect(distance).toBeLessThan(110);
});
