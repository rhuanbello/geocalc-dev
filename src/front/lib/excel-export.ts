import ExcelJS from "exceljs";
import type { MapPoint } from "@/components/MapPicker";
import { CLIMATE_MODEL_LABEL, type LocationSearchResult } from "@/lib/open-meteo";
import type {
  MonthlyWaterBalance,
  WaterBalanceResult,
} from "$/water-balance";
import { formatIsoDatePtBr } from "$/date-format";
import { REFERENCE_SOURCES } from "$/academic";
import {
  inmetStationLabel,
  type InmetNormalPeriod,
  type InmetNormalStation,
} from "$/inmet-normals";

type ExportSourceState = "manual" | "open-meteo" | "inmet";

export type WaterBalanceWorkbookParams = {
  result: WaterBalanceResult;
  location: LocationSearchResult | null;
  point: MapPoint | null;
  startYear: number;
  endYear: number;
  effectiveEndDate: string;
  sourceState: ExportSourceState;
  selectedInmetStation?: InmetNormalStation | null;
  inmetPeriod?: InmetNormalPeriod | null;
  climateModel?: string;
};

const brandDark = "1A3B29";
const brandGreen = "009B6E";
const brandBlue = "6EC1E4";
const textMuted = "54595F";
const lightGreen = "E7F6EF";
const lightBlue = "EAF7FC";
const borderColor = "B9C8BF";

export async function exportWaterBalanceWorkbook(
  params: WaterBalanceWorkbookParams,
) {
  const workbook = createWaterBalanceWorkbook(params);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "geocalc-balanco-hidrico.xlsx";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function createWaterBalanceWorkbook(params: WaterBalanceWorkbookParams) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GeoCalc";
  workbook.lastModifiedBy = "GeoCalc";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = "Balanço hídrico";
  workbook.title = "GeoCalc - Balanço hídrico";

  buildMainSheet(workbook, params);
  buildChartDataSheet(workbook, params.result.rows);
  buildReferencesSheet(workbook);

  return workbook;
}

