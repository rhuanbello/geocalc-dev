import { expect, test } from "bun:test";
import {
  calculateGuidedK,
  getEupsKComponentResult,
  getEupsKStep,
  type EupsKSelection,
} from "./eups-erodibility";

const componentOne: EupsKSelection = {
  branch: "SOLOS",
  SiBCS_1: "ARGISSOLO",
  SiBCS_2: "ACINZENTADO",
  SiBCS_3: "Distrófico",
  SiBCS_4: "(NÃO INFORMADO NO DADO)",
  Especial_1: "arenosa",
  Especial_2: "arenosa/média",
  Especial_3: "A moderado",
  Especial_4: "plano",
};

const componentTwo: EupsKSelection = {
  branch: "SOLOS",
  SiBCS_1: "ARGISSOLO",
  SiBCS_2: "ACINZENTADO",
  SiBCS_3: "Distrófico",
  SiBCS_4: "fragipânico",
  Especial_1: "arenosa",
  Especial_2: "arenosa/média",
  Especial_3: "A fraco",
  Especial_4: "plano",
};

const componentThree: EupsKSelection = {
  branch: "SOLOS",
  SiBCS_1: "ARGISSOLO",
  SiBCS_2: "ACINZENTADO",
  SiBCS_3: "Distrófico",
  SiBCS_4: "fragipânico",
  Especial_1: "arenosa",
  Especial_2: "arenosa/média",
  Especial_3: "A moderado",
  Especial_4: "plano",
};

const componentFour: EupsKSelection = {
  branch: "SOLOS",
  SiBCS_1: "ARGISSOLO",
  SiBCS_2: "ACINZENTADO",
  SiBCS_3: "Distrófico",
  SiBCS_4: "fragipânico",
  Especial_1: "média",
  Especial_2: "(NÃO INFORMADO NO DADO)",
  Especial_3: "A fraco e A moderado",
  Especial_4: "plano e suave ondulado",
};

test("expõe filtros dependentes sem listar unidades de solo", () => {
  const firstStep = getEupsKStep(1, {});
  expect(firstStep?.field.label).toBe("Ramo principal");
  expect(firstStep?.options).toEqual(["SOLOS", "UNIDADES NÃO TAXONÔMICAS"]);

  const orderStep = getEupsKStep(1, { branch: "SOLOS" });
  expect(orderStep?.field.id).toBe("SiBCS_1");
  expect(orderStep?.options).toContain("ARGISSOLO");
  expect(orderStep?.options).not.toContain("OUTROS");
});

test("retorna classe e índice de um componente concluído", () => {
  const result = getEupsKComponentResult(1, componentOne);
  expect(result.state).toBe("complete");
  expect(result.erosionClass).toBe("Alta");
  expect(result.index).toBe(4);
});

test("calcula K com a ponderação oficial dos componentes", () => {
  const result = calculateGuidedK(2, [componentOne, componentTwo]);
  expect(result.state).toBe("complete");
  expect(result.weightedIndex).toBeCloseTo(4.4, 10);
  expect(result.k).toBeCloseTo(0.0435, 10);
  expect(result.erosionClass).toBe("Alta");
});

test("aplica as ponderações oficiais para três e quatro componentes", () => {
  const three = calculateGuidedK(3, [componentOne, componentTwo, componentThree]);
  const four = calculateGuidedK(4, [componentOne, componentTwo, componentThree, componentFour]);

  expect(three.weightedIndex).toBeCloseTo(4.5, 10);
  expect(three.k).toBeCloseTo(0.045, 10);
  expect(four.weightedIndex).toBeCloseTo(4.6, 10);
  expect(four.k).toBeCloseTo(0.0465, 10);
});

test("não retorna K enquanto algum componente está incompleto", () => {
  const result = calculateGuidedK(2, [componentOne, { branch: "SOLOS" }]);
  expect(result.state).toBe("pending");
  expect(result.k).toBeNull();
});

test("bloqueia revisão e condição não taxonômica sem transformar o caso em K zero", () => {
  const result = getEupsKComponentResult(1, {
    branch: "UNIDADES NÃO TAXONÔMICAS",
    SiBCS_1: "OUTROS",
    Especial_1: "AFLORAMENTO DE ROCHA",
  });

  expect(result.state).toBe("blocked");
  expect(result.index).toBeNull();
  expect(result.message).toContain("revisão");
});
