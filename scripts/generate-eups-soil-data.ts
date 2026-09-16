import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

const ROOT_DIR = process.cwd();
const SOURCE_FILE = path.join(ROOT_DIR, "Notes/correspondencia_ibge_sibcs_erodibilidade.xlsx");
const OUTPUT_FILE = path.join(ROOT_DIR, "src/shared/data/eups-soil-lookup.json");
const PATHS_SHEET = "Banco_8_caixas";
const CONVERSION_SHEET = "Tabela_K";

const SOIL_COMPONENTS = ["C1", "C2", "C3", "C4"] as const;
const NON_TAXONOMIC_COMPONENT = "N/A — UM NÃO TAXONÔMICA";
const EXPECTED_PATH_COUNT = 10_345;
const EXPECTED_DISTINCT_PATH_COUNT = 10_199;
const EXPECTED_CONVERSION_COUNT = 48;

const FILTER_FIELDS = [
  { id: "sibcs1", sourceColumn: "SiBCS_1", label: "Ordem" },
  { id: "sibcs2", sourceColumn: "SiBCS_2", label: "Subordem" },
  { id: "sibcs3", sourceColumn: "SiBCS_3", label: "Grande grupo" },
  { id: "sibcs4", sourceColumn: "SiBCS_4", label: "Subgrupo" },
  { id: "special1", sourceColumn: "Especial_1", label: "Atividade + textura principal" },
  { id: "special2", sourceColumn: "Especial_2", label: "Arranjo textural" },
  { id: "special3", sourceColumn: "Especial_3", label: "Cascalhosidade + horizonte A + qualificadores" },
  { id: "special4", sourceColumn: "Especial_4", label: "Pedregosidade + rochosidade + relevo + material + fases" },
] as const;

type FilterFieldId = (typeof FILTER_FIELDS)[number]["id"];
type SoilComponent = (typeof SOIL_COMPONENTS)[number] | typeof NON_TAXONOMIC_COMPONENT;

type SoilPath = {
  id: string;
  component: SoilComponent;
  filters: Record<FilterFieldId, string>;
  erosion: {
    className: string;
    index: number | null;
  };
  operational: {
    state: string;
    returnMode: string;
    requiresConfirmation: boolean;
    action: string;
  };
};

type KConversion = {
  weightedIndex: number;
  factorK: number;
  resultClass: string;
};

type ComponentWeights = {
  componentCount: number;
  weights: Record<(typeof SOIL_COMPONENTS)[number], number>;
};

type ComponentErosionIndex = {
  className: string;
  index: number;
};

