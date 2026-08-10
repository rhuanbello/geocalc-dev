import ExcelJS from "exceljs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  aggregateDailyClimateToMonthlyNormals,
  type DailyClimateSeries,
} from "../src/shared/climate";
import {
  buildInmetValidationDataset,
  compareStationWithEra5,
  toMonthlyInputs,
  type InmetMonthlyRecord,
  type InmetStation,
  type InmetValidStation,
  type StationValidationComparison,
} from "../src/shared/inmet-validation";
import {
  calculateWaterBalance,
  MONTHS,
  nearestFactorSelection,
  type MonthlyInput,
} from "../src/shared/water-balance";

const PERIOD = "1991-2020";
const START_DATE = "1991-01-01";
const END_DATE = "2020-12-31";
const ROOT_DIR = process.cwd();
const INMET_DIR = path.join(
  ROOT_DIR,
  "docs/semana 02/Dados INMET/1991 - 2020",
);
const GENERATED_DIR = path.join(ROOT_DIR, "docs/gerados");
const MODEL_CONFIGS = {
  era5: {
    apiValue: "era5",
    label: "ERA5",
    slug: "era5",
  },
  era5_land: {
    apiValue: "era5_land",
    label: "ERA5-Land",
    slug: "era5-land",
  },
} as const;
const SELECTED_MODEL = parseModelArg();
const MODEL = SELECTED_MODEL.apiValue;
const MODEL_LABEL = SELECTED_MODEL.label;
const MODEL_SLUG = SELECTED_MODEL.slug;
const WORST_FROM_MODEL = parseWorstFromModelArg();
const SAMPLE_LIMIT = parseLimitArg();
const USE_WINDOWED_FETCH = true;
const BATCH_SIZE = 1;
const DOWNLOAD_DELAY_MS = 8000;
const MAX_FETCH_ATTEMPTS = 6;
const DATE_WINDOWS = [
  { start: "1991-01-01", end: "1995-12-31" },
  { start: "1996-01-01", end: "2000-12-31" },
  { start: "2001-01-01", end: "2005-12-31" },
  { start: "2006-01-01", end: "2010-12-31" },
  { start: "2011-01-01", end: "2015-12-31" },
  { start: "2016-01-01", end: "2020-12-31" },
];
const CACHE_DIR = path.join(
  GENERATED_DIR,
  `cache/open-meteo-${MODEL_SLUG}-${PERIOD}`,
);
const OUTPUT_FILE = path.join(
  GENERATED_DIR,
  `validacao-inmet-openmeteo-${MODEL_SLUG}-${PERIOD}.xlsx`,
);
const PARTIAL_MODE = process.argv.includes("--partial");

type Era5CacheEntry = {
  code: string;
  model: string;
  period: string;
  latitude: number;
  longitude: number;
  inputs: MonthlyInput[];
  yearsWithData: number[];
  generatedAt: string;
};

type Era5Failure = {
  code: string;
  name: string;
  uf: string;
  reason: string;
};

const colors = {
  dark: "1A3B29",
  green: "009B6E",
  lightGreen: "E7F6EF",
  blue: "6EC1E4",
  lightBlue: "EAF7FC",
  muted: "54595F",
  border: "B9C8BF",
  danger: "FDECEC",
};

function parseModelArg(): (typeof MODEL_CONFIGS)[keyof typeof MODEL_CONFIGS] {
  const rawArg = process.argv
    .find((arg) => arg.startsWith("--model="))
    ?.split("=")[1];

  if (!rawArg) {
    return MODEL_CONFIGS.era5;
  }

  const normalized = rawArg.replace(/-/g, "_");
  if (normalized === "era5" || normalized === "era5_land") {
    return MODEL_CONFIGS[normalized];
  }

  throw new Error(
    `Modelo inválido: ${rawArg}. Use --model=era5 ou --model=era5_land.`,
  );
}

function parseWorstFromModelArg():
  | (typeof MODEL_CONFIGS)[keyof typeof MODEL_CONFIGS]
  | null {
  const rawArg = process.argv
    .find((arg) => arg.startsWith("--worst-from="))
    ?.split("=")[1];

  if (!rawArg) {
    return null;
  }

  const normalized = rawArg.replace(/-/g, "_");
  if (normalized === "era5" || normalized === "era5_land") {
    return MODEL_CONFIGS[normalized];
  }

  throw new Error(
    `Modelo inválido em --worst-from: ${rawArg}. Use era5 ou era5_land.`,
  );
}

