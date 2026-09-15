import { expect, test } from "bun:test";
import { calculateEups } from "$/eups";
import { calculateGuidedK, type EupsKSelection } from "$/eups-erodibility";
import { calculateFcps } from "$/fcps";
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
    soilReferenceLabel: "Valor de K informado manualmente",
    cpReferenceLabel: "Solo exposto, sem práticas",
    kComposition: null,
    fcps: calculateFcps({ soilLoss: result.soilLoss, concentration: null }),
  });

  const sheet = workbook.getWorksheet("EUPS");
  expect(sheet?.getCell("A1").value).toBe("PPG Geoquímica/UFF");
  expect(sheet?.getCell("B4").value).toBe("Cálculo com 12 precipitações mensais e fatores EUPS");
  expect(sheet?.getCell("B8").value).toBe("Valor de K informado manualmente");
  expect(sheet?.getCell("B9").value).toBe(0.027);
  expect(sheet?.getCell("B16").value).toBeCloseTo(result.soilLoss ?? 0, 10);
  expect(sheet?.getCell("C8").value).toBe("Apoio didático da Tabela de referência EUPS");
  expect(sheet?.getCell("A39").value).toContain("Tabela de referência EUPS");
  expect(sheet?.getCell("A39").value).not.toMatch(/Bida/i);
  expect(sheet?.getCell("A4").value).not.toBe("Local");
  expect(sheet?.getCell("A17").value).not.toBe("PNE");
  expect(sheet?.getCell("A42").value).not.toBe("Análise complementar — FCPS");
});

test("inclui FCPS somente quando a análise complementar está completa", () => {
  const result = calculateEups({
    rainfall: [208, 168, 260, 225, 208, 272, 45, 26, 42, 36, 42, 26],
    k: 0.027,
    slopeLength: 120,
    slopePercent: 20,
    cp: 1,
  });
  const fcps = calculateFcps({ soilLoss: 12.48, concentration: 42 });
  const workbook = createEupsWorkbook({
    result,
    k: 0.027,
    slopeLength: 120,
    slopePercent: 20,
    cp: 1,
    soilReferenceLabel: "Valor de K informado manualmente",
    cpReferenceLabel: "Solo exposto, sem práticas",
    kComposition: null,
    fcps,
  });
  const sheet = workbook.getWorksheet("EUPS");

  expect(sheet?.getCell("A42").value).toBe("Análise complementar — FCPS");
  expect(sheet?.getCell("A43").value).toBe("PS");
  expect(sheet?.getCell("C43").value).toBe("t/ha/ano");
  expect(sheet?.getCell("B44").value).toBe(42);
  expect(sheet?.getCell("C44").value).toBe("mg/kg");
  expect(sheet?.getCell("B45").value).toBeCloseTo(0.52416, 10);
  expect(sheet?.getCell("C45").value).toBe("kg/ha/ano");
  expect(sheet?.getCell("B46").value).toBe("QCPS = PS × CCS × 10⁻³");
});

test("registra a composição guiada do K quando disponível", () => {
  const componentOne: EupsKSelection = { branch: "SOLOS", SiBCS_1: "ARGISSOLO", SiBCS_2: "ACINZENTADO", SiBCS_3: "Distrófico", SiBCS_4: "(NÃO INFORMADO NO DADO)", Especial_1: "arenosa", Especial_2: "arenosa/média", Especial_3: "A moderado", Especial_4: "plano" };
  const componentTwo: EupsKSelection = { branch: "SOLOS", SiBCS_1: "ARGISSOLO", SiBCS_2: "ACINZENTADO", SiBCS_3: "Distrófico", SiBCS_4: "fragipânico", Especial_1: "arenosa", Especial_2: "arenosa/média", Especial_3: "A fraco", Especial_4: "plano" };
  const composition = calculateGuidedK(2, [componentOne, componentTwo]);
  const result = calculateEups({ rainfall: [208, 168, 260, 225, 208, 272, 45, 26, 42, 36, 42, 26], k: composition.k, slopeLength: 120, slopePercent: 20, cp: 1 });
  const workbook = createEupsWorkbook({ result, k: composition.k, slopeLength: 120, slopePercent: 20, cp: 1, soilReferenceLabel: "K calculado por 2 componentes da tabela de referência", cpReferenceLabel: "Solo exposto, sem práticas", kComposition: composition, fcps: calculateFcps({ soilLoss: result.soilLoss, concentration: null }) });
  const sheet = workbook.getWorksheet("EUPS");

  expect(sheet?.getCell("A42").value).toBe("Composição do fator K");
  expect(sheet?.getCell("A44").value).toBe("Componente 1");
  expect(sheet?.getCell("B44").value).toBe(0.6);
  expect(sheet?.getCell("C46").value).toBeCloseTo(0.0435, 10);
});
