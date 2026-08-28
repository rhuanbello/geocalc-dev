import ExcelJS from "exceljs";
import type { EupsResult } from "$/eups";
import type { FcpsResult } from "$/fcps";
import { formatIsoDatePtBr } from "$/date-format";

const green = "FF009B6E";
const dark = "FF1A3B29";
const light = "FFF0FAF5";

type EupsWorkbookParams = {
  result: EupsResult;
  k: number | null;
  slopeLength: number | null;
  slopePercent: number | null;
  cp: number | null;
  soilReferenceLabel: string;
  cpReferenceLabel: string;
  fcps: FcpsResult;
};

export function createEupsWorkbook(params: EupsWorkbookParams): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GeoCalc";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("EUPS", { views: [{ state: "frozen", ySplit: 12 }] });
  sheet.columns = [{ width: 24 }, { width: 20 }, { width: 25 }, { width: 26 }, { width: 20 }];

  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = "PPG Geoquímica/UFF";
  sheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14, name: "Roboto Slab" };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: dark } };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.mergeCells("A2:E2");
  sheet.getCell("A2").value = "GeoCalc — Equação Universal de Perda de Solo (EUPS)";
  sheet.getCell("A2").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: dark } };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.getCell("A4").value = "Método";
  sheet.getCell("B4").value = "Cálculo manual com 12 precipitações mensais";
  sheet.mergeCells("B4:E4");
  sheet.getCell("A5").value = "Data de geração";
  sheet.getCell("B5").value = formatIsoDatePtBr(new Date().toISOString().slice(0, 10));
  sheet.mergeCells("B5:E5");

  sheet.mergeCells("A7:E7");
  sheet.getCell("A7").value = "Fatores e resultados";
  styleSection(sheet.getRow(7));
  const factorRows = [
    ["Referência de solo", params.soilReferenceLabel, "Apoio didático da Tabela de referência EUPS"],
    ["K", params.k, "Erodibilidade do solo"],
    ["R", params.result.rainfallErosivity, "Erosividade calculada pelas chuvas mensais"],
    ["L", params.slopeLength, "Comprimento horizontal da vertente (m)"],
    ["S", params.slopePercent, "Declividade (%)"],
    ["LS", params.result.topographicFactor, "Fator topográfico"],
    ["Referência de CP", params.cpReferenceLabel, "Apoio didático da Tabela de referência EUPS"],
    ["CP", params.cp, "Cobertura, manejo e conservação"],
    ["PS", params.result.soilLoss, "Perda média anual estimada de solo"],
    ["Classificação", params.result.classification, "Baixa < 10; Média 10–25; Alta > 25"],
  ];
  factorRows.forEach(([factor, value, description], index) => {
    const row = index + 8;
    sheet.getCell(`A${row}`).value = factor;
    sheet.getCell(`B${row}`).value = value as string | number | null;
    if (typeof value === "number") sheet.getCell(`B${row}`).numFmt = "0.000";
    sheet.getCell(`C${row}`).value = description;
    sheet.mergeCells(`C${row}:E${row}`);
  });

  const header = 19;
  sheet.getRow(header).values = ["Mês", "Precipitação r (mm)", "I30", "", ""];
  styleHeader(sheet.getRow(header));
  params.result.rows.forEach((row, index) => {
    const target = header + index + 1;
    sheet.getCell(`A${target}`).value = row.monthName;
    sheet.getCell(`B${target}`).value = row.precipitation;
    sheet.getCell(`C${target}`).value = row.erosivityIndex;
    sheet.getCell(`B${target}`).numFmt = "0.0";
    sheet.getCell(`C${target}`).numFmt = "0.000";
  });
  sheet.getCell("A32").value = "Precipitação anual (P)";
  sheet.getCell("B32").value = params.result.precipitationTotal;
  sheet.getCell("A33").value = "Erosividade anual (R)";
  sheet.getCell("B33").value = params.result.rainfallErosivity;
  [32, 33].forEach((row) => {
    sheet.getCell(`B${row}`).numFmt = "0.000";
    sheet.getRow(row).font = { bold: true, color: { argb: dark } };
  });

  const notesStart = 35;
  sheet.mergeCells(`A${notesStart}:E${notesStart}`);
  sheet.getCell(`A${notesStart}`).value = "Metodologia e referências";
  styleSection(sheet.getRow(notesStart));
  [
    "PS = K × R × LS × CP.",
    "LS = 0,00984 × L^0,63 × S^1,18.",
    "I30 = 67,355 × ((r² / P)^0,85); R = ΣI30.",
    "Base de cálculo: Tabela de referência EUPS; Wischmeier e Smith (1965), USDA Agriculture Handbook No. 282.",
    "Esta versão não consulta fontes espaciais e não calcula transporte ou sedimentação.",
  ].forEach((note, index) => {
    const row = notesStart + 1 + index;
    sheet.getCell(`A${row}`).value = note;
    sheet.mergeCells(`A${row}:E${row}`);
  });

  const fcpsRows: number[] = [];
  if (params.fcps.status === "complete") {
    const fcpsStart = notesStart + 7;
    sheet.mergeCells(`A${fcpsStart}:E${fcpsStart}`);
    sheet.getCell(`A${fcpsStart}`).value = "Análise complementar — FCPS";
    styleSection(sheet.getRow(fcpsStart));
    [
      ["PS", params.fcps.soilLoss, "t/ha/ano", "Perda de solo calculada pela EUPS"],
      ["CCS", params.fcps.concentration, "mg/kg", "Concentração manual no solo"],
      ["QCPS", params.fcps.quantity, "kg/ha/ano", "Massa potencial associada ao solo perdido"],
    ].forEach(([factor, value, unit, description], index) => {
      const row = fcpsStart + 1 + index;
      fcpsRows.push(row);
      sheet.getCell(`A${row}`).value = factor;
      sheet.getCell(`B${row}`).value = value as number;
      sheet.getCell(`B${row}`).numFmt = "0.00000";
      sheet.getCell(`C${row}`).value = unit;
      sheet.getCell(`D${row}`).value = description;
      sheet.mergeCells(`D${row}:E${row}`);
    });
    const formulaRow = fcpsStart + 4;
    fcpsRows.push(formulaRow);
    sheet.getCell(`A${formulaRow}`).value = "Fórmula";
    sheet.getCell(`B${formulaRow}`).value = "QCPS = PS × CCS × 10⁻³";
    sheet.mergeCells(`B${formulaRow}:E${formulaRow}`);
  }

  [4, 5, ...Array.from({ length: 10 }, (_, index) => 8 + index), ...Array.from({ length: 12 }, (_, index) => 20 + index), 32, 33, ...Array.from({ length: 5 }, (_, index) => notesStart + 1 + index), ...fcpsRows].forEach((row) => {
    sheet.getRow(row).eachCell((cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: "FFCFDDD5" } } };
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });

  return workbook;
}

export async function exportEupsWorkbook(params: EupsWorkbookParams) {
  const workbook = createEupsWorkbook(params);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "geocalc-eups.xlsx";
  anchor.click();
  URL.revokeObjectURL(url);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Roboto" };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } };
  row.alignment = { horizontal: "center", vertical: "middle" };
}

function styleSection(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: dark }, name: "Roboto Slab" };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: light } };
}
