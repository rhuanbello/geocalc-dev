export type EupsSoilComponent = "C1" | "C2" | "C3" | "C4";
export type EupsSoilPathComponent = EupsSoilComponent | "N/A — UM NÃO TAXONÔMICA";
export type EupsSoilFilterId = "sibcs1" | "sibcs2" | "sibcs3" | "sibcs4" | "special1" | "special2" | "special3" | "special4";
export type EupsSoilSelections = Partial<Record<EupsSoilFilterId, string>>;

type RawPath = {
  id: string;
  component: EupsSoilPathComponent;
  filters: Record<EupsSoilFilterId, string>;
  erosion: { className: string; index: number | null };
  operational: { state: string; returnMode: string; requiresConfirmation: boolean; action: string };
};

export type EupsSoilDataset = {
  components: { soil: EupsSoilComponent[]; nonTaxonomic: string };
  filters: Array<{ id: EupsSoilFilterId; sourceColumn: string; label: string }>;
  paths: RawPath[];
  componentErosionIndexes: Array<{ className: string; index: number }>;
  weights: Array<{ componentCount: number; weights: Record<EupsSoilComponent, number> }>;
  kConversion: Array<{ weightedIndex: number; factorK: number; resultClass: string }>;
};

export type EupsSoilFilterStep = {
  id: EupsSoilFilterId;
  label: string;
  options: string[];
  value: string | null;
};

export type EupsSoilResolution = {
  kind: "pending" | "automatic" | "confirmation" | "blocked" | "not-applicable";
  path: RawPath | null;
  message: string;
  preview?: { className: string; index: number };
};

export type EupsSoilKResult = {
  factorK: number;
  weightedIndex: number;
  resultClass: string;
  contributions: Array<{ component: EupsSoilComponent; className: string; index: number; weight: number; contribution: number }>;
};

const NOT_APPLICABLE = "(NÃO SE APLICA)";

export function getProgressiveSoilFilterSteps(
  dataset: EupsSoilDataset,
  component: EupsSoilPathComponent,
  selections: EupsSoilSelections,
  includeOptionalDetails = false,
): EupsSoilFilterStep[] {
  let candidates = getCandidates(dataset, component, {});
  const steps: EupsSoilFilterStep[] = [];

  for (const field of dataset.filters) {
    const value = selections[field.id] ?? null;
    const options = distinctOptions(candidates.map((path) => path.filters[field.id]));
    const visibleOptions = shouldSkipField(options) ? [] : options;

    if (value) {
      steps.push({ id: field.id, label: field.label, options: visibleOptions, value });
      candidates = candidates.filter((path) => path.filters[field.id] === value);
      if (!includeOptionalDetails && hasUnambiguousOutcome(candidates)) return steps;
      continue;
    }

    if (visibleOptions.length) {
      steps.push({ id: field.id, label: field.label, options: visibleOptions, value: null });
      break;
    }
  }

  return steps;
}

export function resolveSoilComponent(
  dataset: EupsSoilDataset,
  component: EupsSoilPathComponent,
  selections: EupsSoilSelections,
  confirmed: boolean,
): EupsSoilResolution {
  const steps = getProgressiveSoilFilterSteps(dataset, component, selections);
  const incompleteStep = steps.find((step) => step.value === null);
  if (incompleteStep) {
    return { kind: "pending", path: null, message: `Selecione ${incompleteStep.label.toLocaleLowerCase("pt-BR")}.` };
  }

  const candidates = getCandidates(dataset, component, selections);
  if (!candidates.length) {
    return { kind: "blocked", path: null, message: "O caminho selecionado não possui resultado operacional." };
  }

  const path = [...candidates].sort((left, right) => pathPriority(right) - pathPriority(left) || left.id.localeCompare(right.id))[0]!;
  if (path.operational.returnMode === "ENCERRAR SEM K" || path.operational.returnMode === "RAMO NÃO TAXONÔMICO") {
    return { kind: "not-applicable", path, message: `${path.erosion.className} não possui índice de erodibilidade para o cálculo de K.` };
  }
  if (path.operational.returnMode === "BLOQUEADO") {
    return { kind: "blocked", path, message: getReviewMessage(path) };
  }
  if (path.erosion.index === null) {
    return { kind: "not-applicable", path, message: `${path.erosion.className} não possui índice de erodibilidade para o cálculo de K.` };
  }
  if (path.operational.requiresConfirmation && !confirmed) {
    return {
      kind: "confirmation",
      path,
      message: "Confira a correspondência antes de usar este componente no cálculo de K.",
      preview: { className: path.erosion.className, index: path.erosion.index },
    };
  }
  return { kind: "automatic", path, message: "" };
}

