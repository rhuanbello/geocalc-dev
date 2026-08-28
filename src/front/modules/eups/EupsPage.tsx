import { BookOpen, Calculator, CheckCircle2, Clipboard, Download, Droplets, Leaf, Mountain, Sprout } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Formula } from "@/components/Formula";
import { StaticCombobox } from "@/components/StaticCombobox";
import { AppSidebar, type GeoCalcModule } from "@/components/AppSidebar";
import { exportEupsWorkbook } from "@/lib/eups-excel-export";
import { EMPTY_EUPS_RAINFALL, EUPS_MONTHS, calculateEups, type EupsRainfallInput } from "$/eups";
import { EUPS_METHODOLOGY, EUPS_REFERENCE_SOURCES } from "$/eups-academic";
import { EUPS_CP_REFERENCES, EUPS_SOIL_REFERENCES, type EupsCpReference, type EupsSoilReference } from "$/eups-references";
import type { ReferenceSource } from "$/academic";
import "katex/dist/katex.min.css";

const SOIL_OPTIONS: Array<{ value: EupsSoilReference["id"]; label: string; description: string }> = EUPS_SOIL_REFERENCES.map((reference) => ({ value: reference.id, label: reference.label, description: reference.description }));
const CP_OPTIONS: Array<{ value: EupsCpReference["id"]; label: string; description: string }> = EUPS_CP_REFERENCES.map((reference) => ({ value: reference.id, label: reference.label, description: reference.description }));

