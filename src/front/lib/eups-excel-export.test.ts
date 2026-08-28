import { expect, test } from "bun:test";
import { calculateEups } from "$/eups";
import { createEupsWorkbook } from "./eups-excel-export";

test("creates a manual EUPS workbook without spatial metadata", () => {
  const result = calculateEups({
    rainfall: [208, 168, 260, 225, 208, 272, 45, 26, 42, 36, 42, 26],
    k: 0.027,
    slopeLength: 120,
    slopePercent: 20,
    cp: 1,
  });
  const workbook = createEupsWorkbook({
    result,
    k: 0.027,
    slopeLength: 120,
    slopePercent: 20,
    cp: 1,
    soilReferenceLabel: "Areia quartzosa",
    cpReferenceLabel: "Solo exposto, sem práticas",
  });

  const sheet = workbook.getWorksheet("EUPS");
  expect(sheet?.getCell("A1").value).toBe("PPG Geoquímica/UFF");
  expect(sheet?.getCell("B4").value).toBe("Cálculo manual com 12 precipitações mensais");
  expect(sheet?.getCell("B8").value).toBe("Areia quartzosa");
  expect(sheet?.getCell("B9").value).toBe(0.027);
  expect(sheet?.getCell("B16").value).toBeCloseTo(result.soilLoss ?? 0, 10);
  expect(sheet?.getCell("C8").value).toBe("Apoio didático da Tabela de referência EUPS");
  expect(sheet?.getCell("A39").value).toContain("Tabela de referência EUPS");
  expect(sheet?.getCell("A39").value).not.toMatch(/Bida/i);
  expect(sheet?.getCell("A4").value).not.toBe("Local");
  expect(sheet?.getCell("A17").value).not.toBe("PNE");
});
