import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const root = process.cwd();
const output = path.join(root, "docs/gerados/geocalc-reuniao-bida-10-08-2026.pdf");
const logoPath = path.join(root, "public/brand/logo-geoquimica-colorido.png");

const width = 960;
const height = 540;
const colors = {
  green: hex("1A3B29"),
  greenMid: hex("009B6E"),
  greenLight: hex("61CE70"),
  mint: hex("E7F6EF"),
  paper: hex("F7FAF8"),
  ink: hex("24352B"),
  muted: hex("64716A"),
  line: hex("CFDDD5"),
  white: rgb(1, 1, 1),
  warm: hex("FFFDF8"),
  alert: hex("D87836"),
};

type TextStyle = {
  font: PDFFont;
  size: number;
  color: ReturnType<typeof rgb>;
  lineHeight?: number;
};

function hex(value: string) {
  const normalized = value.replace("#", "");
  return rgb(
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  );
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function text(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  style: TextStyle,
  maxWidth?: number,
) {
  const lineHeight = style.lineHeight ?? style.size * 1.35;
  const lines = maxWidth ? wrap(value, style.font, style.size, maxWidth) : [value];
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      font: style.font,
      size: style.size,
      color: style.color,
    });
  });
  return y - lines.length * lineHeight;
}

function pageBase(page: PDFPage, slide: number, title: string, sans: PDFFont, serif: PDFFont) {
  page.drawRectangle({ x: 0, y: 0, width, height, color: colors.paper });
  page.drawRectangle({ x: 0, y: height - 14, width, height: 14, color: colors.green });
  page.drawRectangle({ x: 42, y: 48, width: width - 84, height: 1, color: colors.line });
  text(page, "GEOCALC", 42, 512, { font: sans, size: 8, color: colors.greenMid });
  text(page, title, 42, 478, { font: serif, size: 26, color: colors.green });
  text(page, "PPG Geoquímica / UFF", 42, 27, { font: sans, size: 8, color: colors.muted });
  text(page, `Reunião de alinhamento | 10/08/2026 | ${slide}/8`, 676, 27, {
    font: sans,
    size: 8,
    color: colors.muted,
  });
}

function card(page: PDFPage, x: number, y: number, w: number, h: number, accent = colors.greenMid) {
  page.drawRectangle({ x, y, width: w, height: h, color: colors.white, borderColor: colors.line, borderWidth: 1 });
  page.drawRectangle({ x, y: y + h - 5, width: w, height: 5, color: accent });
}

function bulletList(
  page: PDFPage,
  items: string[],
  x: number,
  y: number,
  maxWidth: number,
  sans: PDFFont,
  size = 13,
) {
  let cursor = y;
  for (const item of items) {
    page.drawRectangle({ x, y: cursor - 5, width: 6, height: 6, color: colors.greenMid });
    cursor = text(page, item, x + 16, cursor, { font: sans, size, color: colors.ink, lineHeight: size * 1.42 }, maxWidth - 16) - 9;
  }
}

function stage(page: PDFPage, x: number, y: number, label: string, detail: string, number: string, sans: PDFFont, serif: PDFFont) {
  page.drawRectangle({ x, y, width: 194, height: 112, color: colors.white, borderColor: colors.line, borderWidth: 1 });
  page.drawRectangle({ x: x + 15, y: y + 72, width: 31, height: 25, color: colors.mint });
  text(page, number, x + 24, y + 79, { font: sans, size: 10, color: colors.greenMid });
  text(page, label, x + 15, y + 51, { font: serif, size: 15, color: colors.green });
  text(page, detail, x + 15, y + 29, { font: sans, size: 10, color: colors.muted, lineHeight: 13 }, 164);
}

