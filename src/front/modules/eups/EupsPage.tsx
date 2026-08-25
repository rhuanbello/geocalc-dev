import {
  BookOpen,
  Calculator,
  CheckCircle2,
  Clipboard,
  Download,
  Droplets,
  Leaf,
  Mountain,
  Sprout,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Formula } from "@/components/Formula";
import { StaticCombobox } from "@/components/StaticCombobox";
import { AppSidebar, type GeoCalcModule } from "@/components/AppSidebar";
import { exportEupsWorkbook } from "@/lib/eups-excel-export";
import {
  EMPTY_EUPS_RAINFALL,
  EUPS_MONTHS,
  calculateEups,
  type EupsRainfallInput,
} from "$/eups";
import {
  EUPS_CP_REFERENCES,
  EUPS_SOIL_REFERENCES,
  type EupsCpReference,
  type EupsSoilReference,
} from "$/eups-references";
import "katex/dist/katex.min.css";

const SOIL_OPTIONS: Array<{ value: EupsSoilReference["id"]; label: string; description: string }> = EUPS_SOIL_REFERENCES.map((reference) => ({
  value: reference.id,
  label: reference.label,
  description: reference.description,
}));
const CP_OPTIONS: Array<{ value: EupsCpReference["id"]; label: string; description: string }> = EUPS_CP_REFERENCES.map((reference) => ({
  value: reference.id,
  label: reference.label,
  description: reference.description,
}));

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
  const result = useMemo(
    () => calculateEups({ rainfall, k, slopeLength, slopePercent, cp }),
    [rainfall, k, slopeLength, slopePercent, cp],
  );

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

  const copySummary = async () => {
    await navigator.clipboard.writeText(summary);
    setNotice("Síntese copiada para a área de transferência.");
  };

  const exportExcel = async () => {
    await exportEupsWorkbook({
      result,
      k,
      slopeLength,
      slopePercent,
      cp,
      soilReferenceLabel: soilReference.label,
      cpReferenceLabel: cpReference.label,
    });
    setNotice("Planilha Excel exportada com sucesso.");
  };

  return (
    <div className="app-layout">
      <AppSidebar activeModule="eups" onModuleChange={onModuleChange} />
      <main className="app-shell">
        <header className="module-header eups-header" id="perda-de-solo">
          <div className="module-header-institution">
            <img src={`${import.meta.env.BASE_URL ?? "/"}brand/logo-geoquimica-colorido.png`} alt="PPG Geoquímica UFF" />
            <span>Programa de Pós-Graduação em Geociências</span>
          </div>
          <div className="module-header-content">
            <span className="module-kicker">GeoCalc · módulo de cálculo</span>
            <h1>Perda de Solo <span>(EUPS)</span></h1>
            <p>Um roteiro de cálculo para compreender como chuva, solo, relevo e manejo participam da erosão laminar.</p>
          </div>
          <div className="module-header-index" aria-label="Módulo 02, EUPS"><span>Módulo</span><strong>02</strong><small>EUPS</small></div>
        </header>

        <section className="panel eups-base-introduction">
          <PanelTitle icon={<BookOpen className="size-4" />} title="Uma etapa do fluxo geoquímico" description="A EUPS estima a perda média anual de solo. O sedimento que chega ao corpo hídrico, seu transporte e sua sedimentação pertencem às próximas etapas do fluxograma." />
          <div className="eups-base-intro-grid">
            <div className="eups-base-equation"><span>Equação de trabalho</span><Formula latex="PS = K \times R \times LS \times CP" /></div>
            <p>Preencha os fatores em sequência. Os valores são informados e revisados por você; esta versão não consulta mapas, estações ou serviços externos.</p>
          </div>
        </section>

        <section className="eups-steps" aria-label="Etapas do cálculo da EUPS">
          <EupsStep number="01" icon={<Droplets />} title="Chuva e erosividade" subtitle="De precipitação mensal para o fator R">
            <div className="eups-step-layout is-rainfall">
              <div className="eups-step-guidance"><strong>O que informar</strong><p>Informe a precipitação média de cada mês, em milímetros. Os 12 meses são necessários para representar um ano completo.</p><Formula latex="I30 = 67{,}355 \times \left(\frac{r^2}{P}\right)^{0{,}85}" /><small><b>r</b> é a chuva mensal; <b>P</b> é a soma anual calculada pelo GeoCalc.</small></div>
              <div className="eups-rainfall-table-wrap"><table className="eups-rainfall-table"><thead><tr><th>Mês</th><th>r (mm)</th><th>I30</th></tr></thead><tbody>{EUPS_MONTHS.map((month, index) => <tr key={month}><td>{month}</td><td><input inputMode="decimal" aria-label={`Precipitação de ${month}`} value={rainfallTexts[index] ?? ""} onChange={(event) => setRainfallTexts((values) => values.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} /></td><td>{formatNumber(result.rows[index]?.erosivityIndex, 2)}</td></tr>)}</tbody><tfoot><tr><td>Precipitação anual / R</td><td>{formatNumber(result.precipitationTotal, 1)}</td><td>{formatNumber(result.rainfallErosivity, 2)}</td></tr></tfoot></table></div>
            </div>
          </EupsStep>

          <EupsStep number="02" icon={<Sprout />} title="Solo e erodibilidade" subtitle="Escolha uma referência e adote o fator K">
            <div className="eups-step-layout">
              <div className="eups-step-guidance"><strong>O que representa K</strong><p>É a suscetibilidade do solo à desagregação e ao transporte pela água. As referências abaixo vêm da planilha do Bida e são apenas apoio didático.</p><small>Uma referência não substitui a avaliação do solo do cenário estudado.</small></div>
              <div className="eups-input-stack">
                <StaticCombobox id="eups-soil-reference" label="Referência de tipo de solo" value={soilReferenceId} options={SOIL_OPTIONS} onChange={selectSoilReference} placeholder="Selecionar referência" />
                <label className="eups-number-field" htmlFor="eups-k"><span>Fator K <small>t·h·MJ⁻¹·mm⁻¹</small></span><input id="eups-k" aria-label="Fator K" inputMode="decimal" value={kText} placeholder="Informar valor" onChange={(event) => setKText(event.target.value)} /><em>{soilReference.description}</em></label>
              </div>
            </div>
          </EupsStep>

          <EupsStep number="03" icon={<Mountain />} title="Relevo e fator topográfico" subtitle="Informe L e S para calcular LS">
            <div className="eups-step-layout">
              <div className="eups-step-guidance"><strong>Como medir</strong><p><b>L</b> é o comprimento horizontal da vertente, em metros; <b>S</b> é sua declividade, em porcentagem. Meça ou defina ambos para o trecho que representa a erosão estudada.</p><Formula latex="LS = 0{,}00984 \times L^{0{,}63} \times S^{1{,}18}" /></div>
              <div className="eups-input-grid"><label className="eups-number-field" htmlFor="eups-l"><span>Comprimento L <small>m</small></span><input id="eups-l" aria-label="Comprimento da vertente L" inputMode="decimal" value={slopeLengthText} placeholder="Informar metros" onChange={(event) => setSlopeLengthText(event.target.value)} /></label><label className="eups-number-field" htmlFor="eups-s"><span>Declividade S <small>%</small></span><input id="eups-s" aria-label="Declividade S" inputMode="decimal" value={slopeText} placeholder="Informar porcentagem" onChange={(event) => setSlopeText(event.target.value)} /></label><div className="eups-derived-field"><span>Fator LS</span><strong>{formatNumber(result.topographicFactor, 3)}</strong><small>adimensional · calculado</small></div></div>
            </div>
          </EupsStep>

          <EupsStep number="04" icon={<Leaf />} title="Cobertura, manejo e conservação" subtitle="Adote o fator combinado CP">
            <div className="eups-step-layout">
              <div className="eups-step-guidance"><strong>O que representa CP</strong><p>Reúne a proteção da cobertura, o manejo e as práticas conservacionistas. É uma escolha contextual e deve ser justificada para o cenário avaliado.</p><small>Nota da planilha: soja descoberta possui C = 0,4; esse valor não é sugerido como CP combinado.</small></div>
              <div className="eups-input-stack"><StaticCombobox id="eups-cp-reference" label="Referência de cobertura e manejo" value={cpReferenceId} options={CP_OPTIONS} onChange={selectCpReference} placeholder="Selecionar referência" /><label className="eups-number-field" htmlFor="eups-cp"><span>Fator CP <small>0 a 1</small></span><input id="eups-cp" aria-label="Cobertura, manejo e conservação" inputMode="decimal" value={cpText} placeholder="Informar valor" onChange={(event) => setCpText(event.target.value)} /><em>{cpReference.description}</em></label></div>
            </div>
          </EupsStep>

          <EupsStep number="05" icon={<Calculator />} title="Resultado da estimativa" subtitle="Leia os efeitos naturais e o cenário adotado">
            <div className="eups-result-formula"><Formula latex="PNE = R \times K \times LS \qquad PS = PNE \times CP" /></div>
            <div className="eups-result-grid">
              <ResultCard label="Potencial natural de erosão" code="PNE" value={result.naturalErosionPotential} unit="t/ha/ano" />
              <ResultCard label="Perda média anual estimada" code="PS" value={result.soilLoss} unit="t/ha/ano" emphasis />
              <ResultCard label="Classificação" code="PS" value={result.classification} unit="Baixa < 10 · Média 10–25 · Alta > 25" />
            </div>
            {result.isComplete ? <div className="eups-complete"><CheckCircle2 />Todos os fatores necessários foram informados. Revise as escolhas antes de interpretar o resultado.</div> : <div className="eups-errors" role="status"><strong>Para concluir:</strong><span>{result.errors[0] ?? "Revise os fatores informados."}</span></div>}
          </EupsStep>
        </section>

        <section className="panel report-panel eups-report-panel">
          <PanelTitle icon={<Clipboard className="size-4" />} title="Síntese do cálculo" description="Registra os valores informados, as referências escolhidas e os resultados desta estimativa." />
          <textarea value={summary} readOnly aria-label="Síntese dos resultados da EUPS" />
          <div className="button-row"><button className="action-button" type="button" onClick={() => void copySummary()}><Clipboard />Copiar síntese</button><button className="secondary-button" type="button" onClick={() => void exportExcel()}><Download />Exportar Excel</button></div>
        </section>

        <section className="panel reference-panel eups-base-reference-panel">
          <PanelTitle icon={<BookOpen className="size-4" />} title="Base metodológica" description="Esta versão é manual e didática: utiliza a tabela de cálculo da EUPS fornecida pelo Bida e mantém cada hipótese visível." />
          <div className="reference-grid eups-reference-grid"><ReferenceCard title="EUPS" body="PS = K × R × LS × CP; perda média anual de solo por erosão laminar." /><ReferenceCard title="Fluxograma" body="Depois da erosão, os módulos seguintes tratam do solo que chega à drenagem, seu transporte e sua sedimentação." /><ReferenceCard title="Limite desta etapa" body="Não calcula contaminante associado ao solo perdido, transporte fluvial ou sedimentação." /></div>
        </section>
        {notice ? <div className="eups-notice" role="status">{notice}<button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso">×</button></div> : null}
      </main>
    </div>
  );
}

function EupsStep({ number, icon, title, subtitle, children }: { number: string; icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="panel eups-step"><div className="eups-step-rail"><span>{number}</span><i /></div><div className="eups-step-body"><div className="eups-step-title"><div className="panel-title-icon">{icon}</div><div><p>Etapa {number}</p><h2>{title}</h2><span>{subtitle}</span></div></div>{children}</div></section>;
}

function PanelTitle({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="panel-title"><div className="panel-title-icon">{icon}</div><div><h2>{title}</h2><p>{description}</p></div></div>;
}

function ResultCard({ label, code, value, unit, emphasis = false }: { label: string; code: string; value: number | string | null; unit: string; emphasis?: boolean }) {
  return <article className={`eups-result-card${emphasis ? " is-emphasis" : ""}`}><span>{code}</span><h3>{label}</h3><strong>{typeof value === "number" ? formatNumber(value, 2) : value ?? "-"}</strong><small>{unit}</small></article>;
}

function ReferenceCard({ title, body }: { title: string; body: string }) {
  return <article className="reference-card"><strong>{title}</strong><span>{body}</span></article>;
}

function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized || normalized === "-" || normalized.endsWith(".")) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatInput(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "-" : value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function buildSummary({ result, k, slopeLength, slopePercent, cp, soilReference, cpReference }: { result: ReturnType<typeof calculateEups>; k: number | null; slopeLength: number | null; slopePercent: number | null; cp: number | null; soilReference: EupsSoilReference; cpReference: EupsCpReference }) {
  return [
    "Síntese dos resultados — Perda de Solo (EUPS)", "",
    "Método: cálculo manual com 12 precipitações mensais, conforme a tabela de cálculo fornecida pelo Bida.",
    `Situação: ${result.isComplete ? "cálculo concluído" : "pendente de entradas ou revisão"}`, "",
    "Chuva e erosividade:", `- Precipitação anual (P): ${formatNumber(result.precipitationTotal, 1)} mm`, `- Erosividade (R): ${formatNumber(result.rainfallErosivity, 2)} MJ·mm·ha⁻¹·h⁻¹·ano⁻¹`, "",
    "Fatores adotados:", `- Referência de solo: ${soilReference.label}`, `- K: ${formatNumber(k, 3)}`, `- L: ${formatNumber(slopeLength, 1)} m`, `- S: ${formatNumber(slopePercent, 1)} %`, `- LS: ${formatNumber(result.topographicFactor, 3)}`, `- Referência de CP: ${cpReference.label}`, `- CP: ${formatNumber(cp, 3)}`, "",
    `Potencial natural de erosão (PNE): ${formatNumber(result.naturalErosionPotential, 2)} t/ha/ano`, `Perda média anual estimada (PS): ${formatNumber(result.soilLoss, 2)} t/ha/ano`, `Classificação: ${result.classification ?? "não calculada"}`, "",
    "Referência: tabela de cálculo da EUPS fornecida pelo Bida; Wischmeier e Smith.",
  ].join("\n");
}