function buildMainSheet(
  workbook: ExcelJS.Workbook,
  params: WaterBalanceWorkbookParams,
) {
  const sheet = workbook.addWorksheet("Balanço hídrico", {
    views: [{ state: "frozen", ySplit: 17 }],
    properties: { defaultRowHeight: 22 },
  });

  sheet.columns = [
    { key: "a", width: 18 },
    { key: "b", width: 16 },
    { key: "c", width: 16 },
    { key: "d", width: 12 },
    { key: "e", width: 12 },
    { key: "f", width: 14 },
    { key: "g", width: 16 },
    { key: "h", width: 14 },
    { key: "i", width: 14 },
  ];

  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value = "PPG Geoquímica/UFF";
  sheet.getCell("A1").style = titleStyle(18, "FFFFFFFF", brandDark);

  sheet.mergeCells("A2:I2");
  sheet.getCell("A2").value = "GeoCalc - Balanço hídrico";
  sheet.getCell("A2").style = titleStyle(14, "FFFFFFFF", brandGreen);

  sheet.mergeCells("A3:I3");
  sheet.getCell("A3").value =
    "Base técnica e metodológica preparada para o GeoCalc";
  sheet.getCell("A3").style = {
    font: { italic: true, color: { argb: textMuted }, name: "Roboto" },
    alignment: { vertical: "middle", horizontal: "center" },
  };

  sheet.mergeCells("A4:B4");
  sheet.getCell("A4").value = "Local";
  sheet.getCell("C4").value = locationLabel(params.location, params.point);
  sheet.mergeCells("C4:I4");

  sheet.mergeCells("A5:B5");
  sheet.getCell("A5").value = "Coordenadas";
  sheet.getCell("C5").value = params.point
    ? `${formatCoordinate(params.point.latitude)}, ${formatCoordinate(params.point.longitude)}`
    : "Não informado";
  sheet.mergeCells("C5:I5");

  sheet.mergeCells("A6:B6");
  sheet.getCell("A6").value = "Período";
  sheet.getCell("C6").value = `${params.startYear}-${params.endYear}`;
  sheet.mergeCells("C6:I6");

  sheet.mergeCells("A7:B7");
  sheet.getCell("A7").value = "Data final efetiva";
  sheet.getCell("C7").value = formatIsoDatePtBr(params.effectiveEndDate);
  sheet.mergeCells("C7:I7");

  sheet.mergeCells("A8:B8");
  sheet.getCell("A8").value = "Fonte dos dados";
  sheet.getCell("C8").value =
    params.sourceState === "open-meteo"
      ? "Open-Meteo Historical Weather API"
      : params.sourceState === "inmet"
        ? "INMET Normais Climatológicas do Brasil"
        : "Entrada manual";
  sheet.mergeCells("C8:I8");

  sheet.mergeCells("A9:B9");
  sheet.getCell("A9").value =
    params.sourceState === "inmet" ? "Estação INMET" : "Modelo";
  sheet.getCell("C9").value =
    params.sourceState === "inmet" && params.selectedInmetStation
      ? inmetStationLabel(params.selectedInmetStation)
      : params.climateModel ?? CLIMATE_MODEL_LABEL;
  sheet.mergeCells("C9:I9");

  sheet.mergeCells("A10:B10");
  sheet.getCell("A10").value = "Data de geração";
  sheet.getCell("C10").value = formatIsoDatePtBr(new Date().toISOString().slice(0, 10));
  sheet.mergeCells("C10:I10");

  applyInfoBlockStyle(sheet, 4, 10);

  sheet.getCell("A11").value = "Resumo anual";
  sheet.getCell("A11").style = sectionStyle();
  sheet.mergeCells("A11:I11");

  const summaryRows = [
    ["P anual", params.result.annual.precipitationTotal, "mm"],
    ["ETP corrigida total", params.result.annual.correctedEtpTotal, "mm"],
    ["BH anual", params.result.annual.balanceTotal, "mm"],
    ["Índice calorimétrico anual I", params.result.annual.annualHeatIndex, ""],
    ["Expoente a", params.result.annual.exponentA, ""],
  ];

  summaryRows.forEach((row, index) => {
    const rowNumber = 12 + index;
    sheet.getCell(`A${rowNumber}`).value = row[0] as string;
    sheet.getCell(`B${rowNumber}`).value = row[1] as number | null;
    sheet.getCell(`C${rowNumber}`).value = row[2] as string;
    sheet.getCell(`B${rowNumber}`).numFmt = "0.0";
  });
  styleRange(sheet, 12, 16, 1, 3);

  const headerRowNumber = 18;
  const headers = [
    "Mês",
    "P (mm)",
    "T (°C)",
    "Fator",
    "i",
    "ETP",
    "ETP corr.",
    "SH",
    "DH",
  ];
  sheet.getRow(headerRowNumber).values = headers;
  styleHeaderRow(sheet.getRow(headerRowNumber));

  params.result.rows.forEach((row, index) => {
    const rowNumber = headerRowNumber + 1 + index;
    sheet.getRow(rowNumber).values = [
      row.monthName,
      row.precipitation,
      row.temperature,
      row.correctionFactor,
      row.monthlyHeatIndex,
      row.etp,
      row.correctedEtp,
      row.balance !== null && row.balance > 0 ? row.balance : null,
      row.balance !== null && row.balance < 0 ? row.balance : null,
    ];
    styleCalculationRow(sheet.getRow(rowNumber));
  });

  const legendStart = 33;
  sheet.getCell(`A${legendStart}`).value = "Legenda, metodologia e interpretação";
  sheet.getCell(`A${legendStart}`).style = sectionStyle();
  sheet.mergeCells(`A${legendStart}:I${legendStart}`);

  const sourceLegend =
    params.sourceState === "inmet"
      ? [
          "INMET",
          `Dados mensais provenientes das Normais Climatológicas do Brasil ${params.inmetPeriod ?? "1991-2020"} para a estação selecionada. A tabela continua editável após o preenchimento.`,
        ]
      : [
          "Open-Meteo",
          `Quando os dados são importados, a API fornece série diária do modelo ${params.climateModel ?? CLIMATE_MODEL_LABEL}; o GeoCalc soma a precipitação diária por mês, calcula a média das temperaturas médias diárias e faz a média dos mesmos meses em anos válidos.`,
        ];
  const legendRows = [
    ["P", "Precipitação mensal acumulada, em milímetros."],
    ["T", "Temperatura média mensal, em graus Celsius."],
    ["FC", "Fator de correção mensal associado ao hemisfério e à latitude."],
    ["i", "Índice calorimétrico mensal calculado por i = (T / 5)^1,514."],
    ["I", "Soma anual dos índices calorimétricos mensais."],
    ["a", "Expoente anual usado na fórmula de Thornthwaite."],
    ["ETP", "Evapotranspiração potencial mensal antes da correção."],
    ["ETP corrigida", "ETP multiplicada pelo fator mensal de correção."],
    ["BH", "Balanço hídrico mensal: BH = P - ETP corrigida."],
    ["SH", "Superávit hídrico: valores positivos de BH."],
    ["DH", "Déficit hídrico: valores negativos de BH."],
    sourceLegend,
  ];

  legendRows.forEach(([term, description], index) => {
    const rowNumber = legendStart + 1 + index;
    sheet.getCell(`A${rowNumber}`).value = term;
    sheet.getCell(`B${rowNumber}`).value = description;
    sheet.mergeCells(`B${rowNumber}:I${rowNumber}`);
  });
  styleRange(sheet, legendStart + 1, legendStart + legendRows.length, 1, 9);

  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber + 12, column: 9 },
  };
}

function buildReferencesSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Referências e fontes", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { key: "source", width: 34 },
    { key: "description", width: 72 },
    { key: "link", width: 64 },
  ];

  sheet.getRow(1).values = ["Fonte", "Descrição", "Link"];
  styleHeaderRow(sheet.getRow(1));

  REFERENCE_SOURCES.forEach((source, index) => {
    const rowNumber = index + 2;
    sheet.getCell(`A${rowNumber}`).value = source.label;
    sheet.getCell(`B${rowNumber}`).value = source.description;
    if (source.href) {
      sheet.getCell(`C${rowNumber}`).value = {
        text: source.href,
        hyperlink: source.href,
      };
      sheet.getCell(`C${rowNumber}`).font = {
        color: { argb: brandGreen },
        underline: true,
        name: "Roboto",
      };
    } else {
      sheet.getCell(`C${rowNumber}`).value = "Referência pendente de validação";
    }
  });

  const accessRow = REFERENCE_SOURCES.length + 4;
  sheet.getCell(`A${accessRow}`).value = "Data de geração/acesso";
  sheet.getCell(`B${accessRow}`).value = formatIsoDatePtBr(new Date().toISOString().slice(0, 10));
  sheet.mergeCells(`B${accessRow}:C${accessRow}`);
  styleRange(sheet, 2, accessRow, 1, 3);
}

function buildChartDataSheet(
  workbook: ExcelJS.Workbook,
  rows: MonthlyWaterBalance[],
) {
  const sheet = workbook.addWorksheet("Dados para gráfico", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { key: "month", width: 18 },
    { key: "precipitation", width: 16 },
    { key: "correctedEtp", width: 22 },
    { key: "balance", width: 16 },
  ];

  sheet.getRow(1).values = [
    "Mês",
    "P (mm)",
    "ETP corrigida (mm)",
    "BH (mm)",
  ];
  styleHeaderRow(sheet.getRow(1));

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    sheet.getRow(rowNumber).values = [
      row.monthName,
      row.precipitation,
      row.correctedEtp,
      row.balance,
    ];
    styleCalculationRow(sheet.getRow(rowNumber));
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 13, column: 4 },
  };
}

function locationLabel(
  location: LocationSearchResult | null,
  point?: MapPoint | null,
): string {
  if (!location) {
    return point ? "Coordenada selecionada no mapa" : "Sem local selecionado";
  }

  return [location.name, location.admin1, location.country]
    .filter(Boolean)
    .join(", ");
}

function formatCoordinate(value: number): string {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  });
}

function titleStyle(
  size: number,
  fontColor: string,
  fillColor: string,
): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size, color: { argb: fontColor }, name: "Roboto Slab" },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillColor },
    },
    alignment: { vertical: "middle", horizontal: "center" },
  };
}

function sectionStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, color: { argb: brandDark }, name: "Roboto Slab" },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: lightGreen },
    },
    alignment: { vertical: "middle", horizontal: "left" },
    border: bottomBorder(),
  };
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.height = 26;
  row.eachCell((cell) => {
    cell.style = {
      font: { bold: true, color: { argb: "FFFFFFFF" }, name: "Roboto" },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: brandGreen },
      },
      alignment: { vertical: "middle", horizontal: "center" },
      border: fullBorder(),
    };
  });
}

function styleCalculationRow(row: ExcelJS.Row) {
  row.eachCell((cell, columnNumber) => {
    cell.style = {
      font: { color: { argb: columnNumber === 1 ? brandDark : textMuted } },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: columnNumber === 1 ? lightBlue : "FFFFFFFF" },
      },
      alignment: {
        vertical: "middle",
        horizontal: columnNumber === 1 ? "left" : "right",
      },
      border: fullBorder(),
      numFmt: columnNumber === 1 ? undefined : "0.0",
    };
  });
}

function applyInfoBlockStyle(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.border = bottomBorder();
      cell.alignment = { vertical: "middle", horizontal: "left" };

      if (columnNumber <= 2) {
        cell.font = { bold: true, color: { argb: brandDark } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: lightBlue },
        };
      }
    });
  }
}

function styleRange(
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
      cell.border = fullBorder();
      cell.alignment = {
        vertical: "middle",
        horizontal: columnNumber === startColumn ? "left" : "left",
        wrapText: true,
      };
    }
  }
}

function fullBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: borderColor } },
    left: { style: "thin", color: { argb: borderColor } },
    bottom: { style: "thin", color: { argb: borderColor } },
    right: { style: "thin", color: { argb: borderColor } },
  };
}

function bottomBorder(): Partial<ExcelJS.Borders> {
  return {
    bottom: { style: "thin", color: { argb: borderColor } },
  };
}
