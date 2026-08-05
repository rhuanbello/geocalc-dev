export type ReferenceSource = {
  label: string;
  description: string;
  href?: string;
};

export type MethodologySection = {
  title: string;
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
      "Fonte observacional por estação meteorológica usada quando o usuário seleciona uma estação INMET completa para 1981-2010 ou 1991-2020.",
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
    title: "O que é o balanço hídrico",
    body:
      "O Balanço Hídrico (BH) compara a água que entra e a água que sai de um espaço, como uma bacia hidrográfica, durante um período de tempo. Ele permite observar se houve sobra ou falta potencial de água no período analisado.",
  },
  {
    title: "Entrada e saída de água",
    body:
      "Na formulação usada aqui, a entrada é a precipitação mensal (P), medida em milímetros. A saída é a evapotranspiração potencial (Etp), que representa a demanda de perda de água para a atmosfera.",
    formulas: ["BH = P - Etp"],
  },
  {
    title: "Por que estimar a Etp",
    body:
      "Como muitas estações meteorológicas não medem a Etp diretamente em campo, o cálculo usa a fórmula de Thornthwaite para estimar a Etp mensal a partir da temperatura média mensal.",
    formulas: ["Etp mensal = 16 * (10t / I)^a"],
  },
  {
    title: "Índices de Thornthwaite",
    body:
      "O índice calorimétrico mensal (i) é calculado para cada mês a partir da temperatura. A soma desses índices forma o índice anual (I), usado para calcular o expoente a da fórmula.",
    formulas: [
      "i = (t / 5)^1,514",
      "I = soma(i)",
      "a = (675 * 10^-9 * I^3) - (771 * 10^-7 * I^2) + (0,01792 * I) + 0,49239",
    ],
  },
  {
    title: "Correção por latitude",
    body:
      "A equação de Thornthwaite foi proposta para condições padronizadas de Equador, mês de 30 dias e 12 horas de insolação diária. Por isso, a Etp é multiplicada por um fator de correção associado ao hemisfério, ao mês e à latitude de referência.",
    formulas: ["Etp corrigida = Etp * FC", "BH = P - Etp corrigida"],
  },
  {
    title: "Superávit e déficit",
    body:
      "Quando o resultado mensal é positivo, há superávit hídrico (SH). Quando é negativo, há déficit hídrico (DH), indicando que a demanda de evapotranspiração superou a entrada de água pela chuva.",
    formulas: ["SH = valores positivos de BH", "DH = valores negativos de BH"],
  },
];

export const CLIMATE_IMPORT_METHODOLOGY: MethodologySection[] = [
  {
    title: "Fontes de chuva e temperatura",
    body:
      "O GeoCalc pode usar estimativas por coordenada da Open-Meteo/ERA5 ou dados observacionais por estação das Normais Climatológicas do INMET, quando disponíveis.",
  },
  {
    title: "INMET por estação",
    body:
      "Quando uma estação INMET é selecionada, a tabela recebe diretamente os valores mensais de precipitação e temperatura da normal climatológica 1981-2010 ou 1991-2020 escolhida para aquela estação.",
  },
  {
    title: "Precipitação mensal",
    body:
      "A precipitação vem dia a dia. Para representar um mês, o GeoCalc soma todos os valores diários de chuva daquele mês, chegando à precipitação mensal acumulada.",
  },
  {
    title: "Temperatura mensal",
    body:
      "A temperatura também vem dia a dia. Para representar um mês, o GeoCalc calcula a média das temperaturas médias diárias registradas naquele mês.",
  },
  {
    title: "Normal do período",
    body:
      "Depois de obter os meses de cada ano, o GeoCalc compara meses iguais no período selecionado: janeiros com janeiros, fevereiros com fevereiros, e assim sucessivamente.",
  },
  {
    title: "Meses incompletos",
    body:
      "Quando o ano mais recente ainda não tem um mês completo disponível, esse mês não entra na média. Isso evita que poucos dias de chuva ou temperatura representem um mês inteiro.",
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
