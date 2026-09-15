import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as XLSX from "xlsx";

const DEFAULT_INPUT = "context/files/module-02-eups/ricardo/correspondencia_ibge_sibcs_erodibilidade.xlsx";
const DEFAULT_OUTPUT = "src/shared/data/eups-erodibility-index.json";

type RawRow = Record<string, string | number | null>;

const args = process.argv.slice(2);
const inputPath = resolve(readOption("--input") ?? DEFAULT_INPUT);
const outputPath = resolve(readOption("--output") ?? DEFAULT_OUTPUT);

const workbook = XLSX.readFile(inputPath, { raw: true });
const records = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets.Banco_8_caixas, { defval: null })
  .map(toRecord)
  .filter((record): record is GeneratedRecord => record !== null);
const conversion = readConversion(workbook.Sheets.Tabela_K);

if (records.length === 0 || conversion.length === 0) {
  throw new Error("A planilha não contém o Banco_8_caixas ou a Tabela_K esperados.");
}

const inputHash = createHash("sha256").update(await readFile(inputPath)).digest("hex");
const payload = {
  source: {
    file: "correspondencia_ibge_sibcs_erodibilidade.xlsx",
    sha256: inputHash,
    recordCount: records.length,
  },
  records,
  conversion,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload)}\n`);
console.log(`Gerados ${records.length} caminhos e ${conversion.length} conversões em ${outputPath}`);

function readOption(name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

type GeneratedRecord = {
  c: number;
  r: "SOLOS" | "UNIDADES NÃO TAXONÔMICAS";
  v: string[];
  s: "automatic" | "blocked" | "not-applicable";
  e: string;
  i: number | null;
  m: string;
};

function toRecord(row: RawRow): GeneratedRecord | null {
  const component = Number(String(row.Componente ?? "").replace("C", ""));
  if (![1, 2, 3, 4].includes(component)) return null;

  const mode = String(row.Modo_retorno ?? "");
  const index = numberOrNull(row.Indice_Erod);
  const state: GeneratedRecord["s"] = mode === "AUTOMÁTICO" && index !== null
    ? "automatic"
    : mode === "RAMO NÃO TAXONÔMICO"
      ? "not-applicable"
      : "blocked";

  const firstLevel = String(row.SiBCS_1 ?? "");
  return {
    c: component,
    r: firstLevel === "OUTROS" ? "UNIDADES NÃO TAXONÔMICAS" : "SOLOS",
    v: ["SiBCS_1", "SiBCS_2", "SiBCS_3", "SiBCS_4", "Especial_1", "Especial_2", "Especial_3", "Especial_4"].map((key) => String(row[key] ?? "")),
    s: state,
    e: String(row.Erod_Cx ?? ""),
    i: index,
    m: String(row.Acao_TI ?? ""),
  };
}

function readConversion(sheet: XLSX.WorkSheet): Array<{ i: number; k: number; c: string }> {
  const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, { header: 1, defval: null });
  const headerIndex = rows.findIndex((row) => row[0] === "Índice ponderado" && row[1] === "Fator K");
  if (headerIndex === -1) throw new Error("Cabeçalho da Tabela_K não encontrado.");

  return rows.slice(headerIndex + 1)
    .map((row) => ({ i: numberOrNull(row[0]), k: numberOrNull(row[1]), c: String(row[2] ?? "") }))
    .filter((row): row is { i: number; k: number; c: string } => row.i !== null && row.k !== null);
}

function numberOrNull(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