async function main() {
  const sourceBuffer = await readFile(SOURCE_FILE);
  const workbook = XLSX.read(sourceBuffer, { raw: true });
  const paths = readSoilPaths(workbook);
  const { conversions, weights, componentErosionIndexes } = readKConversion(workbook);

  validateDataset({ paths, conversions, weights, componentErosionIndexes });

  const payload = {
    metadata: {
      sourceFile: path.relative(ROOT_DIR, SOURCE_FILE),
      sourceHashSha256: createHash("sha256").update(sourceBuffer).digest("hex"),
      sourceSheets: {
        paths: PATHS_SHEET,
        conversion: CONVERSION_SHEET,
      },
      generatedAt: new Date().toISOString(),
      pathCount: paths.length,
      distinctPathCount: countDistinctPaths(paths),
      conversionCount: conversions.length,
    },
    components: {
      soil: SOIL_COMPONENTS,
      nonTaxonomic: NON_TAXONOMIC_COMPONENT,
    },
    filters: FILTER_FIELDS.map(({ id, sourceColumn, label }) => ({ id, sourceColumn, label })),
    paths,
    componentErosionIndexes,
    weights,
    kConversion: conversions,
  };

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Base EUPS de solos gerada em ${path.relative(ROOT_DIR, OUTPUT_FILE)}.`);
  console.log(`${paths.length} caminhos (${countDistinctPaths(paths)} distintos), ${conversions.length} conversões de K.`);
}

function readSoilPaths(workbook: XLSX.WorkBook): SoilPath[] {
  const rows = readRows(workbook, PATHS_SHEET);
  const header = getHeaderMap(rows, PATHS_SHEET, [
    "ID_opcao",
    "Componente",
    ...FILTER_FIELDS.map((field) => field.sourceColumn),
    "Erod_Cx",
    "Indice_Erod",
    "Estado_operacional",
    "Modo_retorno",
    "Exige_confirmacao",
    "Acao_TI",
  ]);

  return rows.slice(1).flatMap((row, rowIndex) => {
    const id = readText(row, header, "ID_opcao");
    if (!id) return [];

    const component = readText(row, header, "Componente");
    if (!isSoilComponent(component)) {
      throw new Error(`${PATHS_SHEET}: componente inválido na linha ${rowIndex + 2}: ${component || "vazio"}.`);
    }

    const filters = Object.fromEntries(
      FILTER_FIELDS.map(({ id: fieldId, sourceColumn }) => [fieldId, readRequiredText(row, header, sourceColumn, rowIndex, PATHS_SHEET)]),
    ) as Record<FilterFieldId, string>;

    return [{
      id,
      component,
      filters,
      erosion: {
        className: readText(row, header, "Erod_Cx"),
        index: readOptionalNumber(row, header, "Indice_Erod", rowIndex, PATHS_SHEET),
      },
      operational: {
        state: readRequiredText(row, header, "Estado_operacional", rowIndex, PATHS_SHEET),
        returnMode: readRequiredText(row, header, "Modo_retorno", rowIndex, PATHS_SHEET),
        requiresConfirmation: readRequiredBoolean(row, header, "Exige_confirmacao", rowIndex, PATHS_SHEET),
        action: readRequiredText(row, header, "Acao_TI", rowIndex, PATHS_SHEET),
      },
    }];
  });
}

function readKConversion(workbook: XLSX.WorkBook): { conversions: KConversion[]; weights: ComponentWeights[]; componentErosionIndexes: ComponentErosionIndex[] } {
  const rows = readRows(workbook, CONVERSION_SHEET);
  const headerRow = rows.findIndex((row) => row.map(normalizeHeader).includes(normalizeHeader("Índice ponderado")));
  if (headerRow === -1) {
    throw new Error(`${CONVERSION_SHEET}: cabeçalho de conversão não encontrado.`);
  }

  const header = getHeaderMap(rows.slice(headerRow), CONVERSION_SHEET, [
    "Índice ponderado",
    "Fator K",
    "Classe resultante",
    "Classe do componente",
    "Índice",
    "Nº componentes",
    "Peso C1",
    "Peso C2",
    "Peso C3",
    "Peso C4",
  ]);
  const conversionRows = rows.slice(headerRow + 1);
  const conversions = conversionRows.flatMap((row, rowOffset) => {
    const weightedIndex = readNumber(row, header, "Índice ponderado");
    const factorK = readNumber(row, header, "Fator K");
    if (weightedIndex === null && factorK === null) return [];
    if (weightedIndex === null || factorK === null) {
      throw new Error(`${CONVERSION_SHEET}: conversão incompleta na linha ${headerRow + rowOffset + 2}.`);
    }
    return [{
      weightedIndex,
      factorK,
      resultClass: readRequiredText(row, header, "Classe resultante", headerRow + rowOffset, CONVERSION_SHEET),
    }];
  });
  const weights = conversionRows.flatMap((row, rowOffset) => {
    const componentCount = readNumber(row, header, "Nº componentes");
    if (componentCount === null) return [];
    if (!Number.isInteger(componentCount) || componentCount < 1 || componentCount > 4) {
      throw new Error(`${CONVERSION_SHEET}: número de componentes inválido na linha ${headerRow + rowOffset + 2}.`);
    }
    return [{
      componentCount,
      weights: Object.fromEntries(SOIL_COMPONENTS.map((component) => [component, readRequiredPercentage(row, header, `Peso ${component}`, headerRow + rowOffset, CONVERSION_SHEET)])) as ComponentWeights["weights"],
    }];
  });
  const componentErosionIndexes = conversionRows.flatMap((row, rowOffset) => {
    const className = readText(row, header, "Classe do componente");
    const index = readNumber(row, header, "Índice");
    if (!className && index === null) return [];
    if (!className || index === null) {
      throw new Error(`${CONVERSION_SHEET}: classe ou índice de componente incompleto na linha ${headerRow + rowOffset + 2}.`);
    }
    return [{ className, index }];
  });

  return { conversions, weights, componentErosionIndexes };
}

function validateDataset({ paths, conversions, weights, componentErosionIndexes }: { paths: SoilPath[]; conversions: KConversion[]; weights: ComponentWeights[]; componentErosionIndexes: ComponentErosionIndex[] }) {
  if (paths.length !== EXPECTED_PATH_COUNT) {
    throw new Error(`Banco_8_caixas: esperados ${EXPECTED_PATH_COUNT} caminhos, recebidos ${paths.length}.`);
  }
  if (countDistinctPaths(paths) !== EXPECTED_DISTINCT_PATH_COUNT) {
    throw new Error(`Banco_8_caixas: esperados ${EXPECTED_DISTINCT_PATH_COUNT} caminhos distintos, recebidos ${countDistinctPaths(paths)}.`);
  }
  if (conversions.length !== EXPECTED_CONVERSION_COUNT) {
    throw new Error(`Tabela_K: esperadas ${EXPECTED_CONVERSION_COUNT} conversões, recebidas ${conversions.length}.`);
  }
  if (new Set(conversions.map((item) => item.weightedIndex)).size !== conversions.length) {
    throw new Error("Tabela_K: há índices ponderados duplicados.");
  }
  const expectedIndexes = [1, 2, 3, 4, 5, 6];
  if (componentErosionIndexes.length !== expectedIndexes.length || !expectedIndexes.every((index) => componentErosionIndexes.some((item) => item.index === index)) || new Set(componentErosionIndexes.map((item) => item.className)).size !== expectedIndexes.length) {
    throw new Error("Tabela_K: esperadas seis classes de erodibilidade com índices de 1 a 6.");
  }

  const expectedComponentCounts = [1, 2, 3, 4];
  if (weights.length !== expectedComponentCounts.length || !expectedComponentCounts.every((count) => weights.some((item) => item.componentCount === count))) {
    throw new Error("Tabela_K: pesos para 1, 2, 3 e 4 componentes são obrigatórios.");
  }
  for (const entry of weights) {
    const total = Object.values(entry.weights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(total - 1) > Number.EPSILON) {
      throw new Error(`Tabela_K: pesos de ${entry.componentCount} componentes não totalizam 100%.`);
    }
  }
}

function readRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Aba obrigatória não encontrada: ${sheetName}.`);
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false });
}

