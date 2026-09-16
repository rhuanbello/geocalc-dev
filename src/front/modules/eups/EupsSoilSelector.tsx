import {
  calculateSoilK,
  clearSelectionsAfter,
  getProgressiveSoilFilterSteps,
  resolveSoilComponent,
  type EupsSoilComponent,
  type EupsSoilDataset,
  type EupsSoilFilterId,
  type EupsSoilPathComponent,
  type EupsSoilResolution,
  type EupsSoilSelections,
} from "$/eups-soil-lookup";
import { StaticCombobox } from "@/components/StaticCombobox";
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, Sprout, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const COMPONENTS: EupsSoilComponent[] = ["C1", "C2", "C3", "C4"];
const NON_TAXONOMIC_COMPONENT = "N/A — UM NÃO TAXONÔMICA" as const;
const COMPONENT_COUNT_OPTIONS = [1, 2, 3, 4].map((count) => ({
  value: count,
  label: `${count} componente${count === 1 ? "" : "s"}`,
  description: count === 1 ? "Peso de 100% para C1." : "Informe cada componente para calcular o índice ponderado.",
}));

export type EupsSoilSelectionValue = {
  factorK: number | null;
  referenceLabel: string;
};

type SoilMode = "custom" | "lookup";
type SelectionsByComponent = Record<EupsSoilComponent, EupsSoilSelections>;
type ConfirmationsByComponent = Record<EupsSoilComponent, boolean>;
type OptionalDetailsByComponent = Record<EupsSoilComponent, boolean>;

const EMPTY_SELECTIONS: SelectionsByComponent = { C1: {}, C2: {}, C3: {}, C4: {} };
const EMPTY_CONFIRMATIONS: ConfirmationsByComponent = { C1: false, C2: false, C3: false, C4: false };
const EMPTY_OPTIONAL_DETAILS: OptionalDetailsByComponent = { C1: false, C2: false, C3: false, C4: false };

