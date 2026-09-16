import {
  calculateSoilK,
  clearSelectionsAfter,
  getProgressiveSoilFilterSteps,
  resolveSoilComponent,
  type EupsSoilComponent,
  type EupsSoilDataset,
  type EupsSoilFilterId,
  type EupsSoilResolution,
  type EupsSoilSelections,
} from "$/eups-soil-lookup";
import { StaticCombobox } from "@/components/StaticCombobox";
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, Sprout, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const COMPONENTS: EupsSoilComponent[] = ["C1", "C2", "C3", "C4"];

export type EupsSoilSelectionValue = {
  factorK: number | null;
  referenceLabel: string;
};

type SoilMode = "custom" | "lookup";
type SelectionsByComponent = Record<EupsSoilComponent, EupsSoilSelections>;
type ConfirmationsByComponent = Record<EupsSoilComponent, boolean>;

const EMPTY_SELECTIONS: SelectionsByComponent = { C1: {}, C2: {}, C3: {}, C4: {} };
const EMPTY_CONFIRMATIONS: ConfirmationsByComponent = { C1: false, C2: false, C3: false, C4: false };

export function EupsSoilSelector({ onChange }: { onChange: (value: EupsSoilSelectionValue) => void }) {
  const [mode, setMode] = useState<SoilMode>("custom");
  const [manualKText, setManualKText] = useState("");
  const [dataset, setDataset] = useState<EupsSoilDataset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isKInformationOpen, setIsKInformationOpen] = useState(false);
  const [activeComponents, setActiveComponents] = useState<EupsSoilComponent[]>(["C1"]);
  const [activeComponent, setActiveComponent] = useState<EupsSoilComponent>("C1");
  const [selections, setSelections] = useState<SelectionsByComponent>(EMPTY_SELECTIONS);
  const [confirmations, setConfirmations] = useState<ConfirmationsByComponent>(EMPTY_CONFIRMATIONS);

  useEffect(() => {
    if ((mode !== "lookup" && !isKInformationOpen) || dataset) return;
    let active = true;
    void import("$/eups-soil-data")
      .then(({ loadEupsSoilDataset }) => loadEupsSoilDataset())
      .then((loaded) => {
        if (active) setDataset(loaded);
      })
      .catch(() => {
        if (active) setLoadError("Não foi possível carregar a base de solos SiBCS.");
      });
    return () => { active = false; };
  }, [dataset, isKInformationOpen, mode]);

  useEffect(() => {
    if (!isKInformationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsKInformationOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isKInformationOpen]);

  const resolutions = useMemo(() => {
    if (!dataset) return null;
    return Object.fromEntries(COMPONENTS.map((component) => [component, resolveSoilComponent(dataset, component, selections[component], confirmations[component])])) as Record<EupsSoilComponent, EupsSoilResolution>;
  }, [confirmations, dataset, selections]);
  const calculation = useMemo(() => dataset && resolutions ? calculateSoilK(dataset, activeComponents.length, resolutions) : null, [activeComponents.length, dataset, resolutions]);
  const manualK = parseDecimal(manualKText);

  useEffect(() => {
    if (mode === "custom") {
      onChange({ factorK: manualK, referenceLabel: "Valor personalizado" });
      return;
    }
    onChange({
      factorK: calculation?.factorK ?? null,
      referenceLabel: calculation ? `Consulta SiBCS · ${activeComponents.length} componente${activeComponents.length === 1 ? "" : "s"}` : "Consulta SiBCS em andamento",
    });
  }, [activeComponents.length, calculation, manualK, mode, onChange]);

  const activeResolution = resolutions?.[activeComponent] ?? null;
  const filterSteps = dataset ? getProgressiveSoilFilterSteps(dataset, activeComponent, selections[activeComponent]) : [];
  const nextComponent = COMPONENTS[activeComponents.length];
  const canAddComponent = Boolean(nextComponent && resolutions && activeComponents.every((component) => resolutions[component].kind === "automatic"));

  const selectMode = (nextMode: SoilMode) => {
    setMode(nextMode);
    setLoadError(null);
  };
  const addComponent = () => {
    if (!nextComponent || !canAddComponent) return;
    setActiveComponents((current) => [...current, nextComponent]);
    setActiveComponent(nextComponent);
  };
  const removeLastComponent = () => {
    if (activeComponents.length === 1) return;
    const removed = activeComponents.at(-1)!;
    const remaining = activeComponents.slice(0, -1);
    setActiveComponents(remaining);
    setSelections((current) => ({ ...current, [removed]: {} }));
    setConfirmations((current) => ({ ...current, [removed]: false }));
    setActiveComponent(remaining.at(-1)!);
  };
  const updateFilter = (fieldId: EupsSoilFilterId, value: string) => {
    if (!dataset) return;
    setSelections((current) => {
      const next = { ...current[activeComponent], [fieldId]: value };
      return { ...current, [activeComponent]: clearSelectionsAfter(fieldId, next, dataset) };
    });
    setConfirmations((current) => ({ ...current, [activeComponent]: false }));
  };

  return <div className="eups-soil-selector">
    <div className="eups-soil-mode-controls">
      <div className="eups-soil-mode-toggle" role="group" aria-label="Modo de obtenção do fator K">
        <button className={mode === "lookup" ? "active" : ""} type="button" onClick={() => selectMode("lookup")}><Sprout />Consulta SiBCS</button>
        <button className={mode === "custom" ? "active" : ""} type="button" onClick={() => selectMode("custom")}>Valor personalizado</button>
      </div>
      <button type="button" className="secondary-button eups-soil-information-button" onClick={() => setIsKInformationOpen(true)}><CircleHelp />Informações sobre o cálculo de K</button>
    </div>

    {mode === "custom" ? <label className="eups-number-field" htmlFor="eups-k"><span>Fator K <small>t·h·MJ⁻¹·mm⁻¹</small></span><input id="eups-k" aria-label="Fator K" inputMode="decimal" value={manualKText} placeholder="Informar valor" onChange={(event) => setManualKText(event.target.value)} /><em>Informe um valor de K quando a referência SiBCS não for usada.</em></label> : null}

    {mode === "lookup" && !dataset && !loadError ? <div className="eups-soil-loading" role="status"><Loader2 className="spin" />Carregando a base de caminhos SiBCS…</div> : null}
    {mode === "lookup" && loadError ? <div className="eups-soil-status is-blocked" role="status"><AlertTriangle />{loadError}</div> : null}

    {mode === "lookup" && dataset ? <>
      <div className="eups-soil-tabs" role="tablist" aria-label="Componente em edição">{activeComponents.map((component) => <button key={component} type="button" role="tab" aria-selected={activeComponent === component} className={activeComponent === component ? "active" : ""} onClick={() => setActiveComponent(component)}>{component}<small>{componentLabel(resolutions?.[component])}</small></button>)}</div>
      <div className="eups-soil-filter-grid">{filterSteps.map((step) => <StaticCombobox key={step.id} id={`eups-soil-${activeComponent}-${step.id}`} label={step.label} value={step.value ?? ""} options={step.options.map((option) => ({ value: option, label: option.toLocaleUpperCase("pt-BR") }))} onChange={(value) => updateFilter(step.id, value)} placeholder={`SELECIONAR ${step.label.toLocaleUpperCase("pt-BR")}`} popoverClassName="eups-soil-filter-popover" />)}</div>
      {activeResolution ? <SoilResolution resolution={activeResolution} confirmed={confirmations[activeComponent]} onConfirm={() => setConfirmations((current) => ({ ...current, [activeComponent]: true }))} /> : null}
      <div className="eups-soil-component-actions"><div><strong>Componentes da unidade</strong><span>Adicione o próximo solo somente depois de resolver os componentes já incluídos.</span></div>{nextComponent ? <button type="button" className="secondary-button" onClick={addComponent} disabled={!canAddComponent}>Adicionar {nextComponent}</button> : null}{activeComponents.length > 1 ? <button type="button" className="text-button" onClick={removeLastComponent}>Remover {activeComponents.at(-1)}</button> : null}</div>
      <p className="eups-soil-limit-note">A consulta representa até C4. Unidades com componentes adicionais exigem conferência externa.</p>
      <SoilCalculationSummary components={activeComponents} resolutions={resolutions} calculation={calculation} />
    </> : null}
    <KInformationDialog isOpen={isKInformationOpen} dataset={dataset} loadError={loadError} onClose={() => setIsKInformationOpen(false)} />
  </div>;
}

