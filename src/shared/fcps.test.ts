import { expect, test } from "bun:test";
import { calculateFcps } from "./fcps";

test("calcula QCPS a partir de PS e CCS", () => {
  const result = calculateFcps({ soilLoss: 12.48, concentration: 42 });

  expect(result.status).toBe("complete");
  expect(result.quantity).toBeCloseTo(0.52416, 10);
});

test("aceita CCS igual a zero", () => {
  const result = calculateFcps({ soilLoss: 12.48, concentration: 0 });

  expect(result.status).toBe("complete");
  expect(result.quantity).toBe(0);
});

test("permanece ociosa sem CCS e indisponível sem PS", () => {
  expect(calculateFcps({ soilLoss: 12.48, concentration: null }).status).toBe("idle");
  expect(calculateFcps({ soilLoss: null, concentration: 42 }).status).toBe("unavailable");
});

test("reporta somente erros locais de CCS inválida", () => {
  const negative = calculateFcps({ soilLoss: 12.48, concentration: -1 });
  const text = calculateFcps({ soilLoss: 12.48, concentration: null, concentrationProvided: true });

  expect(negative.status).toBe("invalid");
  expect(negative.errors).toEqual(["CCS deve ser maior ou igual a zero."]);
  expect(text.status).toBe("invalid");
  expect(text.errors[0]).toMatch(/número válido/);
});