function parseLimitArg(): number | null {
  const rawArg = process.argv
    .find((arg) => arg.startsWith("--limit="))
    ?.split("=")[1];

  if (!rawArg) {
    return WORST_FROM_MODEL ? 12 : null;
  }

  const value = Number(rawArg);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Limite inválido: ${rawArg}. Use um inteiro maior que zero.`);
  }

  return value;
}

async function main() {
  if (MODEL === "era5_land") {
    throw new Error(
      "ERA5-Land não fornece precipitação nem chuva nesta rota do Open-Meteo; a comparação de BH foi suspensa até uma fonte alternativa ser configurada.",
    );
  }
  await mkdir(CACHE_DIR, { recursive: true });
  const dataset = await readInmetDataset();
  const validStations = WORST_FROM_MODEL
    ? await selectWorstStationsFromReference(dataset.validStations, WORST_FROM_MODEL)
    : dataset.validStations;
  const comparisons: StationValidationComparison[] = [];

  console.log(
    `INMET ${PERIOD}: ${dataset.validStations.length} estações válidas, ${dataset.excludedStations.length} excluídas.`,
  );
  if (WORST_FROM_MODEL) {
    console.log(
      `Amostra crítica: ${validStations.length} estações com maiores divergências no ${WORST_FROM_MODEL.label}.`,
    );
  }

  const era5Collection = PARTIAL_MODE
    ? await readCachedEra5InputsByStation(validStations)
    : await fetchEra5InputsByStation(validStations);

  for (const station of validStations) {
    const era5Inputs = era5Collection.inputsByCode.get(station.station.code);
    if (era5Inputs) {
      comparisons.push(compareStationWithEra5(station, era5Inputs));
    }
  }

  const comparedCodes = new Set(comparisons.map((comparison) => comparison.code));
  const pendingEra5 = validStations
    .filter((station) => !comparedCodes.has(station.station.code))
    .map((station) => ({
      code: station.station.code,
      name: station.station.name,
      uf: station.station.uf,
      reason: PARTIAL_MODE
        ? `${MODEL_LABEL} pendente: estação ainda não existe no cache local.`
        : `${MODEL_LABEL} pendente: consulta não concluída.`,
    }));

  const workbook = buildWorkbook({
    comparisons,
    validStations,
    excludedStations: dataset.excludedStations,
    era5Failures: [...era5Collection.failures, ...pendingEra5],
    totals: dataset.totals,
  });
  await workbook.xlsx.writeFile(OUTPUT_FILE);
  console.log(`Planilha gerada em ${OUTPUT_FILE}`);
}

async function selectWorstStationsFromReference(
  stations: InmetValidStation[],
  referenceModel: (typeof MODEL_CONFIGS)[keyof typeof MODEL_CONFIGS],
): Promise<InmetValidStation[]> {
  const comparisons: StationValidationComparison[] = [];

  for (const station of stations) {
    const cached = await readModelCache(station, referenceModel);
    if (cached) {
      comparisons.push(compareStationWithEra5(station, cached.inputs));
    }
  }

  if (!comparisons.length) {
    throw new Error(
      `Nenhuma estação em cache para montar amostra crítica a partir de ${referenceModel.label}. Rode primeiro a validação desse modelo.`,
    );
  }

  const limit = SAMPLE_LIMIT ?? comparisons.length;
  const selectedCodes = new Set<string>();
  const addRanked = (
    getValue: (item: StationValidationComparison) => number | null,
    maxItems = limit,
  ) => {
    let added = 0;
    for (const entry of comparisons
      .map((item) => ({ item, value: getValue(item) }))
      .filter((entry): entry is { item: StationValidationComparison; value: number } =>
        isNumber(entry.value),
      )
      .sort((a, b) => b.value - a.value)) {
      if (selectedCodes.size >= limit || added >= maxItems) {
        break;
      }

      if (!selectedCodes.has(entry.item.code)) {
        selectedCodes.add(entry.item.code);
        added += 1;
      }
    }
  };

  const perMetricLimit = Math.max(1, Math.ceil(limit / 3));
  addRanked((item) => absolute(item.metrics.balanceAnnualDiff), perMetricLimit);
  addRanked((item) => absolute(item.metrics.precipitationAnnualDiff), perMetricLimit);
  addRanked((item) => item.metrics.balanceClassDisagreements, perMetricLimit);
  addRanked((item) => absolute(item.metrics.balanceAnnualDiff), limit);

  const stationByCode = new Map(stations.map((station) => [station.station.code, station]));
  return [...selectedCodes]
    .map((code) => stationByCode.get(code))
    .filter((station): station is InmetValidStation => Boolean(station));
}

async function readInmetDataset() {
  const [stations, precipitationRecords, temperatureRecords] = await Promise.all([
    readStations("Normal-Climatologica-ESTAÇÕES.xlsx"),
    readMonthlyRecords("Normal-Climatologica-PREC.xlsx"),
    readMonthlyRecords("Normal-Climatologica-TMEDSECA.xlsx"),
  ]);

  return buildInmetValidationDataset({
    stations,
    precipitationRecords,
    temperatureRecords,
  });
}

async function readStations(fileName: string): Promise<InmetStation[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(INMET_DIR, fileName));
  const sheet = workbook.worksheets[0];
  const stations: InmetStation[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < 4) {
      return;
    }

    const code = normalizeCode(row.getCell(2).value);
    if (!code) {
      return;
    }

    stations.push({
      code,
      name: normalizeText(row.getCell(3).value),
      uf: normalizeText(row.getCell(4).value),
      latitude: normalizeNumber(row.getCell(5).value),
      longitude: normalizeNumber(row.getCell(6).value),
      altitude: normalizeNumber(row.getCell(7).value),
      status: normalizeText(row.getCell(10).value),
    });
  });

  return stations;
}

async function readMonthlyRecords(fileName: string): Promise<InmetMonthlyRecord[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(INMET_DIR, fileName));
  const sheet = workbook.worksheets[0];
  const records: InmetMonthlyRecord[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < 4) {
      return;
    }

    const code = normalizeCode(row.getCell(1).value);
    if (!code) {
      return;
    }

    records.push({
      code,
      name: normalizeText(row.getCell(2).value),
      uf: normalizeText(row.getCell(3).value),
      monthly: Array.from({ length: 12 }, (_, index) =>
        normalizeNumber(row.getCell(4 + index).value),
      ),
      annual: normalizeNumber(row.getCell(16).value),
    });
  });

  return records;
}

async function fetchEra5InputsByStation(stations: InmetValidStation[]): Promise<{
  inputsByCode: Map<string, MonthlyInput[]>;
  failures: Era5Failure[];
}> {
  const inputsByCode = new Map<string, MonthlyInput[]>();
  const failures: Era5Failure[] = [];
  const uncached: InmetValidStation[] = [];

  for (const station of stations) {
    const cached = await readEra5Cache(station);
    if (cached) {
      inputsByCode.set(station.station.code, cached.inputs);
    } else {
      uncached.push(station);
    }
  }

  console.log(
    `${MODEL_LABEL}: ${inputsByCode.size} estações em cache, ${uncached.length} para baixar.`,
  );

  const chunks = chunk(uncached, BATCH_SIZE);
  for (const [index, stationsChunk] of chunks.entries()) {
    console.log(
      `[lote ${index + 1}/${chunks.length}] ${MODEL_LABEL} ${stationsChunk
        .map((item) => item.station.code)
        .join(", ")}`,
    );
    try {
      const batchInputs = await fetchEra5Batch(stationsChunk);
      batchInputs.forEach((inputs, code) => inputsByCode.set(code, inputs));
      await sleep(DOWNLOAD_DELAY_MS);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      stationsChunk.forEach((station) => {
        failures.push({
          code: station.station.code,
          name: station.station.name,
          uf: station.station.uf,
          reason,
        });
      });
      console.warn(`Lote falhou: ${reason}`);
    }
  }

  return { inputsByCode, failures };
}

async function readCachedEra5InputsByStation(
  stations: InmetValidStation[],
): Promise<{
  inputsByCode: Map<string, MonthlyInput[]>;
  failures: Era5Failure[];
}> {
  const inputsByCode = new Map<string, MonthlyInput[]>();

  for (const station of stations) {
    const cached = await readEra5Cache(station);
    if (cached) {
      inputsByCode.set(station.station.code, cached.inputs);
    }
  }

  console.log(
    `${MODEL_LABEL} parcial: ${inputsByCode.size} estações em cache, ${stations.length - inputsByCode.size} pendentes sem baixar.`,
  );

  return { inputsByCode, failures: [] };
}

async function fetchEra5Batch(
  stations: InmetValidStation[],
): Promise<Map<string, MonthlyInput[]>> {
  if (USE_WINDOWED_FETCH) {
    return fetchEra5BatchInWindows(stations);
  }

  const url = buildEra5Url(stations, START_DATE, END_DATE);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo HTTP ${response.status}`);
      }

      const payload = await response.json();
      const locations = Array.isArray(payload) ? payload : [payload];
      if (locations.length !== stations.length) {
        throw new Error(
          `Open-Meteo retornou ${locations.length} locais para ${stations.length} coordenadas.`,
        );
      }

      const result = new Map<string, MonthlyInput[]>();
      for (const [index, station] of stations.entries()) {
        const locationPayload = locations[index];
        const aggregation = aggregateDailyClimateToMonthlyNormals(
          locationPayload.daily,
          {
            requireCompleteMonths: true,
            effectiveEndDate: END_DATE,
          },
        );

        if (aggregation.missingMonths.length) {
          throw new Error(
            `${MODEL_LABEL} sem meses completos para ${station.station.code}: ${aggregation.missingMonths.join(", ")}`,
          );
        }

        const entry: Era5CacheEntry = {
          code: station.station.code,
          model: MODEL,
          period: PERIOD,
          latitude: station.station.latitude as number,
          longitude: station.station.longitude as number,
          inputs: aggregation.inputs,
          yearsWithData: aggregation.monthly.map((month) => month.yearsWithData),
          generatedAt: new Date().toISOString(),
        };
        await writeEra5Cache(station, entry);
        result.set(station.station.code, entry.inputs);
      }

      return result;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const delay = message.includes("429") ? 60000 * attempt : 5000 * attempt;
      console.warn(
        `Tentativa ${attempt} falhou para o lote; aguardando ${Math.round(delay / 1000)}s.`,
      );
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchEra5BatchInWindows(
  stations: InmetValidStation[],
): Promise<Map<string, MonthlyInput[]>> {
  if (stations.length !== 1) {
    throw new Error("Consulta em janelas exige uma estação por lote.");
  }

  const station = stations[0];
  const mergedDaily: DailyClimateSeries = {
    time: [],
    temperature_2m_mean: [],
    precipitation_sum: [],
  };

  for (const [windowIndex, window] of DATE_WINDOWS.entries()) {
    const payload = await fetchEra5PayloadWithRetry(
      buildEra5Url(stations, window.start, window.end),
    );
    const locationPayload = Array.isArray(payload) ? payload[0] : payload;
    if (!locationPayload?.daily) {
      throw new Error(`${MODEL_LABEL} sem dados diários para ${station.station.code}.`);
    }

    mergedDaily.time.push(...locationPayload.daily.time);
    mergedDaily.temperature_2m_mean.push(
      ...locationPayload.daily.temperature_2m_mean,
    );
    mergedDaily.precipitation_sum.push(...locationPayload.daily.precipitation_sum);

    if (windowIndex < DATE_WINDOWS.length - 1) {
      await sleep(4000);
    }
  }

  const aggregation = aggregateDailyClimateToMonthlyNormals(mergedDaily, {
    requireCompleteMonths: true,
    effectiveEndDate: END_DATE,
  });

  if (aggregation.missingMonths.length) {
    throw new Error(
      `${MODEL_LABEL} sem meses completos para ${station.station.code}: ${aggregation.missingMonths.join(", ")}`,
    );
  }

  const entry: Era5CacheEntry = {
    code: station.station.code,
    model: MODEL,
    period: PERIOD,
    latitude: station.station.latitude as number,
    longitude: station.station.longitude as number,
    inputs: aggregation.inputs,
    yearsWithData: aggregation.monthly.map((month) => month.yearsWithData),
    generatedAt: new Date().toISOString(),
  };
  await writeEra5Cache(station, entry);

  return new Map([[station.station.code, entry.inputs]]);
}

