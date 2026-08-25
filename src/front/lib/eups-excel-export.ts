import ExcelJS from "exceljs";
import type { EupsResult } from "$/eups";
import { formatIsoDatePtBr } from "$/date-format";
import type { LocationSearchResult } from "@/lib/open-meteo";
import type { MapPoint } from "@/components/MapPicker";

const green = "FF009B6E";
const dark = "FF1A3B29";
const light = "FFF0FAF5";

type EupsWorkbookParams = {
  result: EupsResult;
  location: LocationSearchResult | null;
  point: MapPoint | null;
  slopeLineLength: number | null;
  k: number | null;
  slopePercent: number | null;
  cp: number | null;
  rainfallMethod: "spatial" | "precipitation";
  spatialR: number | null;
};

export function createEupsWorkbook(params: EupsWorkbookParams): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GeoCalc";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("EUPS", { views: [{ state: "frozen", ySplit: 15 }] });
  sheet.columns = [
    { width: 21 }, { width: 18 }, { width: 18 }, { width: 20 },
    { width: 20 }, { width: 20 }, { width: 20 },
  ];

  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = "PPG Geoquímica/UFF";
  sheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14, name: "Roboto Slab" };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: dark } };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.mergeCells("A2:G2");
  sheet.getCell("A2").value = "GeoCalc - Equação Universal de Perda de Solo (EUPS)";
  sheet.getCell("A2").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: dark } };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  const locationName = params.location
    ? [params.location.name, params.location.admin1, params.location.country].filter(Boolean).join(", ")
    : "Não informado";
  const coordinateLabel = params.point
    ? `${params.point.latitude.toFixed(5)}, ${params.point.longitude.toFixed(5)}`
    : "Não informado";
  const details = [
    ["Local", locationName],
    ["Coordenadas", coordinateLabel],
    ["Método de R", params.rainfallMethod === "spatial" ? "Mapa de erosividade da Embrapa (consulta em validação)" : "Estimativa por precipitação mensal"],
    ["Linha da vertente", params.slopeLineLength === null ? "Não medida" : `${params.slopeLineLength.toFixed(1)} m`],
    ["Data de geração", formatIsoDatePtBr(new Date().toISOString().slice(0, 10))],
  ];
  details.forEach(([label, value], index) => {
    const row = index + 4;
    sheet.getCell(`A${row}`).value = label;
    sheet.getCell(`B${row}`).value = value;
    sheet.mergeCells(`B${row}:G${row}`);
  });

  sheet.mergeCells("A10:G10");
  sheet.getCell("A10").value = "Fatores e resultados";
  styleSection(sheet.getRow(10));
  const factorRows = [
    ["K", params.k, "Erodibilidade do solo"],
    ["R", params.result.rainfallErosivity, "Erosividade da chuva"],
    ["L", params.slopeLineLength, "Comprimento da vertente (m)"],
    ["S", params.slopePercent, "Declividade (%)"],
    ["LS", params.result.topographicFactor, "Fator topográfico"],
    ["CP", params.cp, "Cobertura, manejo e conservação"],
    ["PNE", params.result.naturalErosionPotential, "Potencial natural de erosão"],
    ["PS", params.result.soilLoss, "Perda média anual estimada de solo"],
  ];
  factorRows.forEach(([factor, value, description], index) => {
    const row = index + 11;
    sheet.getCell(`A${row}`).value = factor;
    sheet.getCell(`B${row}`).value = value as number | null;
    sheet.getCell(`B${row}`).numFmt = "0.000";
    sheet.getCell(`C${row}`).value = description;
    sheet.mergeCells(`C${row}:G${row}`);
  });

  const header = 21;
  sheet.getRow(header).values = ["Mês", "Precipitação (mm)", "I30", "", "", "", ""];
  styleHeader(sheet.getRow(header));
  params.result.rows.forEach((row, index) => {
    const target = header + index + 1;
    sheet.getCell(`A${target}`).value = row.monthName;
    sheet.getCell(`B${target}`).value = row.precipitation;
    sheet.getCell(`C${target}`).value = row.erosivityIndex;
    sheet.getCell(`B${target}`).numFmt = "0.0";
    sheet.getCell(`C${target}`).numFmt = "0.000";
  });

  const notesStart = 35;
  sheet.mergeCells(`A${notesStart}:G${notesStart}`);
  sheet.getCell(`A${notesStart}`).value = "Metodologia e referências";
  styleSection(sheet.getRow(notesStart));
  const notes = [
    "PS = K × R × LS × CP.",
    "LS = 0,00984 × L^0,63 × S^1,18.",
    "PNE = R × K × LS; PS considera adicionalmente CP.",
    "A estimativa de R por precipitação usa I30 = 67,355 × ((r² / P)^0,85).",
    "Fontes espaciais previstas: Embrapa (R e K) e TOPODATA/INPE (S). Valores espaciais devem ser revisados antes do uso.",
    "Referência: Wischmeier e Smith; base de cálculo da EUPS fornecida ao GeoCalc.",
  ];
  notes.forEach((note, index) => {
    const row = notesStart + 1 + index;
    sheet.getCell(`A${row}`).value = note;
    sheet.mergeCells(`A${row}:G${row}`);
  });

  [4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, ...Array.from({ length: 12 }, (_, index) => 22 + index), ...Array.from({ length: notes.length }, (_, index) => notesStart + 1 + index)].forEach((row) => {
    sheet.getRow(row).eachCell((cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: "FFCFDDD5" } } };
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });

  const chart = workbook.addWorksheet("Dados para gráfico");
  chart.columns = [{ width: 18 }, { width: 22 }, { width: 22 }];
  chart.getRow(1).values = ["Mês", "Precipitação (mm)", "I30"];
  styleHeader(chart.getRow(1));
  params.result.rows.forEach((row, index) => {
    chart.getRow(index + 2).values = [row.monthName, row.precipitation, row.erosivityIndex];
  });

  return workbook;
}

export async function exportEupsWorkbook(params: EupsWorkbookParams) {
  const workbook = createEupsWorkbook(params);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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