export function EupsSoilSelector({ onChange }: { onChange: (value: EupsSoilSelectionValue) => void }) {
  const [mode, setMode] = useState<SoilMode>("custom");
  const [manualKText, setManualKText] = useState("");
  const [dataset, setDataset] = useState<EupsSoilDataset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isKInformationOpen, setIsKInformationOpen] = useState(false);
  const [componentCount, setComponentCount] = useState<number | null>(null);
  const [isNonTaxonomic, setIsNonTaxonomic] = useState(false);
  const [activeComponent, setActiveComponent] = useState<EupsSoilPathComponent>("C1");
  const [selections, setSelections] = useState<SelectionsByComponent>(EMPTY_SELECTIONS);
  const [confirmations, setConfirmations] = useState<ConfirmationsByComponent>(EMPTY_CONFIRMATIONS);
  const [optionalDetails, setOptionalDetails] = useState<OptionalDetailsByComponent>(EMPTY_OPTIONAL_DETAILS);
  const activeComponents = componentCount ? COMPONENTS.slice(0, componentCount) : [];

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
  const nonTaxonomicResolution = useMemo(() => dataset ? resolveSoilComponent(dataset, NON_TAXONOMIC_COMPONENT, selections.C1, false) : null, [dataset, selections.C1]);
  const calculation = useMemo(() => !isNonTaxonomic && dataset && resolutions && componentCount ? calculateSoilK(dataset, componentCount, resolutions) : null, [componentCount, dataset, isNonTaxonomic, resolutions]);
  const manualK = parseDecimal(manualKText);
  const hasNotApplicableComponent = isNonTaxonomic
    ? nonTaxonomicResolution?.kind === "not-applicable"
    : Boolean(resolutions && activeComponents.some((component) => resolutions[component].kind === "not-applicable"));

  useEffect(() => {
    if (mode === "custom") {
      onChange({ factorK: manualK, referenceLabel: "Valor personalizado" });
      return;
    }
    onChange({
      factorK: calculation?.factorK ?? null,
      referenceLabel: hasNotApplicableComponent
        ? "Consulta SiBCS · K não aplicável"
        : calculation
          ? `Consulta SiBCS · ${componentCount} componente${componentCount === 1 ? "" : "s"}`
          : componentCount && !isNonTaxonomic
            ? "Consulta SiBCS · composição em andamento"
            : "Consulta SiBCS · composição pendente",
    });
  }, [calculation, componentCount, hasNotApplicableComponent, isNonTaxonomic, manualK, mode, onChange]);

  const selectionComponent: EupsSoilComponent = activeComponent === NON_TAXONOMIC_COMPONENT ? "C1" : activeComponent;
  const activeSoilComponent: EupsSoilComponent | null = activeComponent === NON_TAXONOMIC_COMPONENT ? null : activeComponent;
  const activeResolution = isNonTaxonomic ? nonTaxonomicResolution : componentCount && activeSoilComponent ? resolutions?.[activeSoilComponent] ?? null : null;
  const requiredFilterSteps = dataset && (componentCount || isNonTaxonomic) ? getProgressiveSoilFilterSteps(dataset, activeComponent, selections[selectionComponent]) : [];
  const detailedFilterSteps = dataset && componentCount && activeSoilComponent ? getProgressiveSoilFilterSteps(dataset, activeSoilComponent, selections[selectionComponent], true) : [];
  const isShowingOptionalDetails = Boolean(activeSoilComponent && optionalDetails[activeSoilComponent]);
  const optionalFilterSteps = isShowingOptionalDetails ? detailedFilterSteps.slice(requiredFilterSteps.length) : [];
  const canRefineDescription = Boolean(
    activeSoilComponent
    && activeResolution
    && (activeResolution.kind === "automatic" || activeResolution.kind === "confirmation")
    && detailedFilterSteps.length > requiredFilterSteps.length,
  );

  const selectMode = (nextMode: SoilMode) => {
    setMode(nextMode);
    setLoadError(null);
  };
  const selectComponentCount = (nextCount: number) => {
    setComponentCount(nextCount);
    setIsNonTaxonomic(false);
    if (activeSoilComponent === null || COMPONENTS.indexOf(activeSoilComponent) >= nextCount) setActiveComponent("C1");
  };
  const selectNonTaxonomicUnit = () => {
    setIsNonTaxonomic(true);
    setComponentCount(null);
    setActiveComponent(NON_TAXONOMIC_COMPONENT);
    setSelections((current) => ({ ...current, C1: {} }));
    setConfirmations((current) => ({ ...current, C1: false }));
  };
  const updateFilter = (fieldId: EupsSoilFilterId, value: string) => {
    if (!dataset) return;
    setSelections((current) => {
      const next = { ...current[selectionComponent], [fieldId]: value };
      return { ...current, [selectionComponent]: clearSelectionsAfter(fieldId, next, dataset) };
    });
    setConfirmations((current) => ({ ...current, [selectionComponent]: false }));
  };
  const toggleOptionalDetails = () => {
    if (!activeSoilComponent) return;
    setOptionalDetails((current) => ({ ...current, [activeSoilComponent]: !current[activeSoilComponent] }));
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
      <section className="eups-soil-composition" aria-label="Composição da unidade de mapeamento"><div><span>Composição da unidade</span><strong>{isNonTaxonomic ? "Unidade sem classificação taxonômica" : "Quantos componentes de solo a UM possui?"}</strong><p>{isNonTaxonomic ? "Use este ramo para água, área urbana, afloramento de rocha ou duna/praia." : "O número informado define os pesos usados no índice ponderado e no fator K."}</p><div className="eups-soil-composition-actions" role="group" aria-label="Tipo da unidade"><button type="button" className={!isNonTaxonomic ? "active" : ""} onClick={() => setIsNonTaxonomic(false)}>Componentes de solo</button><button type="button" className={isNonTaxonomic ? "active" : ""} onClick={selectNonTaxonomicUnit}>Unidade não taxonômica</button></div></div>{!isNonTaxonomic ? <StaticCombobox id="eups-soil-component-count" label="Número de componentes da unidade" value={componentCount ?? 0} options={COMPONENT_COUNT_OPTIONS} onChange={selectComponentCount} placeholder="SELECIONAR QUANTIDADE" /> : null}</section>
      {isNonTaxonomic ? <>
        <div className="eups-soil-filter-grid">{requiredFilterSteps.map((step) => <StaticCombobox key={step.id} id={`eups-soil-non-taxonomic-${step.id}`} label={step.label} value={step.value ?? ""} options={step.options.map((option) => ({ value: option, label: option.toLocaleUpperCase("pt-BR") }))} onChange={(value) => updateFilter(step.id, value)} placeholder={`SELECIONAR ${step.label.toLocaleUpperCase("pt-BR")}`} popoverClassName="eups-soil-filter-popover" />)}</div>
        {activeResolution ? <SoilResolution resolution={activeResolution} onConfirm={() => undefined} /> : null}
      </> : componentCount ? <>
        <div className="eups-soil-tabs" role="tablist" aria-label="Componente em edição">{activeComponents.map((component) => <button key={component} type="button" role="tab" aria-selected={activeComponent === component} className={activeComponent === component ? "active" : ""} onClick={() => setActiveComponent(component)}>{component}<small>{componentLabel(resolutions?.[component])}</small></button>)}</div>
        <div className="eups-soil-filter-grid">{requiredFilterSteps.map((step) => <StaticCombobox key={step.id} id={`eups-soil-${activeComponent}-${step.id}`} label={step.label} value={step.value ?? ""} options={step.options.map((option) => ({ value: option, label: option.toLocaleUpperCase("pt-BR") }))} onChange={(value) => updateFilter(step.id, value)} placeholder={`SELECIONAR ${step.label.toLocaleUpperCase("pt-BR")}`} popoverClassName="eups-soil-filter-popover" />)}</div>
        {canRefineDescription ? <section className="eups-soil-optional-details" aria-label="Detalhamento opcional do componente"><button type="button" className="text-button eups-soil-detail-toggle" onClick={toggleOptionalDetails}>{isShowingOptionalDetails ? "Ocultar detalhamento opcional" : "Refinar descrição do componente"}</button>{isShowingOptionalDetails ? <><div><strong>Detalhamento opcional</strong><p>Estes filtros não alteram a classe de erodibilidade, o índice nem o K final. Use-os apenas para conferir e detalhar a descrição do componente.</p></div>{optionalFilterSteps.length ? <div className="eups-soil-filter-grid is-optional">{optionalFilterSteps.map((step) => <StaticCombobox key={step.id} id={`eups-soil-${activeComponent}-optional-${step.id}`} label={step.label} value={step.value ?? ""} options={step.options.map((option) => ({ value: option, label: option.toLocaleUpperCase("pt-BR") }))} onChange={(value) => updateFilter(step.id, value)} placeholder={`SELECIONAR ${step.label.toLocaleUpperCase("pt-BR")}`} popoverClassName="eups-soil-filter-popover" />)}</div> : <p className="eups-soil-hint">A descrição deste componente já está completa.</p>}</> : null}</section> : null}
        {activeResolution ? <SoilResolution resolution={activeResolution} onConfirm={() => setConfirmations((current) => ({ ...current, [selectionComponent]: true }))} /> : null}
        <p className="eups-soil-limit-note">A consulta representa até C4. Unidades com componentes adicionais exigem conferência externa.</p>
        <SoilCalculationSummary dataset={dataset} components={activeComponents} selections={selections} resolutions={resolutions} calculation={calculation} />
      </> : <p className="eups-soil-hint">Informe a composição da UM para iniciar a classificação dos componentes.</p>}
    </> : null}
    <KInformationDialog isOpen={isKInformationOpen} dataset={dataset} loadError={loadError} onClose={() => setIsKInformationOpen(false)} />
  </div>;
}

