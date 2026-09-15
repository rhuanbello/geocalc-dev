import rawIndex from "./data/eups-erodibility-index.json";

export const EUPS_K_FIELDS = [
  { id: "branch", label: "Ramo principal" },
  { id: "SiBCS_1", label: "Ordem" },
  { id: "SiBCS_2", label: "Subordem" },
  { id: "SiBCS_3", label: "Grande grupo" },
  { id: "SiBCS_4", label: "Subgrupo" },
  { id: "Especial_1", label: "Atividade da argila e textura principal" },
  { id: "Especial_2", label: "Arranjo textural" },
  { id: "Especial_3", label: "Cascalhosidade, horizonte A e qualificadores" },
  { id: "Especial_4", label: "Pedregosidade, rochosidade, relevo, material e fases" },
] as const;

export type EupsKFieldId = typeof EUPS_K_FIELDS[number]["id"];
export type EupsKSelection = Partial<Record<EupsKFieldId, string>>;
export type EupsKComponentState = "pending" | "complete" | "blocked" | "not-applicable";

type IndexedRecord = {
  c: number;
  r: "SOLOS" | "UNIDADES NÃO TAXONÔMICAS";
  v: string[];
  s: "automatic" | "blocked" | "not-applicable";
  e: string;
  i: number | null;
  m: string;
};

type Conversion = { i: number; k: number; c: string };
type ErodibilityIndex = { records: IndexedRecord[]; conversion: Conversion[] };

const index = rawIndex as ErodibilityIndex;
const VALUE_FIELDS = EUPS_K_FIELDS.filter((field) => field.id !== "branch");
const NOT_APPLICABLE = "(NÃO SE APLICA)";

export const EUPS_K_COMPONENT_WEIGHTS: Record<1 | 2 | 3 | 4, number[]> = {
  1: [1],
  2: [0.6, 0.4],
  3: [0.5, 0.3, 0.2],
  4: [0.4, 0.2, 0.2, 0.2],
};

export type EupsKStep = {
  field: typeof EUPS_K_FIELDS[number];
  options: string[];
};

export type EupsKComponentResult = {
  component: number;
  state: EupsKComponentState;
  erosionClass: string | null;
  index: number | null;
  message: string | null;
  resolvedPath: Array<{ label: string; value: string }>;
};

export type GuidedKResult = {
  state: "pending" | "complete" | "blocked";
  k: number | null;
  weightedIndex: number | null;
  erosionClass: string | null;
  components: EupsKComponentResult[];
};

export function getEupsKStep(component: number, selection: EupsKSelection): EupsKStep | null {
  const candidates = filterRecords(component, selection);
  if (candidates.length === 0) return null;

  for (const field of EUPS_K_FIELDS) {
    if (selection[field.id]) continue;
    const values = valuesForField(candidates, field.id);
    if (values.length > 1) return { field, options: values };
  }
  return null;
}

export function getEupsKComponentResult(component: number, selection: EupsKSelection): EupsKComponentResult {
  const candidates = filterRecords(component, selection);
  const unresolvedStep = getEupsKStep(component, selection);
  const resolvedPath = resolvePath(candidates, selection);

  if (candidates.length === 0) {
    return { component, state: "blocked", erosionClass: null, index: null, message: "A combinação informada não foi encontrada na tabela de referência.", resolvedPath };
  }
  if (unresolvedStep) {
    return { component, state: "pending", erosionClass: null, index: null, message: null, resolvedPath };
  }

  const automatic = candidates.filter((record) => record.s === "automatic" && record.i !== null);
  const indices = [...new Set(automatic.map((record) => record.i))];
  const erosionClasses = [...new Set(automatic.map((record) => record.e))];
  if (automatic.length === candidates.length && indices.length === 1 && erosionClasses.length === 1) {
    return { component, state: "complete", erosionClass: erosionClasses[0] ?? null, index: indices[0] ?? null, message: null, resolvedPath };
  }

  const nonApplicable = candidates.every((record) => record.s === "not-applicable");
  if (nonApplicable) {
    return {
      component,
      state: "not-applicable",
      erosionClass: null,
      index: null,
      message: "Esta condição não corresponde a uma classe taxonômica de solo; o fator K não se aplica automaticamente.",
      resolvedPath,
    };
  }

  const messages = [...new Set(candidates.filter((record) => record.s === "blocked").map((record) => record.m).filter(Boolean))];
  return {
    component,
    state: "blocked",
    erosionClass: null,
    index: null,
    message: messages[0] ?? "A correspondência exige revisão técnica antes de retornar um índice de erodibilidade.",
    resolvedPath,
  };
}

export function calculateGuidedK(componentCount: 1 | 2 | 3 | 4, selections: EupsKSelection[]): GuidedKResult {
  const components = Array.from({ length: componentCount }, (_, index) => getEupsKComponentResult(index + 1, selections[index] ?? {}));
  if (components.some((component) => component.state === "blocked" || component.state === "not-applicable")) {
    return { state: "blocked", k: null, weightedIndex: null, erosionClass: null, components };
  }
  if (components.some((component) => component.state !== "complete" || component.index === null)) {
    return { state: "pending", k: null, weightedIndex: null, erosionClass: null, components };
  }

  const weightedIndex = components.reduce((total, component, index) => total + (component.index ?? 0) * EUPS_K_COMPONENT_WEIGHTS[componentCount][index]!, 0);
  const conversion = index.conversion.find((entry) => Math.abs(entry.i - weightedIndex) < 1e-9);
  if (!conversion) {
    return { state: "blocked", k: null, weightedIndex, erosionClass: null, components };
  }
  return { state: "complete", k: conversion.k, weightedIndex, erosionClass: conversion.c, components };
}

function filterRecords(component: number, selection: EupsKSelection): IndexedRecord[] {
  return index.records.filter((record) => {
    if (record.c !== component) return false;
    return EUPS_K_FIELDS.every((field) => {
      const selected = selection[field.id];
      if (!selected) return true;
      return valueForField(record, field.id) === selected;
    });
  });
}

function valuesForField(records: IndexedRecord[], field: EupsKFieldId): string[] {
  return [...new Set(records.map((record) => valueForField(record, field)).filter((value) => value && value !== NOT_APPLICABLE))].sort((first, second) => first.localeCompare(second, "pt-BR"));
}

function valueForField(record: IndexedRecord, field: EupsKFieldId, knownPosition?: number): string {
  if (field === "branch") return record.r;
  const position = knownPosition ?? VALUE_FIELDS.findIndex((item) => item.id === field);
  return record.v[position] ?? "";
}

function resolvePath(records: IndexedRecord[], selection: EupsKSelection): Array<{ label: string; value: string }> {
  return EUPS_K_FIELDS.flatMap((field) => {
    const selected = selection[field.id];
    if (selected) return [{ label: field.label, value: selected }];
    const values = valuesForField(records, field.id);
    return values.length === 1 ? [{ label: field.label, value: values[0]! }] : [];
  });
}
