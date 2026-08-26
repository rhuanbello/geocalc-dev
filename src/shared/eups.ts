export type EupsRainfallInput = number | null;

export type EupsInput = {
  rainfall: EupsRainfallInput[];
  k: number | null;
  slopeLength: number | null;
  slopePercent: number | null;
  cp: number | null;
};

export type EupsMonthlyRow = {
  month: number;
  monthName: string;
  precipitation: number | null;
  erosivityIndex: number | null;
};

export type EupsResult = {
  rows: EupsMonthlyRow[];
  precipitationTotal: number | null;
  rainfallErosivity: number | null;
  topographicFactor: number | null;
  soilLoss: number | null;
  classification: "Baixa" | "Média" | "Alta" | null;
  isComplete: boolean;
  errors: string[];
};

export const EUPS_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export const EMPTY_EUPS_RAINFALL: EupsRainfallInput[] = EUPS_MONTHS.map(() => null);

export function calculateMonthlyErosivity(precipitation: number, precipitationTotal: number): number | null {
  if (precipitation < 0 || precipitationTotal <= 0) return null;
  return 67.355 * ((precipitation ** 2 / precipitationTotal) ** 0.85);
}

export function calculateTopographicFactor(slopeLength: number, slopePercent: number): number | null {
  if (slopeLength <= 0 || slopePercent < 0) return null;
  return 0.00984 * slopeLength ** 0.63 * slopePercent ** 1.18;
}

export function classifySoilLoss(value: number | null): EupsResult["classification"] {
  if (value === null || !Number.isFinite(value)) return null;
  if (value < 10) return "Baixa";
  if (value <= 25) return "Média";
  return "Alta";
}

export function calculateEups(input: EupsInput): EupsResult {
  const rainfall = EUPS_MONTHS.map((_, index) => input.rainfall[index] ?? null);
  const errors = collectErrors(input, rainfall);
  const rainfallIsComplete = rainfall.every((value) => value !== null);
  const precipitationTotal = rainfallIsComplete
    ? rainfall.reduce<number>((total, value) => total + (value ?? 0), 0)
    : null;
  const canEstimateR = precipitationTotal !== null && precipitationTotal > 0;
  const rows = EUPS_MONTHS.map((monthName, index) => ({
    month: index + 1,
    monthName,
    precipitation: rainfall[index],
    erosivityIndex: canEstimateR && rainfall[index] !== null
      ? calculateMonthlyErosivity(rainfall[index], precipitationTotal)
      : null,
  }));
  const rainfallErosivity = canEstimateR
    ? rows.reduce<number>((total, row) => total + (row.erosivityIndex ?? 0), 0)
    : null;
  const topographicFactor = input.slopeLength !== null && input.slopePercent !== null
    ? calculateTopographicFactor(input.slopeLength, input.slopePercent)
    : null;
  const soilLoss = input.k !== null && rainfallErosivity !== null && topographicFactor !== null && input.cp !== null
    ? input.k * rainfallErosivity * topographicFactor
      * input.cp
    : null;

  return {
    rows,
    precipitationTotal,
    rainfallErosivity,
    topographicFactor,
    soilLoss,
    classification: classifySoilLoss(soilLoss),
    isComplete: errors.length === 0 && rainfallErosivity !== null && topographicFactor !== null && soilLoss !== null,
    errors,
  };
}

function collectErrors(input: EupsInput, rainfall: EupsRainfallInput[]): string[] {
  const errors: string[] = [];
  rainfall.forEach((value, index) => {
    if (value === null) errors.push(`${EUPS_MONTHS[index]}: informe a precipitação mensal.`);
    else if (value < 0) errors.push(`${EUPS_MONTHS[index]}: a precipitação não pode ser negativa.`);
  });

  if (rainfall.every((value) => value !== null) && rainfall.every((value) => (value ?? 0) === 0)) {
    errors.push("A precipitação anual deve ser maior que zero.");
  }
  if (input.k === null) errors.push("Informe o fator K.");
  else if (input.k < 0) errors.push("K não pode ser negativo.");
  if (input.slopeLength === null) errors.push("Informe o comprimento da vertente L.");
  else if (input.slopeLength <= 0) errors.push("L deve ser maior que zero.");
  if (input.slopePercent === null) errors.push("Informe a declividade S.");
  else if (input.slopePercent < 0) errors.push("S não pode ser negativa.");
  if (input.cp === null) errors.push("Informe o fator CP.");
  else if (input.cp < 0 || input.cp > 1) errors.push("CP deve estar entre 0 e 1.");
  return errors;
}
