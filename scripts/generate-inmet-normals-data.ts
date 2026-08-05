import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildInmetValidationDataset } from "../src/shared/inmet-validation";
import type {
  InmetMonthlyRecord,
  InmetStation,
} from "../src/shared/inmet-validation";

const ROOT_DIR = process.cwd();
const PERIOD = "1981-2010";
const INMET_DIR = path.join(
  ROOT_DIR,
  "Notes/Dados INMET/1981 - 2010",
);
const OUTPUT_DIR = path.join(ROOT_DIR, "src/shared/data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "inmet-normals-1981-2010.json");

async function main() {
  const [stations, precipitationRecords, temperatureRecords] = await Promise.all([
    readStations("Estações-Normal-Climatoógica-1981-2010.xlsx"),
    readMonthlyRecords("30-Precipitação-Acumulada-NCB_1981-2010.xlsx"),
    readMonthlyRecords("01-Temperatura-Média-Compensada-Bulbo-Seco-NCB_1981-2010.xlsx"),
  ]);
  const dataset = buildInmetValidationDataset({
    stations,
    precipitationRecords,
    temperatureRecords,
  });
  console.log(path.join(INMET_DIR));

  const generatedAt = new Date().toISOString();
  const payload = {
    source: "INMET Normais Climatológicas do Brasil",
    period: PERIOD,
    generatedAt,
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

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `INMET ${PERIOD}: ${dataset.validStations.length} estações válidas geradas em ${OUTPUT_FILE}`,
  );
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

function normalizeCode(value: ExcelJS.CellValue): string {
  return normalizeText(value).replace(/\.0$/, "").trim();
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