function KInformationDialog({ isOpen, dataset, loadError, onClose }: { isOpen: boolean; dataset: EupsSoilDataset | null; loadError: string | null; onClose: () => void }) {
  if (!isOpen) return null;
  return <div className="eups-k-information-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="eups-k-information-modal" role="dialog" aria-modal="true" aria-labelledby="eups-k-information-title"><header><div><span className="eups-result-eyebrow">Tabela_K</span><h2 id="eups-k-information-title">Tabela de conversão do fator K</h2><p>Classes dos componentes, pesos e conversão do índice ponderado usados no cálculo da EUPS.</p></div><button type="button" aria-label="Fechar informações sobre o cálculo de K" onClick={onClose} autoFocus><X /></button></header>{loadError ? <div className="eups-soil-status is-blocked"><AlertTriangle />{loadError}</div> : !dataset ? <div className="eups-soil-loading" role="status"><Loader2 className="spin" />Carregando a tabela de conversão…</div> : <div className="eups-k-information-content"><section><h3>Classe e índice do componente</h3><div className="table-wrap"><table><thead><tr><th>Classe de erodibilidade</th><th>Índice</th></tr></thead><tbody>{dataset.componentErosionIndexes.map((entry) => <tr key={entry.index}><td>{entry.className}</td><td>{entry.index}</td></tr>)}</tbody></table></div></section><section><h3>Pesos por quantidade de componentes</h3><div className="table-wrap"><table><thead><tr><th>Componentes</th><th>C1</th><th>C2</th><th>C3</th><th>C4</th></tr></thead><tbody>{dataset.weights.map((entry) => <tr key={entry.componentCount}><td>{entry.componentCount}</td>{COMPONENTS.map((component) => <td key={component}>{formatPercent(entry.weights[component])}</td>)}</tr>)}</tbody></table></div></section><section><h3>Conversão do índice ponderado</h3><div className="table-wrap eups-k-conversion-table-wrap"><table><thead><tr><th>Índice ponderado</th><th>Fator K</th><th>Classe resultante</th></tr></thead><tbody>{dataset.kConversion.map((entry) => <tr key={entry.weightedIndex}><td>{formatTenth(entry.weightedIndex)}</td><td>{formatK(entry.factorK)}</td><td>{entry.resultClass}</td></tr>)}</tbody></table></div></section></div>}</section></div>;
}