function getHeaderMap(rows: unknown[][], sheetName: string, requiredHeaders: string[]): Map<string, number> {
  const headers = rows[0]?.map(normalizeHeader) ?? [];
  const header = new Map(headers.map((value, index) => [value, index]));
  for (const requiredHeader of requiredHeaders) {
    if (!header.has(normalizeHeader(requiredHeader))) {
      throw new Error(`${sheetName}: coluna obrigatória não encontrada: ${requiredHeader}.`);
    }
  }
  return header;
}

function readText(row: unknown[], header: Map<string, number>, column: string): string {
  const index = header.get(normalizeHeader(column));
  return index === undefined ? "" : normalizeText(row[index]);
}

function readRequiredText(row: unknown[], header: Map<string, number>, column: string, rowIndex: number, sheetName: string): string {
  const value = readText(row, header, column);
  if (!value) throw new Error(`${sheetName}: ${column} vazio na linha ${rowIndex + 2}.`);
  return value;
}

function readNumber(row: unknown[], header: Map<string, number>, column: string): number | null {
  const index = header.get(normalizeHeader(column));
  return index === undefined ? null : normalizeNumber(row[index]);
}

function readOptionalNumber(row: unknown[], header: Map<string, number>, column: string, rowIndex: number, sheetName: string): number | null {
  const value = readText(row, header, column);
  if (!value) return null;
  const number = normalizeNumber(value);
  if (number === null) throw new Error(`${sheetName}: ${column} inválido na linha ${rowIndex + 2}.`);
  return number;
}

function readRequiredPercentage(row: unknown[], header: Map<string, number>, column: string, rowIndex: number, sheetName: string): number {
  const index = header.get(normalizeHeader(column));
  const rawValue = index === undefined ? null : row[index];
  const numericValue = normalizeNumber(rawValue);
  const value = normalizeText(rawValue);
  const percentage = typeof rawValue === "number" && numericValue !== null
    ? numericValue
    : value.match(/^(\d+(?:[.,]\d+)?)%$/)
      ? Number(value.slice(0, -1).replace(",", ".")) / 100
      : null;
  if (percentage === null) throw new Error(`${sheetName}: ${column} inválido na linha ${rowIndex + 2}.`);
  if (!Number.isFinite(percentage)) throw new Error(`${sheetName}: ${column} inválido na linha ${rowIndex + 2}.`);
  return percentage;
}

function readRequiredBoolean(row: unknown[], header: Map<string, number>, column: string, rowIndex: number, sheetName: string): boolean {
  const value = normalizeHeader(readText(row, header, column));
  if (value === "sim") return true;
  if (value === "nao") return false;
  throw new Error(`${sheetName}: ${column} inválido na linha ${rowIndex + 2}.`);
}

function normalizeHeader(value: unknown): string {
  return normalizeText(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
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

function isSoilComponent(value: string): value is SoilComponent {
  return value === NON_TAXONOMIC_COMPONENT || SOIL_COMPONENTS.some((component) => component === value);
}

function countDistinctPaths(paths: SoilPath[]): number {
  return new Set(paths.map((entry) => [entry.component, ...FILTER_FIELDS.map(({ id }) => entry.filters[id])].join("\u001F"))).size;
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