async function fetchEra5PayloadWithRetry(url: string): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const delay = message.includes("429") ? 30000 * attempt : 5000 * attempt;
      console.warn(
        `Tentativa ${attempt} falhou para a janela; aguardando ${Math.round(delay / 1000)}s.`,
      );
      if (attempt < MAX_FETCH_ATTEMPTS) {
        await sleep(delay);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function buildEra5Url(
  stations: InmetValidStation[],
  startDate: string,
  endDate: string,
): string {
  const query = new URLSearchParams({
    latitude: stations.map((station) => String(station.station.latitude)).join(","),
    longitude: stations.map((station) => String(station.station.longitude)).join(","),
    start_date: startDate,
    end_date: endDate,
    daily: "temperature_2m_mean,precipitation_sum",
    models: MODEL,
    timezone: "auto",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  });

  return `https://archive-api.open-meteo.com/v1/archive?${query.toString()}`;
}

function buildWorkbook(params: {
  comparisons: StationValidationComparison[];
  validStations: InmetValidStation[];
  excludedStations: Array<{ code: string; name: string; uf: string; reason: string }>;
  era5Failures: Era5Failure[];
  totals: {
    stations: number;
    precipitation: number;
    temperature: number;
    valid: number;
    excluded: number;
  };
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GeoCalc";
  workbook.lastModifiedBy = "GeoCalc";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = `GeoCalc - Validação INMET x Open-Meteo/${MODEL_LABEL}`;
  workbook.subject = "Validação Balanço Hídrico 1991-2020";

  buildSummarySheet(workbook, params);
  buildValidStationsSheet(workbook, params.validStations, params.comparisons);
  buildAnnualComparisonSheet(workbook, params.validStations, params.comparisons);
  buildMonthlyComparisonSheet(workbook, params.validStations, params.comparisons);
  buildRankingSheet(workbook, params.comparisons);
  buildSourceDataSheet(
    workbook,
    "Dados INMET",
    params.validStations,
    params.comparisons,
    "inmet",
  );
  buildSourceDataSheet(
    workbook,
    `Dados ${MODEL_LABEL}`,
    params.validStations,
    params.comparisons,
    "era5",
  );
  buildExcludedSheet(workbook, params.excludedStations, params.era5Failures);
  buildMethodologySheet(workbook);

  return workbook;
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  params: {
    comparisons: StationValidationComparison[];
    validStations: InmetValidStation[];
    excludedStations: Array<{ code: string; name: string; uf: string; reason: string }>;
    era5Failures: Era5Failure[];
    totals: {
      stations: number;
      precipitation: number;
      temperature: number;
      valid: number;
      excluded: number;
    };
  },
) {
  const sheet = workbook.addWorksheet("Resumo");
  sheet.columns = [
    { key: "metric", width: 42 },
    { key: "value", width: 24 },
    { key: "notes", width: 64 },
  ];

  title(sheet, `GeoCalc - Validação INMET x Open-Meteo/${MODEL_LABEL}`, 1, 3);
  rows(sheet, 3, [
    ["Período", PERIOD, "Normal climatológica comparada"],
    ["Fonte de referência", "INMET", "Normais Climatológicas do Brasil 1991-2020"],
    ["Fonte comparada", "Open-Meteo", `Historical Weather API, modelo ${MODEL_LABEL}`],
    ["Data de geração", formatDate(new Date()), ""],
    ["Estações INMET lidas", params.totals.stations, ""],
    ["Registros com precipitação", params.totals.precipitation, ""],
    ["Registros com temperatura", params.totals.temperature, ""],
    ["Estações válidas INMET", params.validStations.length, "P, T e coordenadas completas"],
    ["Comparações concluídas", params.comparisons.length, ""],
    ["Estações excluídas por dados INMET", params.excludedStations.length, ""],
    [`Falhas na consulta ${MODEL_LABEL}`, params.era5Failures.length, ""],
  ]);

  section(sheet, "Métricas gerais", 16, 3);
  const balanceDiffs = params.comparisons.map((item) => item.metrics.balanceAnnualDiff);
  const precipitationDiffs = params.comparisons.map(
    (item) => item.metrics.precipitationAnnualDiff,
  );
  const temperatureDiffs = params.comparisons.map(
    (item) => item.metrics.meanTemperatureDiff,
  );
  rows(sheet, 17, [
    [`Diferença média P anual ${MODEL_LABEL} - INMET`, mean(precipitationDiffs), "mm"],
    [`Diferença mediana P anual ${MODEL_LABEL} - INMET`, median(precipitationDiffs), "mm"],
    [`Diferença média T anual ${MODEL_LABEL} - INMET`, mean(temperatureDiffs), "°C"],
    [`Diferença mediana T anual ${MODEL_LABEL} - INMET`, median(temperatureDiffs), "°C"],
    [`Diferença média BH anual ${MODEL_LABEL} - INMET`, mean(balanceDiffs), "mm"],
    [`Diferença mediana BH anual ${MODEL_LABEL} - INMET`, median(balanceDiffs), "mm"],
    ["Maior diferença positiva BH anual", max(balanceDiffs), "mm"],
    ["Maior diferença negativa BH anual", min(balanceDiffs), "mm"],
  ]);

  section(sheet, "Resumo por UF", 28, 4);
  header(sheet, 29, ["UF", "Estações", "Dif. média P anual", "Dif. média BH anual"]);
  const ufRows = buildUfSummary(params.comparisons);
  ufRows.forEach((row, index) => {
    sheet.getRow(30 + index).values = [
      row.uf,
      row.count,
      row.meanPrecipitationDiff,
      row.meanBalanceDiff,
    ];
  });
  table(sheet, 29, 29 + ufRows.length, 1, 4);
  numberColumns(sheet, 30, 29 + ufRows.length, [3, 4]);
}

function buildValidStationsSheet(
  workbook: ExcelJS.Workbook,
  validStations: InmetValidStation[],
  comparisons: StationValidationComparison[],
) {
  const sheet = workbook.addWorksheet("Estações válidas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = widths([12, 28, 8, 14, 14, 12, 14, 14, 18, 18]);
  header(sheet, 1, [
    "Código",
    "Estação",
    "UF",
    "Latitude",
    "Longitude",
    "Altitude",
    "Situação",
    "Hemisfério",
    "Latitude de fator",
    `Status ${MODEL_LABEL}`,
  ]);
  const comparedCodes = new Set(comparisons.map((item) => item.code));
  const comparisonsByCode = new Map(comparisons.map((item) => [item.code, item]));

  validStations.forEach((item, index) => {
    const factorSelection =
      item.station.latitude !== null ? item.station.latitude < 0 ? "Sul" : "Norte" : "";
    const nearestLatitude =
      comparisonsByCode.get(item.station.code)?.factorSelection.latitude ??
      (item.station.latitude !== null
        ? nearestFactorSelection(item.station.latitude).latitude
        : "");
    sheet.getRow(index + 2).values = [
      item.station.code,
      item.station.name,
      item.station.uf,
      item.station.latitude,
      item.station.longitude,
      item.station.altitude,
      item.station.status,
      factorSelection,
      nearestLatitude,
      comparedCodes.has(item.station.code) ? "Comparada" : "Falhou",
    ];
  });
  table(sheet, 1, validStations.length + 1, 1, 10);
  numberColumns(sheet, 2, validStations.length + 1, [4, 5, 6, 9]);
}

function buildAnnualComparisonSheet(
  workbook: ExcelJS.Workbook,
  validStations: InmetValidStation[],
  comparisons: StationValidationComparison[],
) {
  const sheet = workbook.addWorksheet("Comparativo anual", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = widths([
    12, 28, 8, 14, 14, 12, 12, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14,
    14, 14, 14, 14, 14, 14, 14, 14, 16,
  ]);
  header(sheet, 1, [
    "Código",
    "Estação",
    "UF",
    "Latitude",
    "Longitude",
    "Hem.",
    "Lat. fator",
    "P INMET",
    `P ${MODEL_LABEL}`,
    "Dif. P",
    "Dif. P %",
    "T INMET",
    `T ${MODEL_LABEL}`,
    "Dif. T",
    "ETPc INMET",
    `ETPc ${MODEL_LABEL}`,
    "Dif. ETPc",
    "BH INMET",
    `BH ${MODEL_LABEL}`,
    "Dif. BH",
    "SH INMET",
    `SH ${MODEL_LABEL}`,
    "DH INMET",
    `DH ${MODEL_LABEL}`,
    "MAE BH",
    "RMSE BH",
    "Meses SH/DH divergentes",
    "Status",
  ]);

  const comparisonsByCode = new Map(comparisons.map((item) => [item.code, item]));
  validStations.forEach((station, index) => {
    const item = comparisonsByCode.get(station.station.code);
    const inmet = item?.inmet ?? buildInmetOnlyValues(station);
    const factorSelection =
      item?.factorSelection ??
      nearestFactorSelection(station.station.latitude as number);
    sheet.getRow(index + 2).values = [
      station.station.code,
      station.station.name,
      station.station.uf,
      station.station.latitude,
      station.station.longitude,
      factorSelection.hemisphere === "south" ? "Sul" : "Norte",
      factorSelection.latitude,
      inmet.annual.precipitationTotal,
      item?.era5.annual.precipitationTotal ?? null,
      item?.metrics.precipitationAnnualDiff ?? null,
      item?.metrics.precipitationAnnualDiffPercent ?? null,
      inmet.annual.meanTemperature,
      item?.era5.annual.meanTemperature ?? null,
      item?.metrics.meanTemperatureDiff ?? null,
      inmet.annual.correctedEtpTotal,
      item?.era5.annual.correctedEtpTotal ?? null,
      item?.metrics.correctedEtpAnnualDiff ?? null,
      inmet.annual.balanceTotal,
      item?.era5.annual.balanceTotal ?? null,
      item?.metrics.balanceAnnualDiff ?? null,
      inmet.annual.surplusTotal,
      item?.era5.annual.surplusTotal ?? null,
      inmet.annual.deficitTotal,
      item?.era5.annual.deficitTotal ?? null,
      item?.metrics.balanceMae ?? null,
      item?.metrics.balanceRmse ?? null,
      item?.metrics.balanceClassDisagreements ?? null,
      item ? (item.era5.result.isComplete ? "Completo" : "Incompleto") : `${MODEL_LABEL} pendente`,
    ];
  });
  table(sheet, 1, validStations.length + 1, 1, 28);
  numberColumns(sheet, 2, validStations.length + 1, [
    4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
    25, 26, 27,
  ]);
  sheet.autoFilter = { from: "A1", to: `AB${validStations.length + 1}` };
}

function buildMonthlyComparisonSheet(
  workbook: ExcelJS.Workbook,
  validStations: InmetValidStation[],
  comparisons: StationValidationComparison[],
) {
  const sheet = workbook.addWorksheet("Comparativo mensal", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = widths([
    12, 28, 8, 12, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14,
    14, 14, 14, 18,
  ]);
  header(sheet, 1, [
    "Código",
    "Estação",
    "UF",
    "Mês",
    "P INMET",
    "T INMET",
    "ETP INMET",
    "ETPc INMET",
    "BH INMET",
    "SH INMET",
    "DH INMET",
    `P ${MODEL_LABEL}`,
    `T ${MODEL_LABEL}`,
    `ETP ${MODEL_LABEL}`,
    `ETPc ${MODEL_LABEL}`,
    `BH ${MODEL_LABEL}`,
    `SH ${MODEL_LABEL}`,
    `DH ${MODEL_LABEL}`,
    "Dif. P",
    "Dif. T",
    "Dif. BH",
    "Classe igual?",
    "Observação",
  ]);

  let rowNumber = 2;
  const comparisonsByCode = new Map(comparisons.map((item) => [item.code, item]));
  validStations.forEach((station) => {
    const item = comparisonsByCode.get(station.station.code);
    const inmetOnly = item ? null : buildInmetOnlyValues(station);
    MONTHS.forEach((month, monthIndex) => {
      const inmet = item?.inmet.monthly[monthIndex] ?? inmetOnly?.monthly[monthIndex];
      const era5 = item?.era5.monthly[monthIndex] ?? null;
      const classEqual =
        inmet && era5 ? balanceClass(inmet.balance) === balanceClass(era5.balance) : null;
      sheet.getRow(rowNumber).values = [
        station.station.code,
        station.station.name,
        station.station.uf,
        month.name,
        inmet?.precipitation ?? null,
        inmet?.temperature ?? null,
        inmet?.etp ?? null,
        inmet?.correctedEtp ?? null,
        inmet?.balance ?? null,
        inmet?.surplus ?? null,
        inmet?.deficit ?? null,
        era5?.precipitation ?? null,
        era5?.temperature ?? null,
        era5?.etp ?? null,
        era5?.correctedEtp ?? null,
        era5?.balance ?? null,
        era5?.surplus ?? null,
        era5?.deficit ?? null,
        era5 && inmet ? diff(era5.precipitation, inmet.precipitation) : null,
        era5 && inmet ? diff(era5.temperature, inmet.temperature) : null,
        era5 && inmet ? diff(era5.balance, inmet.balance) : null,
        classEqual === null ? "" : classEqual ? "Sim" : "Não",
        classEqual === null
          ? `${MODEL_LABEL} pendente no cache local`
          : classEqual
            ? ""
            : `INMET e ${MODEL_LABEL} divergem entre SH/DH`,
      ];
      rowNumber += 1;
    });
  });
  table(sheet, 1, rowNumber - 1, 1, 23);
  numberColumns(sheet, 2, rowNumber - 1, [
    5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  ]);
  sheet.autoFilter = { from: "A1", to: `W${rowNumber - 1}` };
}

function buildRankingSheet(
  workbook: ExcelJS.Workbook,
  comparisons: StationValidationComparison[],
) {
  const sheet = workbook.addWorksheet("Ranking de diferenças");
  sheet.columns = widths([28, 8, 12, 28, 14, 16, 18, 36]);
  header(sheet, 1, [
    "Categoria",
    "Rank",
    "Código",
    "Estação",
    "UF",
    "Valor",
    "Unidade",
    "Observação",
  ]);

  const rankings = [
    {
      category: "Maior diferença absoluta de P anual",
      unit: "mm",
      getValue: (item: StationValidationComparison) =>
        absolute(item.metrics.precipitationAnnualDiff),
      note: `abs(${MODEL_LABEL} - INMET)`,
    },
    {
      category: "Maior diferença absoluta de T média",
      unit: "°C",
      getValue: (item: StationValidationComparison) =>
        absolute(item.metrics.meanTemperatureDiff),
      note: `abs(${MODEL_LABEL} - INMET)`,
    },
    {
      category: "Maior diferença absoluta de BH anual",
      unit: "mm",
      getValue: (item: StationValidationComparison) =>
        absolute(item.metrics.balanceAnnualDiff),
      note: `abs(${MODEL_LABEL} - INMET)`,
    },
    {
      category: "Mais divergências SH/DH",
      unit: "meses",
      getValue: (item: StationValidationComparison) =>
        item.metrics.balanceClassDisagreements,
      note: "Meses em que a classe difere",
    },
  ];

  let rowNumber = 2;
  rankings.forEach((ranking) => {
    comparisons
      .map((item) => ({ item, value: ranking.getValue(item) }))
      .filter((entry) => entry.value !== null)
      .sort((a, b) => (b.value as number) - (a.value as number))
      .slice(0, 15)
      .forEach((entry, index) => {
        sheet.getRow(rowNumber).values = [
          ranking.category,
          index + 1,
          entry.item.code,
          entry.item.name,
          entry.item.uf,
          entry.value,
          ranking.unit,
          ranking.note,
        ];
        rowNumber += 1;
      });
  });
  table(sheet, 1, rowNumber - 1, 1, 8);
  numberColumns(sheet, 2, rowNumber - 1, [2, 6]);
}

function buildSourceDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  validStations: InmetValidStation[],
  comparisons: StationValidationComparison[],
  source: "inmet" | "era5",
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = widths([12, 28, 8, 12, 14, 14, 14, 14, 14, 14, 14, 14, 14]);
  header(sheet, 1, [
    "Código",
    "Estação",
    "UF",
    "Mês",
    "P",
    "T",
    "FC",
    "i",
    "ETP",
    "ETPc",
    "BH",
    "SH",
    "DH",
  ]);

  let rowNumber = 2;
  const comparisonsByCode = new Map(comparisons.map((item) => [item.code, item]));
  validStations.forEach((station) => {
    const item = comparisonsByCode.get(station.station.code);
    const rowsToWrite =
      source === "inmet"
        ? (item?.inmet.result.rows ?? buildInmetOnlyValues(station).result.rows)
        : (item?.era5.result.rows ?? MONTHS.map((month) => ({
            monthName: month.name,
            precipitation: null,
            temperature: null,
            correctionFactor: null,
            monthlyHeatIndex: null,
            etp: null,
            correctedEtp: null,
            balance: null,
          })));
    rowsToWrite.forEach((row) => {
      sheet.getRow(rowNumber).values = [
        station.station.code,
        station.station.name,
        station.station.uf,
        row.monthName,
        row.precipitation,
        row.temperature,
        row.correctionFactor,
        row.monthlyHeatIndex,
        row.etp,
        row.correctedEtp,
        row.balance,
        row.balance !== null && row.balance > 0 ? row.balance : null,
        row.balance !== null && row.balance < 0 ? row.balance : null,
      ];
      rowNumber += 1;
    });
  });
  table(sheet, 1, rowNumber - 1, 1, 13);
  numberColumns(sheet, 2, rowNumber - 1, [5, 6, 7, 8, 9, 10, 11, 12, 13]);
  sheet.autoFilter = { from: "A1", to: `M${rowNumber - 1}` };
}

function buildExcludedSheet(
  workbook: ExcelJS.Workbook,
  excludedStations: Array<{ code: string; name: string; uf: string; reason: string }>,
  era5Failures: Era5Failure[],
) {
  const sheet = workbook.addWorksheet("Estações excluídas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = widths([16, 12, 32, 8, 64]);
  header(sheet, 1, ["Etapa", "Código", "Estação", "UF", "Motivo"]);
  let rowNumber = 2;

  excludedStations.forEach((item) => {
    sheet.getRow(rowNumber).values = [
      "INMET",
      item.code,
      item.name,
      item.uf,
      item.reason,
    ];
    rowNumber += 1;
  });
  era5Failures.forEach((item) => {
    sheet.getRow(rowNumber).values = [
      `Open-Meteo/${MODEL_LABEL}`,
      item.code,
      item.name,
      item.uf,
      item.reason,
    ];
    rowNumber += 1;
  });

  table(sheet, 1, Math.max(rowNumber - 1, 1), 1, 5);
}

function buildMethodologySheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Metodologia");
  sheet.columns = widths([34, 110]);
  title(sheet, "Metodologia da validação", 1, 2);
  rows(sheet, 3, [
    [
      "Objetivo",
      `Comparar os valores oficiais das Normais Climatológicas do INMET 1991-2020 com estimativas Open-Meteo/${MODEL_LABEL} calculadas na mesma coordenada de cada estação.`,
    ],
    [
      "INMET",
      "Foram usados os arquivos de estações, precipitação acumulada mensal e temperatura média compensada mensal. Entram na comparação apenas estações com os 12 meses completos de P e T e coordenadas válidas.",
    ],
    [
      `Open-Meteo/${MODEL_LABEL}`,
      `Para cada estação, o GeoCalc consulta a série diária de 1991-01-01 a 2020-12-31 no modelo ${MODEL_LABEL}. A precipitação mensal é a soma das chuvas diárias do mês. A temperatura mensal é a média das temperaturas médias diárias. A normal mensal é a média dos mesmos meses ao longo dos anos válidos.`,
    ],
    [
      "Balanço Hídrico",
      "O cálculo usa a mesma implementação do app: BH = P - ETP corrigida; ETP mensal = 16 * (10t / I)^a; i = (t / 5)^1,514; I = soma(i); ETP corrigida = ETP * FC.",
    ],
    [
      "Fator de correção",
      "O hemisfério e a latitude de fator são calculados automaticamente pela latitude da estação, usando a latitude suportada mais próxima na tabela do método.",
    ],
    [
      "Interpretação",
      `Diferenças positivas significam ${MODEL_LABEL} maior que INMET. Diferenças negativas significam ${MODEL_LABEL} menor que INMET. SH representa valores positivos de BH; DH representa valores negativos de BH.`,
    ],
    [
      "Fontes",
      `INMET Normais Climatológicas do Brasil 1991-2020; Open-Meteo Historical Weather API, modelo ${MODEL_LABEL}; Thornthwaite, C.W. 1948.`,
    ],
  ]);
  table(sheet, 3, 9, 1, 2);
}

function buildInmetOnlyValues(station: InmetValidStation) {
  const factorSelection = nearestFactorSelection(station.station.latitude as number);
  const inputs = toMonthlyInputs(
    station.precipitation.monthly,
    station.temperature.monthly,
  );
  const result = calculateWaterBalance(inputs, factorSelection);
  const temperatures = inputs
    .map((input) => input.temperature)
    .filter(isNumber);
  const balances = result.rows.map((row) => row.balance).filter(isNumber);
  const annual = {
    precipitationTotal: result.annual.precipitationTotal,
    meanTemperature: temperatures.length === 12 ? mean(temperatures) : null,
    correctedEtpTotal: result.annual.correctedEtpTotal,
    balanceTotal: result.annual.balanceTotal,
    surplusTotal:
      balances.length === 12
        ? balances.reduce((total, value) => total + (value > 0 ? value : 0), 0)
        : null,
    deficitTotal:
      balances.length === 12
        ? balances.reduce((total, value) => total + (value < 0 ? value : 0), 0)
        : null,
  };
  const monthly = result.rows.map((row) => ({
    precipitation: row.precipitation,
    temperature: row.temperature,
    etp: row.etp,
    correctedEtp: row.correctedEtp,
    balance: row.balance,
    surplus: row.balance !== null && row.balance > 0 ? row.balance : null,
    deficit: row.balance !== null && row.balance < 0 ? row.balance : null,
  }));

  return { inputs, result, annual, monthly };
}

function rows(sheet: ExcelJS.Worksheet, startRow: number, values: unknown[][]) {
  values.forEach((row, index) => {
    sheet.getRow(startRow + index).values = row;
  });
  table(sheet, startRow, startRow + values.length - 1, 1, values[0]?.length ?? 1);
}

function header(sheet: ExcelJS.Worksheet, rowNumber: number, values: string[]) {
  const row = sheet.getRow(rowNumber);
  row.values = values;
  row.height = 28;
  row.eachCell((cell) => {
    cell.style = {
      font: { bold: true, color: { argb: "FFFFFFFF" }, name: "Roboto" },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: colors.green },
      },
      alignment: { vertical: "middle", horizontal: "center", wrapText: true },
      border: fullBorder(),
    };
  });
}

function title(
  sheet: ExcelJS.Worksheet,
  text: string,
  rowNumber: number,
  endColumn: number,
) {
  sheet.mergeCells(rowNumber, 1, rowNumber, endColumn);
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = text;
  cell.style = {
    font: { bold: true, size: 16, color: { argb: "FFFFFFFF" }, name: "Roboto Slab" },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colors.dark },
    },
    alignment: { vertical: "middle", horizontal: "center" },
  };
  sheet.getRow(rowNumber).height = 30;
}

