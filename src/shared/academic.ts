export type ReferenceSource = {
  label: string;
  description: string;
  href?: string;
};

export type MethodologySection = {
  title: string;
  note?: string;
  body: string;
  formulas?: string[];
};

export type ClimatePeriodPresetId =
  | "1940-1970"
  | "1961-1990"
  | "1981-2010"
  | "1991-2020"
  | "custom";

export type ClimatePeriodPreset = {
  id: ClimatePeriodPresetId;
  label: string;
  startYear: number;
  endYear: number | "current";
};

export type ClimateCacheEntry<T> = {
  createdAt: number;
  expiresAt: number;
  value: T;
};

export const REFERENCE_SOURCES: ReferenceSource[] = [
  {
    label: "Thornthwaite, 1948",
    description:
      "Referência metodológica da fórmula de evapotranspiração potencial usada no cálculo do balanço hídrico: Geographical Review, London, v.38, p.55-94.",
    href: "https://doi.org/10.2307/210739",
  },
  {
    label: "Open-Meteo Historical Weather API",
    description:
      "Fonte externa usada para séries históricas diárias de precipitação e temperatura. O GeoCalc usa o modelo ERA5 para manter consistência em séries históricas longas.",
    href: "https://open-meteo.com/en/docs/historical-weather-api",
  },
  {
    label: "INMET Normais Climatológicas do Brasil",
    description:
      "Fonte observacional por estação meteorológica usada quando o usuário seleciona uma estação INMET completa para 1961-1990, 1981-2010 ou 1991-2020.",
    href: "https://portal.inmet.gov.br/normais",
  },
  {
    label: "OpenStreetMap",
    description: "Base cartográfica colaborativa usada na seleção visual do local.",
    href: "https://www.openstreetmap.org/copyright",
  },
  {
    label: "Leaflet",
    description: "Biblioteca de mapas interativos usada para renderizar o mapa.",
    href: "https://leafletjs.com/",
  },
  {
    label: "Nominatim",
    description:
      "Fonte externa usada para estimar o nome do local a partir das coordenadas selecionadas no mapa.",
    href: "https://nominatim.org/release-docs/latest/api/Reverse/",
  },
];

export const WATER_BALANCE_METHODOLOGY: MethodologySection[] = [
  {
    title: "O que é o Balanço Hídrico (BH)?",
    body:
      "O Balanço Hídrico (BH), grosso modo, compara a quantidade de água que entra e a que sai de um território, p.ex. uma bacia hidrográfica, durante um período de tempo. O BH permite contabilizar a variação entre os volumes de entrada e saída de água no território no período analisado.",
  },
  {
    title: "Entrada e saída de água no BH",
    body:
      "Na formulação usada aqui: (i) a entrada de água é a precipitação acumulada mensal (P); e, a saída é a evapotranspiração potencial mensal (Etp), que representa a perda de água para a atmosfera. Ambas medidas em milímetros (mm).",
    formulas: ["BH = P - Etp"],
  },
  {
    title: "Por que estimar a Etp",
    body:
      "Como muitas estações meteorológicas não medem a Etp diretamente em campo, o cálculo usa a fórmula de Thornthwaite (1948) para estimar a Etp mensal a partir da temperatura média mensal.",
    formulas: ["\\text{Etp mensal} = 16 * (10t / I)^a"],
  },
  {
    title: "Índices na fórmula de Thornthwaite",
    body:
      "O índice calorimétrico mensal (i) é calculado para cada mês a partir da temperatura. A soma dos índices mensais fornece o índice anual (I), usado para calcular o expoente “a” da fórmula.",
    formulas: [
      "i = (t / 5)^{1,514}",
      "I = soma(i)",
      "a = (675 * 10^{-9} * I^3) - (771 * 10^{-7} * I^2) + (0,01792 * I) + 0,49239",
    ],
  },
  {
    title: "Correção de Etp para a latitude",
    body:
      "A equação de Thornthwaite foi proposta para condições padronizadas no Equador, mês de 30 dias e 12 horas de insolação diária. Por isso, a Etp é multiplicada por um fator de correção (FC) associado ao hemisfério, ao mês e à latitude do território considerado.",
    formulas: ["\\text{Etp corrigida} = Etp * FC", "BH = P - \\text{Etp corrigida}"],
  },
  {
    title: "Superávit (SH) e Déficit (DH) Hídricos",
    body:
      "Quando o resultado do BH mensal é positivo, há superávit hídrico (SH). Quando é negativo, há déficit hídrico (DH), indicando que a evapotranspiração superou a entrada de água pela precipitação.",
    formulas: [
      "SH = \\text{valores positivos de BH}",
      "DH = \\text{valores negativos de BH}",
    ],
  },
];

export const CLIMATE_IMPORT_METHODOLOGY: MethodologySection[] = [
  {
    title: "INMET por estação",
    body:
      "A fonte principal são as Normais Climatológicas do INMET: 1961-1990, 1981-2010 e 1991-2020. Ao selecionar uma estação completa, a tabela recebe diretamente os valores mensais de precipitação (P) e temperatura (t) da normal escolhida.",
  },
  {
    title: "Open-Meteo/ERA5 por coordenada",
    body:
      "Quando não houver uma estação INMET adequada, o GeoCalc pode estimar os valores para qualquer coordenada. Para cada mês, a precipitação é obtida pela soma diária e a temperatura, pela média das temperaturas médias diárias.",
  },
  {
    title: "Normal estimada por coordenada",
    body:
      "Nos anos completos do período selecionado, o GeoCalc reúne meses equivalentes: janeiros com janeiros, fevereiros com fevereiros e assim sucessivamente. As normais mensais de P e t resultantes são usadas no cálculo do BH.",
  },
];

export function getClimatePeriodPresets(): ClimatePeriodPreset[] {
  return [
    { id: "1940-1970", label: "1940-1970", startYear: 1940, endYear: 1970 },
    { id: "1961-1990", label: "1961-1990", startYear: 1961, endYear: 1990 },
    { id: "1981-2010", label: "1981-2010", startYear: 1981, endYear: 2010 },
    { id: "1991-2020", label: "1991-2020", startYear: 1991, endYear: 2020 },
    { id: "custom", label: "Personalizado", startYear: 1990, endYear: "current" },
  ];
}
