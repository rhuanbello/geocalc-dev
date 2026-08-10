export type Hemisphere = "north" | "south";

export type SupportedLatitude = number;

export type MonthlyInput = {
  precipitation: number | null;
  temperature: number | null;
};

export type MonthlyInputField = keyof MonthlyInput;

export type FactorSelection = {
  hemisphere: Hemisphere;
  latitude: SupportedLatitude;
};

export type MonthlyWaterBalance = {
  month: number;
  monthName: string;
  shortName: string;
  precipitation: number | null;
  temperature: number | null;
  correctionFactor: number | null;
  monthlyHeatIndex: number | null;
  etp: number | null;
  correctedEtp: number | null;
  balance: number | null;
};

export type WaterBalanceAnnualSummary = {
  precipitationTotal: number | null;
  annualHeatIndex: number | null;
  exponentA: number | null;
  etpTotal: number | null;
  correctedEtpTotal: number | null;
  balanceTotal: number | null;
  maxDeficit: MonthlyWaterBalance | null;
  maxSurplus: MonthlyWaterBalance | null;
};

export type WaterBalanceResult = {
  rows: MonthlyWaterBalance[];
  annual: WaterBalanceAnnualSummary;
  isComplete: boolean;
  errors: string[];
};

export const MONTHS = [
  { month: 1, name: "Janeiro", short: "Jan" },
  { month: 2, name: "Fevereiro", short: "Fev" },
  { month: 3, name: "Março", short: "Mar" },
  { month: 4, name: "Abril", short: "Abr" },
  { month: 5, name: "Maio", short: "Mai" },
  { month: 6, name: "Junho", short: "Jun" },
  { month: 7, name: "Julho", short: "Jul" },
  { month: 8, name: "Agosto", short: "Ago" },
  { month: 9, name: "Setembro", short: "Set" },
  { month: 10, name: "Outubro", short: "Out" },
  { month: 11, name: "Novembro", short: "Nov" },
  { month: 12, name: "Dezembro", short: "Dez" },
] as const;

export const EMPTY_MONTHLY_INPUTS: MonthlyInput[] = MONTHS.map(() => ({
  precipitation: null,
  temperature: null,
}));

export const SUPPORTED_LATITUDES: Record<Hemisphere, SupportedLatitude[]> = {
  north: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
  south: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
};

const baseCorrectionFactors: Record<Hemisphere, Record<number, number[]>> =
  {
    north: {
      10: [0.99, 0.93, 1.02, 1.02, 1.07, 1.05, 1.07, 1.06, 1.01, 1.01, 0.97, 0.98],
      20: [0.94, 0.92, 1.02, 1.04, 1.13, 1.1, 1.13, 1.11, 1.01, 0.99, 0.92, 0.93],
      30: [0.89, 0.89, 1.02, 1.07, 1.17, 1.16, 1.19, 1.13, 1.02, 0.97, 0.88, 0.87],
      40: [0.84, 0.85, 1.02, 1.1, 1.23, 1.24, 1.25, 1.17, 1.03, 0.95, 0.83, 0.8],
      50: [0.73, 0.79, 1.01, 1.14, 1.32, 1.35, 1.36, 1.24, 1.05, 0.91, 0.75, 0.69],
      60: [0.56, 0.65, 1, 1.19, 1.37, 1.56, 1.6, 1.37, 1.07, 0.87, 0.58, 0.5],
    },
    south: {
      10: [1.06, 1, 1.04, 0.98, 1, 0.95, 0.99, 1, 0.99, 1.04, 1.04, 1.1],
      20: [1.13, 1.03, 1.04, 0.96, 0.95, 0.9, 0.94, 0.95, 0.99, 1.06, 1.08, 1.14],
      30: [1.19, 1.05, 1.04, 0.94, 0.91, 0.84, 0.9, 0.95, 0.99, 1.12, 1.13, 1.2],
      // TODO: validar com docente: Outubro / Sul 40 aparece como 0.87 na planilha.
      40: [1.28, 1.08, 1.06, 0.92, 0.86, 0.77, 0.84, 0.91, 0.99, 0.87, 1.19, 1.27],
      50: [1.35, 1.15, 1.06, 0.88, 0.76, 0.67, 0.73, 0.87, 0.98, 1.18, 1.28, 1.39],
    },
  };

const correctionFactors: Record<Hemisphere, Record<number, number[]>> = {
  north: expandCorrectionFactors("north"),
  south: expandCorrectionFactors("south"),
};

function expandCorrectionFactors(hemisphere: Hemisphere): Record<number, number[]> {
  const original = baseCorrectionFactors[hemisphere];
  const expanded: Record<number, number[]> = { 0: Array(12).fill(1) };
  const supported = SUPPORTED_LATITUDES[hemisphere];

  for (const latitude of supported) {
    if (latitude % 10 === 0 && original[latitude]) {
      expanded[latitude] = original[latitude];
      continue;
    }

    const lower = latitude - 5;
    const upper = latitude + 5;
    const lowerFactors = expanded[lower] ?? original[lower];
    const upperFactors = original[upper];
    if (lowerFactors && upperFactors) {
      expanded[latitude] = lowerFactors.map(
        (factor, monthIndex) => (factor + upperFactors[monthIndex]!) / 2,
      );
    }
  }

  return expanded;
}