function section(
  sheet: ExcelJS.Worksheet,
  text: string,
  rowNumber: number,
  endColumn: number,
) {
  sheet.mergeCells(rowNumber, 1, rowNumber, endColumn);
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = text;
  cell.style = {
    font: { bold: true, color: { argb: colors.dark }, name: "Roboto Slab" },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colors.lightGreen },
    },
    alignment: { vertical: "middle", horizontal: "left" },
    border: fullBorder(),
  };
}

function table(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    for (
      let columnNumber = startColumn;
      columnNumber <= endColumn;
      columnNumber += 1
    ) {
      const cell = sheet.getCell(rowNumber, columnNumber);
      cell.border = cell.border ?? fullBorder();
      cell.alignment = cell.alignment ?? {
        vertical: "middle",
        horizontal: columnNumber === startColumn ? "left" : "right",
        wrapText: true,
      };
      cell.font = cell.font ?? { color: { argb: colors.muted }, name: "Roboto" };
    }
  }
}

function numberColumns(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  columns: number[],
) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    columns.forEach((columnNumber) => {
      const cell = sheet.getCell(rowNumber, columnNumber);
      if (typeof cell.value === "number") {
        cell.numFmt = "0.0";
      }
    });
  }
}

function fullBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: colors.border } },
    left: { style: "thin", color: { argb: colors.border } },
    bottom: { style: "thin", color: { argb: colors.border } },
    right: { style: "thin", color: { argb: colors.border } },
  };
}

