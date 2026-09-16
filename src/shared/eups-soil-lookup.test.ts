import { expect, test } from "bun:test";
import rawDataset from "./data/eups-soil-lookup.json";
import {
  calculateSoilK,
  clearSelectionsAfter,
  getProgressiveSoilFilterSteps,
  resolveSoilComponent,
  type EupsSoilDataset,
  type EupsSoilResolution,
} from "./eups-soil-lookup";

const dataset = rawDataset as EupsSoilDataset;

test("preserva a referência de classes e índices da Tabela_K", () => {
  expect(dataset.componentErosionIndexes).toEqual([
    { className: "Muito baixa", index: 1 },
    { className: "Baixa", index: 2 },
    { className: "Média", index: 3 },
    { className: "Alta", index: 4 },
    { className: "Muito alta", index: 5 },
    { className: "Extremamente alta", index: 6 },
  ]);
});

test("apresenta os filtros SiBCS em sequência e descarta escolhas posteriores", () => {
  const initialSteps = getProgressiveSoilFilterSteps(dataset, "C1", {});
  expect(initialSteps).toHaveLength(1);
  expect(initialSteps[0]).toMatchObject({ id: "sibcs1", label: "Ordem", value: null });

  const selections = { sibcs1: "ARGISSOLO", sibcs2: "ACINZENTADO", sibcs3: "Distrófico" };
  expect(getProgressiveSoilFilterSteps(dataset, "C1", selections).map((step) => step.id)).toEqual([
    "sibcs1",
    "sibcs2",
    "sibcs3",
    "sibcs4",
  ]);
  expect(clearSelectionsAfter("sibcs2", selections, dataset)).toEqual({ sibcs1: "ARGISSOLO", sibcs2: "ACINZENTADO" });
});

test("expõe o detalhamento opcional sem mudar o resultado já definido", () => {
  const baseSelections = { sibcs1: "GLEISSOLO", sibcs2: "SÁLICO" };
  expect(getProgressiveSoilFilterSteps(dataset, "C2", baseSelections).map((step) => step.id)).toEqual([
    "sibcs1",
    "sibcs2",
  ]);

  const detailedSteps = getProgressiveSoilFilterSteps(dataset, "C2", baseSelections, true);
  expect(detailedSteps.at(-1)).toMatchObject({ id: "sibcs3", options: ["Sódico"], value: null });

  const detailedSelections = { ...baseSelections, sibcs3: "Sódico", sibcs4: "típico", special1: "indiscriminada" };
  expect(resolveSoilComponent(dataset, "C2", detailedSelections, false)).toMatchObject({
    kind: "confirmation",
    preview: { className: "Muito alta", index: 5 },
  });
});

test("prioriza revisão manual quando caminhos idênticos têm resultados concorrentes", () => {
  const path = dataset.paths.find((entry) => entry.id === "C1-0003");
  expect(path).toBeTruthy();

  const resolution = resolveSoilComponent(dataset, "C1", path!.filters, false);
  expect(resolution.kind).toBe("blocked");
  expect(resolution.path?.id).toBe("C1-0002");
  expect(resolution.message).not.toContain("Encaminhar para revisão");
});

test("apresenta a prévia antes de confirmar um componente com alerta", () => {
  const path = dataset.paths.find((entry) => entry.id === "C1-0158");
  expect(path).toBeTruthy();

  const pendingConfirmation = resolveSoilComponent(dataset, "C1", path!.filters, false);
  expect(pendingConfirmation).toMatchObject({
    kind: "confirmation",
    preview: { className: "Alta", index: 4 },
  });
  expect(pendingConfirmation.message).not.toContain("Solicitar confirmação");

  expect(resolveSoilComponent(dataset, "C1", path!.filters, true)).toMatchObject({ kind: "automatic" });
});

test("trata ramos não taxonômicos como K não aplicável", () => {
  const path = dataset.paths.find((entry) => entry.id === "NT-0001");
  expect(path).toBeTruthy();

  const resolution = resolveSoilComponent(dataset, path!.component, path!.filters, false);
  expect(resolution).toMatchObject({ kind: "not-applicable" });
  expect(resolution.message).toContain("Afloramento de rocha");
});

test("pondera os índices dos componentes antes de converter para K", () => {
  const low = dataset.paths.find((entry) => entry.id === "C1-0003");
  const high = dataset.paths.find((entry) => entry.id === "C2-0020");
  expect(low?.erosion.index).toBe(1);
  expect(high?.erosion.index).toBe(5);

  const automatic = (path: NonNullable<typeof low>): EupsSoilResolution => ({ kind: "automatic", path, message: "" });
  const pending: EupsSoilResolution = { kind: "pending", path: null, message: "" };
  const result = calculateSoilK(dataset, 2, { C1: automatic(low!), C2: automatic(high!), C3: pending, C4: pending });

  expect(result).toMatchObject({ weightedIndex: 2.6, factorK: 0.0165, resultClass: "Média" });
  expect(result?.contributions.map((entry) => entry.weight)).toEqual([0.6, 0.4]);
});

test("calcula K de uma UM declarada com um componente", () => {
  const path = dataset.paths.find((entry) => entry.id === "C1-0083");
  expect(path).toBeTruthy();

  const automatic = (componentPath: NonNullable<typeof path>): EupsSoilResolution => ({ kind: "automatic", path: componentPath, message: "" });
  const pending: EupsSoilResolution = { kind: "pending", path: null, message: "" };
  const result = calculateSoilK(dataset, 1, { C1: automatic(path!), C2: pending, C3: pending, C4: pending });

  expect(result).toMatchObject({ weightedIndex: 3, factorK: 0.0225, resultClass: "Média" });
  expect(result?.contributions[0]).toMatchObject({ component: "C1", weight: 1, contribution: 3 });
});