export function nearestFactorSelection(latitude: number): FactorSelection {
  const hemisphere: Hemisphere = latitude >= 0 ? "north" : "south";
  const absoluteLatitude = Math.abs(latitude);
  const supported = SUPPORTED_LATITUDES[hemisphere];
  const maximum = supported[supported.length - 1] ?? 0;
  const nearest = Math.min(maximum, Math.max(0, Math.round(absoluteLatitude / 5) * 5));

  return { hemisphere, latitude: nearest };
}

export function getCorrectionFactor(
  month: number,
  selection: FactorSelection,
): number | null {
  if (month < 1 || month > 12) {
    return null;
  }

  return correctionFactors[selection.hemisphere][selection.latitude]?.[
    month - 1
  ] ?? null;
}

export function calculateMonthlyHeatIndex(temperature: number): number {
  if (temperature <= 0) {
    return 0;
  }

  return (temperature / 5) ** 1.514;
}

export function calculateThornthwaiteExponent(annualHeatIndex: number): number {
  return (
    675e-9 * annualHeatIndex ** 3 -
    771e-7 * annualHeatIndex ** 2 +
    0.01792 * annualHeatIndex +
    0.49239
  );
}

export function calculateWaterBalance(
  inputs: MonthlyInput[],
  selection: FactorSelection,
): WaterBalanceResult {
  const normalizedInputs = MONTHS.map((_, index) => ({
    precipitation: inputs[index]?.precipitation ?? null,
    temperature: inputs[index]?.temperature ?? null,
  }));

  const errors = collectInputErrors(normalizedInputs);
  const temperaturesAreComplete = normalizedInputs.every(
    (input) => input.temperature !== null,
  );
  const precipitationIsComplete = normalizedInputs.every(
    (input) => input.precipitation !== null,
  );
  const canCalculate = errors.length === 0 && temperaturesAreComplete;

  const monthlyHeatIndexes = normalizedInputs.map((input) =>
    input.temperature === null
      ? null
      : calculateMonthlyHeatIndex(input.temperature),
  );
  const annualHeatIndex = canCalculate
    ? sum(monthlyHeatIndexes.filter(isNumber))
    : null;
  const exponentA =
    annualHeatIndex !== null && annualHeatIndex > 0
      ? calculateThornthwaiteExponent(annualHeatIndex)
      : null;

  const rows: MonthlyWaterBalance[] = MONTHS.map((monthInfo, index) => {
    const input = normalizedInputs[index];
    const correctionFactor = getCorrectionFactor(monthInfo.month, selection);
    const monthlyHeatIndex = monthlyHeatIndexes[index];
    const etp =
      input.temperature !== null &&
      annualHeatIndex !== null &&
      annualHeatIndex > 0 &&
      exponentA !== null
        ? 16 * ((10 * input.temperature) / annualHeatIndex) ** exponentA
        : null;
    const correctedEtp =
      etp !== null && correctionFactor !== null ? etp * correctionFactor : null;
    const balance =
      input.precipitation !== null && correctedEtp !== null
        ? input.precipitation - correctedEtp
        : null;

    return {
      month: monthInfo.month,
      monthName: monthInfo.name,
      shortName: monthInfo.short,
      precipitation: input.precipitation,
      temperature: input.temperature,
      correctionFactor,
      monthlyHeatIndex,
      etp,
      correctedEtp,
      balance,
    };
  });

  const completedRows = rows.filter((row) => row.balance !== null);
  const annual: WaterBalanceAnnualSummary = {
    precipitationTotal: precipitationIsComplete
      ? sum(rows.map((row) => row.precipitation).filter(isNumber))
      : null,
    annualHeatIndex,
    exponentA,
    etpTotal: completedRows.length === 12 ? sum(rows.map((row) => row.etp).filter(isNumber)) : null,
    correctedEtpTotal:
      completedRows.length === 12
        ? sum(rows.map((row) => row.correctedEtp).filter(isNumber))
        : null,
    balanceTotal:
      completedRows.length === 12
        ? sum(rows.map((row) => row.balance).filter(isNumber))
        : null,
    maxDeficit: minBy(completedRows, (row) => row.balance ?? 0),
    maxSurplus: maxBy(completedRows, (row) => row.balance ?? 0),
  };

  return {
    rows,
    annual,
    isComplete: completedRows.length === 12 && errors.length === 0,
    errors,
  };
}

function collectInputErrors(inputs: MonthlyInput[]): string[] {
  const errors: string[] = [];

  inputs.forEach((input, index) => {
    for (const field of ["precipitation", "temperature"] as const) {
      const error = getMonthlyInputError(input, field, index);
      if (error) {
        errors.push(error);
      }
    }
  });

  return errors;
}

export function getMonthlyInputError(
  input: MonthlyInput,
  field: MonthlyInputField,
  monthIndex: number,
): string | null {
  const monthName = MONTHS[monthIndex]?.name ?? "Mês";

  if (field === "precipitation" && input.precipitation !== null && input.precipitation < 0) {
    return `${monthName}: precipitação não pode ser negativa.`;
  }

  if (
    field === "temperature" &&
    input.temperature !== null &&
    (input.temperature < -60 || input.temperature > 70)
  ) {
    return `${monthName}: temperatura fora da faixa esperada (-60 °C a 70 °C).`;
  }

  return null;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function minBy<T>(items: T[], getValue: (item: T) => number): T | null {
  if (!items.length) {
    return null;
  }

  return items.reduce((best, item) =>
    getValue(item) < getValue(best) ? item : best,
  );
}

function maxBy<T>(items: T[], getValue: (item: T) => number): T | null {
  if (!items.length) {
    return null;
  }

  return items.reduce((best, item) =>
    getValue(item) > getValue(best) ? item : best,
  );
}