async function main() {
  const pdf = await PDFDocument.create();
  pdf.setTitle("GeoCalc - Balanço Hídrico");
  pdf.setAuthor("GeoCalc / PPG Geoquímica UFF");
  pdf.setSubject("Reunião de alinhamento");

  const [sans, sansBold, serif, serifBold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
    pdf.embedFont(StandardFonts.TimesRoman),
    pdf.embedFont(StandardFonts.TimesRomanBold),
  ]);
  const logo = await pdf.embedPng(await readFile(logoPath));

  // 1. Capa
  {
    const page = pdf.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: colors.green });
    page.drawRectangle({ x: 664, y: -102, width: 320, height: 320, borderColor: hex("4D8B62"), borderWidth: 1, rotate: { type: "degrees", angle: 45 } });
    page.drawRectangle({ x: 758, y: 318, width: 204, height: 146, color: colors.warm });
    page.drawImage(logo, { x: 780, y: 348, width: 160, height: 74 });
    text(page, "GEOCALC", 72, 451, { font: sansBold, size: 11, color: colors.greenLight });
    text(page, "Balanço Hídrico", 72, 380, { font: serifBold, size: 46, color: colors.warm });
    text(page, "dados, cálculo e validação", 72, 335, { font: serif, size: 28, color: hex("CBE9D0") });
    text(page, "Material de apoio para reunião de alinhamento", 72, 250, { font: sans, size: 16, color: hex("DDEADF") });
    text(page, "10 de agosto de 2026", 72, 220, { font: sans, size: 12, color: hex("A9C9B0") });
    text(page, "PPG Geoquímica / UFF", 72, 72, { font: sansBold, size: 11, color: colors.warm });
  }

  // 2. Plataforma
  {
    const page = pdf.addPage([width, height]);
    pageBase(page, 2, "O que o GeoCalc já entrega", sans, serifBold);
    const items = [
      "Uma calculadora web para transformar o Balanço Hídrico de planilha em atividade explorável.",
      "Tabela mensal com precipitação, temperatura, Etp, Etp corrigida, BH, superávit e déficit.",
      "Mapa, busca por estação ou local, gráfico, síntese dos resultados e exportação para Excel.",
      "Explicações de método antes da prática, para que a pessoa entenda o que está calculando.",
    ];
    bulletList(page, items, 62, 406, 478, sans, 15);
    card(page, 588, 244, 296, 184, colors.greenLight);
    text(page, "Ideia central", 614, 391, { font: serifBold, size: 22, color: colors.green });
    text(page, "Usar dados reais para discutir água, clima e território com transparência sobre a origem dos dados.", 614, 352, { font: sans, size: 15, color: colors.ink, lineHeight: 22 }, 236);
    text(page, "Não substitui a análise técnica; organiza e torna visível o caminho do cálculo.", 614, 274, { font: sans, size: 11, color: colors.muted, lineHeight: 16 }, 236);
  }

  // 3. Dados
  {
    const page = pdf.addPage([width, height]);
    pageBase(page, 3, "De onde vêm os dados", sans, serifBold);
    card(page, 54, 200, 398, 220, colors.greenMid);
    text(page, "INMET", 78, 374, { font: serifBold, size: 27, color: colors.green });
    text(page, "Fonte principal", 78, 345, { font: sansBold, size: 12, color: colors.greenMid });
    bulletList(page, [
      "Normais climatológicas por estação meteorológica.",
      "Períodos disponíveis: 1961-1990, 1981-2010 e 1991-2020.",
      "Ao selecionar uma estação completa, a tabela é preenchida automaticamente.",
    ], 78, 314, 330, sans, 12);
    card(page, 508, 200, 398, 220, colors.greenLight);
    text(page, "Open-Meteo / ERA5", 532, 374, { font: serifBold, size: 27, color: colors.green });
    text(page, "Alternativa por coordenada", 532, 345, { font: sansBold, size: 12, color: colors.greenMid });
    bulletList(page, [
      "Útil quando não há estação INMET adequada ou quando se quer uma coordenada livre.",
      "A fonte devolve dados diários que são transformados em valores mensais.",
      "Sempre identificado no resultado e no Excel exportado.",
    ], 532, 314, 330, sans, 12);
  }

  // 4. Método
  {
    const page = pdf.addPage([width, height]);
    pageBase(page, 4, "Como chegamos ao Balanço Hídrico", sans, serifBold);
    stage(page, 48, 258, "Dados mensais", "Precipitação (P) e temperatura média (t).", "01", sans, serifBold);
    stage(page, 272, 258, "Evapotranspiração", "A fórmula de Thornthwaite estima a Etp a partir da temperatura.", "02", sans, serifBold);
    stage(page, 496, 258, "Correção", "A Etp recebe um fator associado à latitude, ao hemisfério e ao mês.", "03", sans, serifBold);
    stage(page, 720, 258, "Resultado", "BH = precipitação menos Etp corrigida. Pode haver SH ou DH.", "04", sans, serifBold);
    text(page, "BH = P - Etp corrigida", 300, 185, { font: serifBold, size: 30, color: colors.green });
    text(page, "Fator de correção: a tabela original foi preservada a cada 10 graus. Para aproximar melhor a latitude real, o GeoCalc cria posições intermediárias de 5 graus pela média entre as linhas vizinhas. Exemplo: 23 graus usa 25 graus.", 92, 135, { font: sans, size: 12, color: colors.muted, lineHeight: 17 }, 776);
  }

  // 5. Validação
  {
    const page = pdf.addPage([width, height]);
    pageBase(page, 5, "O que a validação INMET x ERA5 compara", sans, serifBold);
    text(page, "A pergunta é simples: quando usamos ERA5 na coordenada de uma estação, a normal calculada se aproxima da normal observada pelo INMET?", 60, 412, { font: sans, size: 17, color: colors.ink, lineHeight: 24 }, 818);
    card(page, 60, 184, 244, 164, colors.greenMid);
    text(page, "INMET", 84, 309, { font: serifBold, size: 25, color: colors.green });
    text(page, "Normal climatológica\npor estação", 84, 271, { font: sans, size: 14, color: colors.ink, lineHeight: 19 });
    text(page, "Referência observacional", 84, 215, { font: sansBold, size: 10, color: colors.greenMid });
    page.drawRectangle({ x: 334, y: 257, width: 256, height: 4, color: colors.greenLight });
    text(page, "mesma latitude e longitude\nda estação", 378, 282, { font: sansBold, size: 12, color: colors.green, lineHeight: 17 });
    card(page, 646, 184, 244, 164, colors.greenLight);
    text(page, "ERA5", 670, 309, { font: serifBold, size: 25, color: colors.green });
    text(page, "Série diária de 1991 a 2020\ntransformada em normal mensal", 670, 271, { font: sans, size: 14, color: colors.ink, lineHeight: 19 });
    text(page, "Reanálise por coordenada", 670, 215, { font: sansBold, size: 10, color: colors.greenMid });
    text(page, "As duas fontes passam pelo mesmo cálculo de Thornthwaite e pelo mesmo fator de latitude. Assim, a diferença final mostra o efeito das diferenças de chuva e temperatura entre as fontes.", 110, 126, { font: sans, size: 13, color: colors.muted, lineHeight: 18 }, 740);
  }

  // 6. Resultados
  {
    const page = pdf.addPage([width, height]);
    pageBase(page, 6, "O que encontramos até agora", sans, serifBold);
    text(page, "109 estações completas | 1.308 comparações mensais | normal 1991-2020", 52, 417, { font: sansBold, size: 14, color: colors.greenMid });
    const metrics = [
      { label: "Precipitação anual", value: "-148,1 mm", note: "ERA5 abaixo do INMET, em média", bar: 148.1, color: colors.alert },
      { label: "Temperatura média", value: "+0,18 °C", note: "ERA5 acima do INMET, em média", bar: 18, color: colors.greenMid },
      { label: "BH anual", value: "-173,6 mm", note: "ERA5 abaixo do INMET, em média", bar: 173.6, color: colors.alert },
    ];
    metrics.forEach((metric, index) => {
      const x = 58 + index * 298;
      card(page, x, 205, 262, 158, metric.color);
      text(page, metric.label, x + 20, 327, { font: serifBold, size: 17, color: colors.green });
      text(page, metric.value, x + 20, 281, { font: serifBold, size: 29, color: metric.color });
      page.drawRectangle({ x: x + 20, y: 249, width: 192, height: 7, color: colors.mint });
      page.drawRectangle({ x: x + 20, y: 249, width: Math.min(192, metric.bar), height: 7, color: metric.color });
      text(page, metric.note, x + 20, 226, { font: sans, size: 10, color: colors.muted }, 215);
    });
    text(page, "A diferença não é uniforme: alguns locais se aproximam bem e outros se afastam muito. Por isso, o próximo passo é olhar os casos por estação e por mês, sem tratar ERA5 como equivalente automático à observação local.", 82, 138, { font: sans, size: 13, color: colors.ink, lineHeight: 18 }, 790);
  }

  // 7. Casos
  {
    const page = pdf.addPage([width, height]);
    pageBase(page, 7, "Casos que merecem ser vistos juntos", sans, serifBold);
    const cases = [
      ["Belém (PA)", "BH anual: -1.363,0 mm", "ERA5 ficou abaixo do INMET"],
      ["Recife - Curado (PE)", "P anual: -1.298,3 mm", "Maior diferença de precipitação"],
      ["Belterra (PA)", "BH anual: +1.039,3 mm", "ERA5 ficou acima do INMET"],
      ["Alagoinhas (BA)", "5 meses", "Maior desacordo entre SH e DH"],
    ];
    cases.forEach(([name, measure, note], index) => {
      const x = index % 2 === 0 ? 60 : 498;
      const y = index < 2 ? 280 : 120;
      card(page, x, y, 392, 125, index === 3 ? colors.alert : colors.greenMid);
      text(page, name, x + 20, y + 89, { font: serifBold, size: 19, color: colors.green });
      text(page, measure, x + 20, y + 57, { font: sansBold, size: 14, color: index === 3 ? colors.alert : colors.greenMid });
      text(page, note, x + 20, y + 31, { font: sans, size: 11, color: colors.muted });
    });
    text(page, "Esses resultados não são um veredito sobre a qualidade de uma fonte. Eles indicam onde vale investigar chuva, temperatura, relevo, litoral e a representação espacial da reanálise.", 68, 78, { font: sans, size: 12, color: colors.muted, lineHeight: 17 }, 805);
  }

  // 8. Agenda
  {
    const page = pdf.addPage([width, height]);
    pageBase(page, 8, "O que precisamos validar hoje", sans, serifBold);
    const questions = [
      "A interpolação de 5 em 5 graus para o fator de correção representa a aproximação desejada?",
      "O valor de outubro para latitude Sul 40 graus, mantido como 0,87, deve permanecer?",
      "Quais diferenças entre INMET e ERA5 seriam aceitáveis para uso didático ou exploratório?",
      "Quais estações e regiões devemos usar como casos de referência na próxima rodada?",
    ];
    bulletList(page, questions, 68, 399, 730, sans, 16);
    page.drawRectangle({ x: 68, y: 108, width: 824, height: 78, color: colors.green });
    text(page, "Direção proposta", 94, 158, { font: serifBold, size: 20, color: colors.warm });
    text(page, "INMET por estação completa como primeira escolha. ERA5 como alternativa transparente para coordenadas livres e períodos fora das normais disponíveis.", 286, 157, { font: sans, size: 13, color: colors.warm, lineHeight: 18 }, 570);
  }

  await writeFile(output, await pdf.save());
  console.log(output);
}

await main();
