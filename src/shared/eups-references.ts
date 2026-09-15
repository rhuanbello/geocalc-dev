export type EupsCpReference = {
  id: "custom" | "floresta" | "pastagem" | "solo-exposto";
  label: string;
  description: string;
  suggestedCp: number | null;
};

export const EUPS_CP_REFERENCES: EupsCpReference[] = [
  { id: "custom", label: "Valor personalizado", description: "Informe o CP adotado no seu cenário.", suggestedCp: null },
  { id: "floresta", label: "Floresta nativa", description: "Referência da planilha: CP = 0,01.", suggestedCp: 0.01 },
  { id: "pastagem", label: "Pastagem ou cultura com cobertura", description: "Referência da planilha: CP = 0,25.", suggestedCp: 0.25 },
  { id: "solo-exposto", label: "Solo exposto, sem práticas", description: "Referência da planilha: CP = 1,00.", suggestedCp: 1 },
];