function SoilResolution({ resolution, confirmed, onConfirm }: { resolution: EupsSoilResolution; confirmed: boolean; onConfirm: () => void }) {
  if (resolution.kind === "pending") return <p className="eups-soil-hint">{resolution.message}</p>;
  if (resolution.kind === "automatic") return <div className="eups-soil-status is-ready"><CheckCircle2 /><div><strong>Componente resolvido</strong><span>{resolution.path?.erosion.className} · índice {resolution.path?.erosion.index}</span></div></div>;
  if (resolution.kind === "confirmation") return <div className="eups-soil-status is-confirmation"><AlertTriangle /><div><strong>Confirmação necessária</strong><span>{resolution.message}</span><button type="button" onClick={onConfirm}>{confirmed ? "Confirmado" : "Confirmar componente"}</button></div></div>;
  return <div className="eups-soil-status is-blocked"><AlertTriangle /><div><strong>{resolution.kind === "not-applicable" ? "K não aplicável" : "Resultado indisponível"}</strong><span>{resolution.message}</span></div></div>;
}

function SoilCalculationSummary({ components, resolutions, calculation }: { components: EupsSoilComponent[]; resolutions: Record<EupsSoilComponent, EupsSoilResolution> | null; calculation: ReturnType<typeof calculateSoilK> }) {
  return <section className="eups-soil-calculation" aria-label="Composição do fator K"><div><span>Composição do fator K</span><strong>{calculation ? formatK(calculation.factorK) : "Aguardando componentes"}</strong></div><div className="eups-soil-component-results">{components.map((component) => { const resolution = resolutions?.[component]; const contribution = calculation?.contributions.find((item) => item.component === component); return <div key={component}><strong>{component}</strong><span>{contribution ? `${contribution.className} · índice ${contribution.index} × ${formatPercent(contribution.weight)}` : componentLabel(resolution)}</span>{contribution ? <small>Parcela: {formatTenth(contribution.contribution)}</small> : null}</div>; })}</div>{calculation ? <p>Índice ponderado: <strong>{formatTenth(calculation.weightedIndex)}</strong> · classe resultante: <strong>{calculation.resultClass}</strong></p> : null}</section>;
}

function componentLabel(resolution: EupsSoilResolution | undefined): string {
  if (!resolution || resolution.kind === "pending") return "Pendente";
  if (resolution.kind === "automatic") return `Índice ${resolution.path?.erosion.index}`;
  if (resolution.kind === "confirmation") return "Confirmar";
  if (resolution.kind === "not-applicable") return "Não aplicável";
  return "Revisar";
}

function parseDecimal(value: string): number | null {
  const text = value.trim();
  if (!text || text === "-" || text.endsWith(",") || text.endsWith(".")) return null;
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatK(value: number): string { return value.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }); }
function formatTenth(value: number): string { return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function formatPercent(value: number): string { return value.toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 0 }); }