function widths(values: number[]) {
  return values.map((width) => ({ width }));
}

function buildUfSummary(comparisons: StationValidationComparison[]) {
  const byUf = new Map<string, StationValidationComparison[]>();
  comparisons.forEach((item) => {
    byUf.set(item.uf, [...(byUf.get(item.uf) ?? []), item]);
  });

  return [...byUf.entries()]
    .sort(([ufA], [ufB]) => ufA.localeCompare(ufB))
    .map(([uf, items]) => ({
      uf,
      count: items.length,
      meanPrecipitationDiff: mean(
        items.map((item) => item.metrics.precipitationAnnualDiff),
      ),
      meanBalanceDiff: mean(items.map((item) => item.metrics.balanceAnnualDiff)),
    }));
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function readEra5Cache(
  station: InmetValidStation,
): Promise<Era5CacheEntry | null> {
  return readJson<Era5CacheEntry>(path.join(CACHE_DIR, `${cacheKey(station)}.json`));
}

async function readModelCache(
  station: InmetValidStation,
  model: (typeof MODEL_CONFIGS)[keyof typeof MODEL_CONFIGS],
): Promise<Era5CacheEntry | null> {
  return readJson<Era5CacheEntry>(
    path.join(
      GENERATED_DIR,
      `cache/open-meteo-${model.slug}-1991-2020`,
      `${cacheKeyForModel(station, model)}.json`,
    ),
  );
}

async function writeEra5Cache(
  station: InmetValidStation,
  entry: Era5CacheEntry,
) {
  await writeFile(
    path.join(CACHE_DIR, `${cacheKey(station)}.json`),
    JSON.stringify(entry, null, 2),
  );
}

function normalizeCode(value: ExcelJS.CellValue): string {
  const normalized = normalizeText(value);
  return normalized ? normalized.replace(/\.0$/, "").trim() : "";
}

function normalizeText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object" && "text" in value && value.text) {
    return String(value.text).trim();
  }

  return String(value).trim();
}

