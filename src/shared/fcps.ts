export type FcpsStatus = "unavailable" | "idle" | "invalid" | "complete";

export type FcpsInput = {
  /** Perda de solo já calculada pela EUPS, em t/ha/ano. */
  soilLoss: number | null;
  /** Concentração manual de contaminante no solo, em mg/kg. */
  concentration: number | null;
  /** Permite distinguir um campo vazio de uma entrada textual inválida. */
  concentrationProvided?: boolean;
};

export type FcpsResult = {
  soilLoss: number | null;
  concentration: number | null;
  quantity: number | null;
  status: FcpsStatus;
  errors: string[];
};

/**
 * Estima a massa potencial de contaminante associada ao solo perdido.
 * Esta análise é posterior à EUPS: ela nunca altera PS ou sua classificação.
 */
export function calculateFcps(input: FcpsInput): FcpsResult {
  const concentrationProvided = input.concentrationProvided ?? input.concentration !== null;

  if (input.soilLoss === null || !Number.isFinite(input.soilLoss) || input.soilLoss < 0) {
    return { ...input, quantity: null, status: "unavailable", errors: [] };
  }

  if (input.concentration === null) {
    return concentrationProvided
      ? { ...input, quantity: null, status: "invalid", errors: ["Informe CCS com um número válido em mg/kg."] }
      : { ...input, quantity: null, status: "idle", errors: [] };
  }

  if (!Number.isFinite(input.concentration) || input.concentration < 0) {
    return { ...input, quantity: null, status: "invalid", errors: ["CCS deve ser maior ou igual a zero."] };
  }

  return {
    ...input,
    quantity: input.soilLoss * input.concentration * 1e-3,
    status: "complete",
    errors: [],
  };
}
