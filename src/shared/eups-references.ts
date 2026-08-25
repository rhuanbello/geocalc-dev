export type EupsSoilReference = {
  id: "custom" | "latossolo-va" | "terra-roxa" | "cambissolo" | "areia-quartzosa";
  label: string;
  description: string;
  suggestedK: number | null;
};

export const EUPS_SOIL_REFERENCES: EupsSoilReference[] = [
  { id: "custom", label: "Valor personalizado", description: "Informe o K adequado ao seu cenário.", suggestedK: null },
  { id: "latossolo-va", label: "Latossolo V-A", description: "Faixa de referência: 0,013 a 0,020. Escolha o valor a adotar.", suggestedK: null },
  { id: "terra-roxa", label: "Terra roxa", description: "Referência da planilha: K = 0,013.", suggestedK: 0.013 },
  { id: "cambissolo", label: "Cambissolo", description: "Referência da planilha: K = 0,024.", suggestedK: 0.024 },
  { id: "areia-quartzosa", label: "Areia quartzosa", description: "Referência da planilha: K = 0,027.", suggestedK: 0.027 },
];

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