function normalizeNumber(value: ExcelJS.CellValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "-") {
      return null;
    }

    const parsed = Number(trimmed.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function cacheKey(station: InmetValidStation): string {
  return cacheKeyForModel(station, SELECTED_MODEL);
}

function cacheKeyForModel(
  station: InmetValidStation,
  model: (typeof MODEL_CONFIGS)[keyof typeof MODEL_CONFIGS],
): string {
  return [
    station.station.code,
    model.apiValue,
    PERIOD,
    Number(station.station.latitude).toFixed(4),
    Number(station.station.longitude).toFixed(4),
  ]
    .join("-")
    .replace(/[^a-z0-9.-]+/gi, "_");
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function diff(value: number | null, reference: number | null): number | null {
  return value !== null && reference !== null ? value - reference : null;
}

function absolute(value: number | null): number | null {
  return value === null ? null : Math.abs(value);
}

function balanceClass(value: number | null): "SH" | "DH" | "Neutro" | "Sem dado" {
  if (value === null) {
    return "Sem dado";
  }

  if (value > 0) {
    return "SH";
  }

  if (value < 0) {
    return "DH";
  }

  return "Neutro";
}

function mean(values: Array<number | null>): number | null {
  const numbers = values.filter(isNumber);
  return numbers.length
    ? numbers.reduce((total, value) => total + value, 0) / numbers.length
    : null;
}

function median(values: Array<number | null>): number | null {
  const numbers = values.filter(isNumber).sort((a, b) => a - b);
  if (!numbers.length) {
    return null;
  }

  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2
    ? numbers[middle]
    : (numbers[middle - 1] + numbers[middle]) / 2;
}

function min(values: Array<number | null>): number | null {
  const numbers = values.filter(isNumber);
  return numbers.length ? Math.min(...numbers) : null;
}

function max(values: Array<number | null>): number | null {
  const numbers = values.filter(isNumber);
  return numbers.length ? Math.max(...numbers) : null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