function KInformationDialog({ isOpen, dataset, loadError, onClose }: { isOpen: boolean; dataset: EupsSoilDataset | null; loadError: string | null; onClose: () => void }) {
  if (!isOpen) return null;
  return <div className="eups-k-information-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="eups-k-information-modal" role="dialog" aria-modal="true" aria-labelledby="eups-k-information-title"><header><div><span className="eups-result-eyebrow">Tabela_K</span><h2 id="eups-k-information-title">Tabela de conversão do fator K</h2><p>Classes dos componentes, pesos e conversão do índice ponderado usados no cálculo da EUPS.</p></div><button type="button" aria-label="Fechar informações sobre o cálculo de K" onClick={onClose} autoFocus><X /></button></header>{loadError ? <div className="eups-soil-status is-blocked"><AlertTriangle />{loadError}</div> : !dataset ? <div className="eups-soil-loading" role="status"><Loader2 className="spin" />Carregando a tabela de conversão…</div> : <div className="eups-k-information-content"><section><h3>Classe e índice do componente</h3><div className="table-wrap"><table><thead><tr><th>Classe de erodibilidade</th><th>Índice</th></tr></thead><tbody>{dataset.componentErosionIndexes.map((entry) => <tr key={entry.index}><td>{entry.className}</td><td>{entry.index}</td></tr>)}</tbody></table></div></section><section><h3>Pesos por quantidade de componentes</h3><div className="table-wrap"><table><thead><tr><th>Componentes</th><th>C1</th><th>C2</th><th>C3</th><th>C4</th></tr></thead><tbody>{dataset.weights.map((entry) => <tr key={entry.componentCount}><td>{entry.componentCount}</td>{COMPONENTS.map((component) => <td key={component}>{formatPercent(entry.weights[component])}</td>)}</tr>)}</tbody></table></div></section><section><h3>Conversão do índice ponderado</h3><div className="table-wrap eups-k-conversion-table-wrap"><table><thead><tr><th>Índice ponderado</th><th>Fator K</th><th>Classe resultante</th></tr></thead><tbody>{dataset.kConversion.map((entry) => <tr key={entry.weightedIndex}><td>{formatTenth(entry.weightedIndex)}</td><td>{formatK(entry.factorK)}</td><td>{entry.resultClass}</td></tr>)}</tbody></table></div></section></div>}</section></div>;
}