export function EupsPage({ onModuleChange }: { onModuleChange: (module: GeoCalcModule) => void }) {
  const [rainfallTexts, setRainfallTexts] = useState<string[]>(EMPTY_EUPS_RAINFALL.map(() => ""));
  const [soilReferenceId, setSoilReferenceId] = useState<EupsSoilReference["id"]>("custom");
  const [cpReferenceId, setCpReferenceId] = useState<EupsCpReference["id"]>("custom");
  const [kText, setKText] = useState("");
  const [slopeLengthText, setSlopeLengthText] = useState("");
  const [slopeText, setSlopeText] = useState("");
  const [cpText, setCpText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const rainfall = useMemo<EupsRainfallInput[]>(() => rainfallTexts.map(parseDecimal), [rainfallTexts]);
  const k = parseDecimal(kText);
  const slopeLength = parseDecimal(slopeLengthText);
  const slopePercent = parseDecimal(slopeText);
  const cp = parseDecimal(cpText);
  const soilReference = EUPS_SOIL_REFERENCES.find((reference) => reference.id === soilReferenceId)!;
  const cpReference = EUPS_CP_REFERENCES.find((reference) => reference.id === cpReferenceId)!;
  const result = useMemo(() => calculateEups({ rainfall, k, slopeLength, slopePercent, cp }), [rainfall, k, slopeLength, slopePercent, cp]);

  const selectSoilReference = (id: EupsSoilReference["id"]) => {
    const reference = EUPS_SOIL_REFERENCES.find((item) => item.id === id)!;
    setSoilReferenceId(id);
    setKText(reference.suggestedK === null ? "" : formatInput(reference.suggestedK));
  };
  const selectCpReference = (id: EupsCpReference["id"]) => {
    const reference = EUPS_CP_REFERENCES.find((item) => item.id === id)!;
    setCpReferenceId(id);
    setCpText(reference.suggestedCp === null ? "" : formatInput(reference.suggestedCp));
  };
  const summary = buildSummary({ result, k, slopeLength, slopePercent, cp, soilReference, cpReference });

  return <div className="app-layout">
    <AppSidebar activeModule="eups" onModuleChange={onModuleChange} />
    <main className="app-shell">
      <ModuleHeader />
      <MethodologyPanel />

      <section className="panel eups-input-panel">
        <PanelTitle icon={<Droplets className="size-4" />} title="Chuva e erosividade" />
        <Guidance title="O que informar">Informe a precipitação média de cada mês, em milímetros. Os 12 meses formam a precipitação anual P; o GeoCalc calcula I30 para cada mês e soma os resultados no fator R.<Formula latex="I30 = 67{,}355 \times \left(\frac{r^2}{P}\right)^{0{,}85} \qquad R = \sum I30" /></Guidance>
        <Legend />
        <div className="table-wrap eups-rainfall-table-wrap"><table className="eups-rainfall-table"><thead><tr><th>Mês</th><th className="input-column">r (mm)</th><th className="output-column">I30</th></tr></thead><tbody>{EUPS_MONTHS.map((month, index) => <tr key={month}><td>{month}</td><td className="input-cell"><input inputMode="decimal" aria-label={`Precipitação de ${month}`} value={rainfallTexts[index] ?? ""} onChange={(event) => setRainfallTexts((values) => values.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} /></td><td className="output-cell">{formatNumber(result.rows[index]?.erosivityIndex, 2)}</td></tr>)}</tbody><tfoot><tr><td>Precipitação anual / R</td><td>{formatNumber(result.precipitationTotal, 1)}</td><td>{formatNumber(result.rainfallErosivity, 2)}</td></tr></tfoot></table></div>
      </section>

      <section className="panel eups-input-panel">
        <PanelTitle icon={<Sprout className="size-4" />} title="Solo e erodibilidade" />
        <Guidance title="O que representa K">K expressa a suscetibilidade do solo à desagregação e ao transporte pela água. Selecione uma referência didática da Tabela de referência EUPS e informe ou revise o valor de K adotado.</Guidance>
        <div className="eups-full-inputs"><StaticCombobox id="eups-soil-reference" label="Referência de tipo de solo" value={soilReferenceId} options={SOIL_OPTIONS} onChange={selectSoilReference} placeholder="Selecionar referência" /><label className="eups-number-field" htmlFor="eups-k"><span>Fator K <small>t·h·MJ⁻¹·mm⁻¹</small></span><input id="eups-k" aria-label="Fator K" inputMode="decimal" value={kText} placeholder="Informar valor" onChange={(event) => setKText(event.target.value)} /><em>{soilReference.description}</em></label></div>
      </section>

      <section className="panel eups-input-panel">
        <PanelTitle icon={<Mountain className="size-4" />} title="Relevo e fator topográfico" />
        <Guidance title="O que informar">L é o comprimento horizontal da vertente, em metros, e S é a declividade, em porcentagem. Informe ambos para o trecho que representa a erosão estudada; LS é calculado automaticamente.<Formula latex="LS = 0{,}00984 \times L^{0{,}63} \times S^{1{,}18}" /></Guidance>
        <div className="eups-input-grid"><label className="eups-number-field" htmlFor="eups-l"><span>Comprimento L <small>m</small></span><input id="eups-l" aria-label="Comprimento da vertente L" inputMode="decimal" value={slopeLengthText} placeholder="Informar metros" onChange={(event) => setSlopeLengthText(event.target.value)} /></label><label className="eups-number-field" htmlFor="eups-s"><span>Declividade S <small>%</small></span><input id="eups-s" aria-label="Declividade S" inputMode="decimal" value={slopeText} placeholder="Informar porcentagem" onChange={(event) => setSlopeText(event.target.value)} /></label><div className="eups-derived-field"><span>Fator LS</span><strong>{formatNumber(result.topographicFactor, 3)}</strong><small>adimensional · calculado</small></div></div>
      </section>

      <section className="panel eups-input-panel">
        <PanelTitle icon={<Leaf className="size-4" />} title="Cobertura, manejo e conservação" />
        <Guidance title="O que representa CP">CP reúne a proteção da cobertura, o manejo e as práticas conservacionistas. Selecione uma referência didática e informe o valor combinado adotado para o cenário, entre 0 e 1.<small>Nota da planilha: soja descoberta possui C = 0,4; esse valor não é sugerido como CP combinado.</small></Guidance>
        <div className="eups-full-inputs"><StaticCombobox id="eups-cp-reference" label="Referência de cobertura e manejo" value={cpReferenceId} options={CP_OPTIONS} onChange={selectCpReference} placeholder="Selecionar referência" /><label className="eups-number-field" htmlFor="eups-cp"><span>Fator CP <small>0 a 1</small></span><input id="eups-cp" aria-label="Cobertura, manejo e conservação" inputMode="decimal" value={cpText} placeholder="Informar valor" onChange={(event) => setCpText(event.target.value)} /><em>{cpReference.description}</em></label></div>
      </section>

      <section className="panel table-panel eups-result-panel">
        <PanelTitle icon={<Calculator className="size-4" />} title="Tabela de cálculo e resultado" description="Compilado das entradas manuais e das saídas calculadas para a estimativa de perda de solo." />
        <Legend />
        <div className="table-wrap eups-final-table-wrap"><table className="eups-final-table"><thead><tr><th>Fator</th><th>Valor</th><th>Unidade</th><th>Tipo</th><th>Referência ou cálculo</th></tr></thead><tbody><CalculationRow factor="P" value={formatNumber(result.precipitationTotal, 1)} unit="mm" type="Saída" calculation="Soma das 12 precipitações mensais" output /><CalculationRow factor="R" value={formatNumber(result.rainfallErosivity, 2)} unit="MJ·mm·ha⁻¹·h⁻¹·ano⁻¹" type="Saída" calculation="ΣI30 calculado das chuvas mensais" output /><CalculationRow factor="K" value={formatNumber(k, 3)} unit="t·h·MJ⁻¹·mm⁻¹" type="Entrada" calculation={soilReference.label} /><CalculationRow factor="L" value={formatNumber(slopeLength, 1)} unit="m" type="Entrada" calculation="Comprimento horizontal informado" /><CalculationRow factor="S" value={formatNumber(slopePercent, 1)} unit="%" type="Entrada" calculation="Declividade informada" /><CalculationRow factor="LS" value={formatNumber(result.topographicFactor, 3)} unit="adimensional" type="Saída" calculation="Calculado a partir de L e S" output /><CalculationRow factor="CP" value={formatNumber(cp, 3)} unit="adimensional" type="Entrada" calculation={cpReference.label} /></tbody><tfoot><tr><td>PS</td><td>{formatNumber(result.soilLoss, 2)}</td><td>t/ha/ano</td><td>Resultado</td><td>PS = K × R × LS × CP · {result.classification ?? "classificação pendente"}</td></tr></tfoot></table></div>
        {result.isComplete ? <div className="eups-complete"><CheckCircle2 />Todos os fatores necessários foram informados. Revise as escolhas antes de interpretar o resultado.</div> : <div className="eups-errors" role="status"><strong>Para concluir:</strong><span>{result.errors[0] ?? "Revise os fatores informados."}</span></div>}
      </section>

      <section className="panel report-panel eups-report-panel"><PanelTitle icon={<Clipboard className="size-4" />} title="Síntese dos resultados" description="Texto local para copiar em trabalhos, pesquisas e relatórios." /><textarea value={summary} readOnly aria-label="Síntese dos resultados da EUPS" /><div className="button-row"><button className="action-button" type="button" onClick={() => void navigator.clipboard.writeText(summary).then(() => setNotice("Síntese copiada para a área de transferência."))}><Clipboard />Copiar síntese</button><button className="secondary-button" type="button" onClick={() => void exportEupsWorkbook({ result, k, slopeLength, slopePercent, cp, soilReferenceLabel: soilReference.label, cpReferenceLabel: cpReference.label }).then(() => setNotice("Planilha Excel exportada com sucesso."))}><Download />Exportar Excel</button></div></section>
      <ReferencePanel />
      {notice ? <div className="eups-notice" role="status">{notice}<button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso">×</button></div> : null}
    </main>
  </div>;
}

function ModuleHeader() { return <header className="module-header eups-header" id="perda-de-solo"><div className="module-header-institution"><img src={`${import.meta.env.BASE_URL ?? "/"}brand/logo-geoquimica-colorido.png`} alt="PPG Geoquímica UFF" /><span>Programa de Pós-Graduação em Geociências</span></div><div className="module-header-content"><span className="module-kicker">GeoCalc · módulo de cálculo</span><h1>Perda de Solo <span>(EUPS)</span></h1><p>Estimativa didática da perda média anual de solo por erosão laminar.</p></div><div className="module-header-index" aria-label="Módulo 02, EUPS"><span>Módulo</span><strong>02</strong><small>EUPS</small></div></header>; }
function MethodologyPanel() { return <section className="panel methodology-panel eups-methodology-panel"><PanelTitle icon={<BookOpen className="size-4" />} title="Conceitos básicos e metodologia" description="Uma introdução à EUPS antes das tabelas de cálculo." /><div className="methodology-grid">{EUPS_METHODOLOGY.map((section) => <article key={section.title} className="methodology-card"><h3>{section.title}</h3><p>{section.body}</p>{section.formulas?.length ? <div className="methodology-card-formulas">{section.formulas.map((formula) => <Formula key={formula} latex={formula} className="formula" />)}</div> : null}</article>)}</div></section>; }
function Guidance({ title, children }: { title: string; children: ReactNode }) { return <div className="eups-step-guidance"><strong>{title}</strong><div>{children}</div></div>; }
function Legend() { return <div className="table-legend" aria-label="Legenda de entrada e saída"><div><span className="legend-swatch input-swatch" />Entrada manual</div><div><span className="legend-swatch output-swatch" />Saída calculada</div></div>; }
function CalculationRow({ factor, value, unit, type, calculation, output = false }: { factor: string; value: string; unit: string; type: string; calculation: string; output?: boolean }) { return <tr><td>{factor}</td><td className={output ? "output-cell" : "input-cell"}>{value}</td><td>{unit}</td><td>{type}</td><td>{calculation}</td></tr>; }
function ReferencePanel() { return <section className="panel reference-panel"><PanelTitle icon={<BookOpen className="size-4" />} title="Referências e fontes" description="Créditos metodológicos e limites de uso das referências didáticas do módulo." /><div className="reference-grid eups-reference-grid">{EUPS_REFERENCE_SOURCES.map((source) => <ReferenceCard key={source.label} source={source} />)}</div></section>; }
function ReferenceCard({ source }: { source: ReferenceSource }) { return <article className="reference-card">{source.href ? <a href={source.href} target="_blank" rel="noreferrer">{source.label}</a> : <strong>{source.label}</strong>}<span>{source.description}</span></article>; }
function PanelTitle({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) { return <div className="panel-title"><div className="panel-title-icon">{icon}</div><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div></div>; }
function parseDecimal(value: string): number | null { const normalized = value.trim().replace(",", "."); if (!normalized || normalized === "-" || normalized.endsWith(".")) return null; const numeric = Number(normalized); return Number.isFinite(numeric) ? numeric : null; }
function formatInput(value: number): string { return value.toLocaleString("pt-BR", { maximumFractionDigits: 3 }); }
function formatNumber(value: number | null | undefined, digits = 1): string { return value === null || value === undefined || !Number.isFinite(value) ? "-" : value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
function buildSummary({ result, k, slopeLength, slopePercent, cp, soilReference, cpReference }: { result: ReturnType<typeof calculateEups>; k: number | null; slopeLength: number | null; slopePercent: number | null; cp: number | null; soilReference: EupsSoilReference; cpReference: EupsCpReference }) { return ["Síntese dos resultados — Perda de Solo (EUPS)", "", "Método: cálculo manual com 12 precipitações mensais, conforme a Tabela de referência EUPS.", `Situação: ${result.isComplete ? "cálculo concluído" : "pendente de entradas ou revisão"}`, "", "Chuva e erosividade:", `- Precipitação anual (P): ${formatNumber(result.precipitationTotal, 1)} mm`, `- Erosividade (R): ${formatNumber(result.rainfallErosivity, 2)} MJ·mm·ha⁻¹·h⁻¹·ano⁻¹`, "", "Fatores adotados:", `- Referência de solo: ${soilReference.label}`, `- K: ${formatNumber(k, 3)}`, `- L: ${formatNumber(slopeLength, 1)} m`, `- S: ${formatNumber(slopePercent, 1)} %`, `- LS: ${formatNumber(result.topographicFactor, 3)}`, `- Referência de CP: ${cpReference.label}`, `- CP: ${formatNumber(cp, 3)}`, "", `Perda média anual estimada (PS): ${formatNumber(result.soilLoss, 2)} t/ha/ano`, `Classificação: ${result.classification ?? "não calculada"}`, "", "Referências: Tabela de referência EUPS; Wischmeier e Smith (1965), USDA Agriculture Handbook No. 282."].join("\n"); }
