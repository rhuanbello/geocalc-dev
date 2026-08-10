import { describe, expect, test } from "bun:test";
import {
  calculateWaterBalance,
  getCorrectionFactor,
  nearestFactorSelection,
  type MonthlyInput,
} from "./water-balance";

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

describe("water balance", () => {
  test("reproduces the spreadsheet regression case for latitude south 30", () => {
    const result = calculateWaterBalance(spreadsheetInputs, {
      hemisphere: "south",
      latitude: 30,
    });

    expect(result.annual.precipitationTotal).toBeCloseTo(1340, 10);
    expect(result.annual.annualHeatIndex).toBeCloseTo(95.9016952707669, 10);
    expect(result.annual.exponentA).toBeCloseTo(2.097213334565898, 10);
    expect(result.annual.etpTotal).toBeCloseTo(891.4762227202638, 10);
    expect(result.annual.correctedEtpTotal).toBeCloseTo(941.8566649579149, 10);
    expect(result.annual.balanceTotal).toBeCloseTo(398.14333504208514, 10);
  });

  test("keeps the spreadsheet correction factors for south 30", () => {
    const factors = Array.from({ length: 12 }, (_, index) =>
      getCorrectionFactor(index + 1, { hemisphere: "south", latitude: 30 }),
    );

    expect(factors).toEqual([
      1.19, 1.05, 1.04, 0.94, 0.91, 0.84, 0.9, 0.95, 0.99, 1.12, 1.13, 1.2,
    ]);
  });

  test("selects the nearest supported latitude by hemisphere", () => {
    expect(nearestFactorSelection(-22.9)).toEqual({
      hemisphere: "south",
      latitude: 25,
    });
    expect(nearestFactorSelection(57.5)).toEqual({
      hemisphere: "north",
      latitude: 60,
    });
    expect(nearestFactorSelection(-22)).toEqual({ hemisphere: "south", latitude: 20 });
    expect(nearestFactorSelection(-23)).toEqual({ hemisphere: "south", latitude: 25 });
    expect(nearestFactorSelection(-28)).toEqual({ hemisphere: "south", latitude: 30 });
  });

  test("interpolates correction factors at five-degree latitudes", () => {
    expect(getCorrectionFactor(1, { hemisphere: "south", latitude: 0 })).toBe(1);
    expect(getCorrectionFactor(1, { hemisphere: "south", latitude: 5 })).toBeCloseTo(1.03, 10);
    expect(getCorrectionFactor(1, { hemisphere: "south", latitude: 15 })).toBeCloseTo(1.095, 10);
  });

  test("blocks invalid negative precipitation", () => {
    const result = calculateWaterBalance(
      [{ precipitation: -1, temperature: 20 }],
      { hemisphere: "south", latitude: 30 },
    );

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.isComplete).toBe(false);
  });
});