function SoilResolution({ resolution, onConfirm }: { resolution: EupsSoilResolution; onConfirm: () => void }) {
  if (resolution.kind === "pending") return <p className="eups-soil-hint">{resolution.message}</p>;
  if (resolution.kind === "automatic") return <div className="eups-soil-status is-ready"><CheckCircle2 /><div><strong>Componente resolvido</strong><span>{resolution.path?.erosion.className} · índice {resolution.path?.erosion.index}</span></div></div>;
  if (resolution.kind === "confirmation") return <div className="eups-soil-status is-confirmation"><AlertTriangle /><div><strong>Confirmação necessária</strong><span>{resolution.message}</span>{resolution.preview ? <small className="eups-soil-preview">Resultado após confirmar: <strong>{resolution.preview.className}</strong> · índice <strong>{resolution.preview.index}</strong></small> : null}<button type="button" onClick={onConfirm}>Confirmar componente</button></div></div>;
  return <div className="eups-soil-status is-blocked"><AlertTriangle /><div><strong>{resolution.kind === "not-applicable" ? "K não aplicável" : "Revisão necessária"}</strong><span>{resolution.message}</span>{resolution.kind === "blocked" ? <small className="eups-soil-preview">Você pode concluir os demais componentes; este precisa ser revisado antes do cálculo final.</small> : null}</div></div>;
}

function SoilCalculationSummary({ dataset, components, selections, resolutions, calculation }: { dataset: EupsSoilDataset; components: EupsSoilComponent[]; selections: SelectionsByComponent; resolutions: Record<EupsSoilComponent, EupsSoilResolution> | null; calculation: ReturnType<typeof calculateSoilK> }) {
  const componentResolutions = components.map((component) => ({ component, resolution: resolutions?.[component] }));
  const notApplicable = componentResolutions.find(({ resolution }) => resolution?.kind === "not-applicable");
  const blocked = componentResolutions.find(({ resolution }) => resolution?.kind === "blocked");
  const confirmation = componentResolutions.find(({ resolution }) => resolution?.kind === "confirmation");
  const pending = componentResolutions.find(({ resolution }) => !resolution || resolution.kind === "pending");
  const status = notApplicable
    ? `K não aplicável: ${notApplicable.component} não possui índice de erodibilidade.`
    : blocked
      ? `Aguardando revisão de ${blocked.component} para calcular K.`
      : confirmation
        ? `Aguardando confirmação de ${confirmation.component} para calcular K.`
        : pending
          ? `Aguardando o preenchimento de ${pending.component}.`
          : null;
  return <section className="eups-soil-calculation" aria-label="Composição do fator K"><div><span>Composição do fator K</span><strong>{calculation ? formatK(calculation.factorK) : notApplicable ? "Não aplicável" : "Aguardando resolução"}</strong></div><div className="eups-soil-component-results">{components.map((component) => { const resolution = resolutions?.[component]; const contribution = calculation?.contributions.find((item) => item.component === component); const detail = getOptionalDetailSummary(dataset, component, selections[component]); return <div key={component}><strong>{component}</strong><span>{contribution ? `${contribution.className} · índice ${contribution.index} × ${formatPercent(contribution.weight)}` : componentLabel(resolution)}</span>{contribution ? <small>Parcela: {formatTenth(contribution.contribution)}</small> : null}{detail ? <small className="eups-soil-selected-details">Detalhamento: {detail}</small> : null}</div>; })}</div>{calculation ? <p>Índice ponderado: <strong>{formatTenth(calculation.weightedIndex)}</strong> · classe resultante: <strong>{calculation.resultClass}</strong></p> : status ? <p>{status}</p> : null}</section>;
}

function getOptionalDetailSummary(dataset: EupsSoilDataset, component: EupsSoilComponent, selections: EupsSoilSelections): string | null {
  const requiredFieldIds = new Set(getProgressiveSoilFilterSteps(dataset, component, selections).map((step) => step.id));
  const selectedDetails = dataset.filters.flatMap((field) => {
    const value = selections[field.id];
    return value && !requiredFieldIds.has(field.id) ? [`${field.label}: ${value}`] : [];
  });
  return selectedDetails.length ? selectedDetails.join(" · ") : null;
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