export function calculateSoilK(
  dataset: EupsSoilDataset,
  componentCount: number,
  resolutions: Record<EupsSoilComponent, EupsSoilResolution>,
): EupsSoilKResult | null {
  const weightSet = dataset.weights.find((entry) => entry.componentCount === componentCount);
  if (!weightSet) return null;

  const components = dataset.components.soil.slice(0, componentCount);
  const contributions = components.flatMap((component) => {
    const path = resolutions[component].path;
    if (!path || resolutions[component].kind !== "automatic" || path.erosion.index === null) return [];
    const weight = weightSet.weights[component];
    return [{ component, className: path.erosion.className, index: path.erosion.index, weight, contribution: path.erosion.index * weight }];
  });
  if (contributions.length !== componentCount) return null;

  const weightedIndex = roundToTenth(contributions.reduce((sum, entry) => sum + entry.contribution, 0));
  const conversion = dataset.kConversion.find((entry) => entry.weightedIndex === weightedIndex);
  if (!conversion) return null;

  return { factorK: conversion.factorK, weightedIndex, resultClass: conversion.resultClass, contributions };
}

export function clearSelectionsAfter(fieldId: EupsSoilFilterId, selections: EupsSoilSelections, dataset: EupsSoilDataset): EupsSoilSelections {
  const fieldIndex = dataset.filters.findIndex((field) => field.id === fieldId);
  return Object.fromEntries(dataset.filters.slice(0, fieldIndex + 1).flatMap((field) => selections[field.id] ? [[field.id, selections[field.id]]] : [])) as EupsSoilSelections;
}

function getCandidates(dataset: EupsSoilDataset, component: EupsSoilPathComponent, selections: EupsSoilSelections): RawPath[] {
  return dataset.paths.filter((path) => path.component === component && Object.entries(selections).every(([field, value]) => path.filters[field as EupsSoilFilterId] === value));
}

function distinctOptions(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

function shouldSkipField(options: string[]): boolean {
  return options.length === 1 && isSkippableOption(options[0]);
}

function isSkippableOption(option: string): boolean {
  const normalized = option.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
  return option === NOT_APPLICABLE || normalized === "NAO INFORMADO" || normalized === "(NAO INFORMADO NO DADO)";
}

function hasUnambiguousOutcome(candidates: RawPath[]): boolean {
  if (!candidates.length) return false;
  return new Set(candidates.map(outcomeSignature)).size === 1;
}

function outcomeSignature(path: RawPath): string {
  return [
    path.operational.returnMode,
    path.operational.requiresConfirmation,
    path.operational.action,
    path.erosion.className,
    path.erosion.index,
  ].join("|");
}

function pathPriority(path: RawPath): number {
  if (path.operational.returnMode === "BLOQUEADO") return 3;
  if (path.operational.requiresConfirmation) return 2;
  return 1;
}

function getReviewMessage(path: RawPath): string {
  return path.operational.state.includes("EROD AMBÍGUA")
    ? "Há mais de uma classe de erodibilidade possível para esta correspondência."
    : "A correspondência taxonômica exige revisão especializada antes do cálculo de K.";
}

function roundToTenth(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}
