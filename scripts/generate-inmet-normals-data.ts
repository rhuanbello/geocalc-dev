import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import { buildInmetValidationDataset } from "../src/shared/inmet-validation";
import type {
  InmetMonthlyRecord,
  InmetStation,
} from "../src/shared/inmet-validation";

const ROOT_DIR = process.cwd();
const DATA_ROOT = path.join(ROOT_DIR, "docs/semana 02/Dados INMET");
const OUTPUT_DIR = path.join(ROOT_DIR, "src/shared/data");

export type InmetNormalPeriod = "1961-1990" | "1981-2010" | "1991-2020";

type PeriodConfig = {
  period: InmetNormalPeriod;
  directory: string;
  stationFile: string;
  precipitationFile: string;
  temperatureFile: string;
  stationColumns: {
    code: number;
    name: number;
    uf: number;
    latitude: number;
    longitude: number;
    altitude: number;
    status?: number;
  };
};

const PERIODS: Record<InmetNormalPeriod, PeriodConfig> = {
  "1961-1990": {
    period: "1961-1990",
    directory: "1961 - 1990",
    stationFile: "Relac_Est_Meteo_NC.xls",
    precipitationFile: "Precipitacao-Acumulada_NCB_1961-1990.xls",
    temperatureFile: "Temperatura-Media-Compensada_NCB_1961-1990.xls",
    stationColumns: { code: 0, name: 1, uf: 3, latitude: 4, longitude: 5, altitude: 6 },
  },
  "1981-2010": {
    period: "1981-2010",
    directory: "1981 - 2010",
    stationFile: "Estações-Normal-Climatoógica-1981-2010.xls",
    precipitationFile: "30-Precipitação-Acumulada-NCB_1981-2010.xls",
    temperatureFile: "01-Temperatura-Média-Compensada-Bulbo-Seco-NCB_1981-2010.xls",
    stationColumns: { code: 1, name: 2, uf: 3, latitude: 4, longitude: 5, altitude: 6, status: 9 },
  },
  "1991-2020": {
    period: "1991-2020",
    directory: "1991 - 2020",
    stationFile: "Normal-Climatologica-ESTAÇÕES.xlsx",
    precipitationFile: "Normal-Climatologica-PREC.xlsx",
    temperatureFile: "Normal-Climatologica-TMEDSECA.xlsx",
    stationColumns: { code: 1, name: 2, uf: 3, latitude: 4, longitude: 5, altitude: 6, status: 9 },
  },
};

async function main() {
  const requestedPeriod = process.argv
    .find((argument) => argument.startsWith("--period="))
    ?.replace("--period=", "") as InmetNormalPeriod | undefined;
  const periods = requestedPeriod ? [getPeriodConfig(requestedPeriod)] : Object.values(PERIODS);

  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const config of periods) {
    const dataset = readPeriodDataset(config);
    const payload = {
      source: "INMET Normais Climatológicas do Brasil",
      period: config.period,
      generatedAt: new Date().toISOString(),
      stationCount: dataset.validStations.length,
      stations: dataset.validStations
        .map(({ station, precipitation, temperature }) => ({
          code: station.code,
          name: station.name,
          uf: station.uf,
          latitude: station.latitude,
          longitude: station.longitude,
          altitude: station.altitude,
          status: station.status,
          precipitation: precipitation.monthly,
          temperature: temperature.monthly,
        }))
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    };
    const output = path.join(OUTPUT_DIR, `inmet-normals-${config.period}.json`);
    await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`INMET ${config.period}: ${payload.stationCount} estações válidas geradas em ${output}`);
  }
}

export function readPeriodDataset(config: PeriodConfig) {
  const directory = path.join(DATA_ROOT, config.directory);
  return buildInmetValidationDataset({
    stations: readStations(path.join(directory, config.stationFile), config.stationColumns),
    precipitationRecords: readMonthlyRecords(path.join(directory, config.precipitationFile)),
    temperatureRecords: readMonthlyRecords(path.join(directory, config.temperatureFile)),
  });
}

function getPeriodConfig(period: string): PeriodConfig {
  const config = PERIODS[period as InmetNormalPeriod];
  if (!config) {
    throw new Error(`Período INMET inválido: ${period}.`);
  }
  return config;
}

function readStations(file: string, columns: PeriodConfig["stationColumns"]): InmetStation[] {
  const rows = readRows(file);
  const headerIndex = findHeader(rows, "código", "latitude");
  return rows.slice(headerIndex + 1).flatMap((row) => {
    const code = normalizeCode(row[columns.code]);
    if (!code) return [];
    return [{
      code,
      name: normalizeText(row[columns.name]),
      uf: normalizeText(row[columns.uf]),
      latitude: normalizeCoordinate(row[columns.latitude], "latitude"),
      longitude: normalizeCoordinate(row[columns.longitude], "longitude"),
      altitude: normalizeNumber(row[columns.altitude]),
      status: columns.status === undefined ? "" : normalizeText(row[columns.status]),
    }];
  });
}

function readMonthlyRecords(file: string): InmetMonthlyRecord[] {
  const rows = readRows(file);
  const headerIndex = findHeader(rows, "código", "janeiro");
  return rows.slice(headerIndex + 1).flatMap((row) => {
    const code = normalizeCode(row[0]);
    if (!code) return [];
    return [{
      code,
      name: normalizeText(row[1]),
      uf: normalizeText(row[2]),
      monthly: Array.from({ length: 12 }, (_, index) => normalizeNumber(row[3 + index])),
      annual: normalizeNumber(row[15]),
    }];
  });
}

function readRows(file: string): unknown[][] {
  const workbook = XLSX.readFile(file, { raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) throw new Error(`Planilha sem aba: ${file}`);
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false });
}

function findHeader(rows: unknown[][], ...needles: string[]): number {
  const index = rows.findIndex((row) => {
    const text = row.map(normalizeHeader).join("|");
    return needles.every((needle) => text.includes(normalizeHeader(needle)));
  });
  if (index === -1) throw new Error(`Cabeçalho não encontrado: ${needles.join(", ")}.`);
  return index;
}

function normalizeHeader(value: unknown): string {
  return normalizeText(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function normalizeCode(value: unknown): string {
  return normalizeText(value).replace(/\.0$/, "");
}

function normalizeText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = normalizeText(value);
  if (!text || text === "-") return null;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCoordinate(value: unknown, axis: "latitude" | "longitude"): number | null {
  const direct = normalizeNumber(value);
  if (direct !== null && Math.abs(direct) <= (axis === "latitude" ? 90 : 180)) return direct;
  const match = normalizeText(value).match(/^\s*(\d+(?:[.,]\d+)?)°\s*(?:(\d+(?:[.,]\d+)?)')?\s*([NSEOW])\s*$/iu);
  if (!match) return null;
  const degrees = Number(match[1].replace(",", "."));
  const minutes = match[2] ? Number(match[2].replace(",", ".")) : 0;
  if (!Number.isFinite(degrees) || !Number.isFinite(minutes) || minutes >= 60) return null;
  const decimal = degrees + minutes / 60;
  const signed = ["S", "W", "O"].includes(match[3].toUpperCase()) ? -decimal : decimal;
  return Math.abs(signed) <= (axis === "latitude" ? 90 : 180) ? signed : null;
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
