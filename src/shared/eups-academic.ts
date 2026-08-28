import type { MethodologySection, ReferenceSource } from "./academic";

export const EUPS_METHODOLOGY: MethodologySection[] = [
  {
    title: "Erosão laminar",
    body: "É um processo de degradação do solo pela ação da água da chuva, removendo uma fina camada superficial. É contínuo e uniforme e, em geral, não forma sulcos visíveis.",
  },
  {
    title: "Equação Universal de Perda de Solo (EUPS)",
    body: "É uma fórmula para estimar a perda média anual de solo causada pela erosão pela água da chuva. Nesta etapa, o resultado representa perda de solo; não calcula contaminante, transporte fluvial ou sedimentação.",
    formulas: ["PS = K \\times R \\times LS \\times CP"],
  },
  {
    title: "Erosividade da chuva (R)",
    body: "Representa a capacidade erosiva da chuva. A tabela usa as 12 precipitações médias mensais para calcular o índice mensal I30 e somá-lo no fator anual R.",
    formulas: ["R = \\sum I30", "I30 = 67{,}355 \\times \\left(\\frac{r^2}{P}\\right)^{0{,}85}"],
  },
  {
    title: "Erodibilidade do solo (K)",
    body: "Expressa a facilidade com que o solo pode ser desagregado e transportado pela água. Os valores disponíveis são referências didáticas da Tabela de referência EUPS; o valor adotado continua editável.",
    formulas: ["K = \\text{fator de erodibilidade do solo}"],
  },
  {
    title: "Fator topográfico (LS)",
    body: "Combina o comprimento horizontal da rampa ou vertente (L), em metros, e a declividade (S), em porcentagem. É calculado automaticamente a partir dos dois valores informados.",
    formulas: ["LS = 0{,}00984 \\times L^{0{,}63} \\times S^{1{,}18}"],
  },
  {
    title: "Cobertura, manejo e conservação (CP)",
    body: "É o fator combinado que representa proteção da cobertura vegetal, manejo e práticas conservacionistas. Varia de 0 a 1 e deve corresponder ao cenário avaliado.",
    formulas: ["0 \\leq CP \\leq 1"],
  },
];

export const EUPS_REFERENCE_SOURCES: ReferenceSource[] = [
  {
    label: "Wischmeier, W. H.; Smith, D. D. (1965)",
    description: "USDA Agriculture Handbook No. 282: guia empírico para estimar perda média anual por erosão hídrica e apoiar práticas de conservação em áreas agrícolas. Como foi desenvolvido para condições específicas, não torna universais os valores de K e CP usados neste módulo.",
    href: "https://www.govinfo.gov/app/details/GOVPUB-A-PURL-gpo22285",
  },
];
