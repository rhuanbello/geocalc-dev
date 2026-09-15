import {
  EUPS_K_COMPONENT_WEIGHTS,
  calculateGuidedK,
  getEupsKComponentResult,
  getEupsKStep,
  type EupsKSelection,
  type GuidedKResult,
} from "$/eups-erodibility";
import { CheckCircle2, CircleAlert, Layers3, RotateCcw, Sparkles } from "lucide-react";
import { StaticCombobox } from "@/components/StaticCombobox";

export type EupsKMode = "guided" | "manual";
export type EupsKComponentCount = 1 | 2 | 3 | 4;

type Props = {
  mode: EupsKMode;
  componentCount: EupsKComponentCount | null;
  selections: EupsKSelection[];
  manualKText: string;
  onModeChange: (mode: EupsKMode) => void;
  onComponentCountChange: (count: EupsKComponentCount) => void;
  onSelectionChange: (componentIndex: number, selection: EupsKSelection) => void;
  onResetComponent: (componentIndex: number) => void;
  onManualKChange: (value: string) => void;
};

export function EupsKGuidedInput({
  mode,
  componentCount,
  selections,
  manualKText,
  onModeChange,
  onComponentCountChange,
  onSelectionChange,
  onResetComponent,
  onManualKChange,
}: Props) {
  const result = componentCount === null ? null : calculateGuidedK(componentCount, selections);

  return (
    <div className="eups-k-workflow">
      <div className="eups-k-modebar">
        <div>
          <span className="eups-k-kicker">Tabela de referência de erodibilidade</span>
          <strong>{mode === "guided" ? "Classificação guiada" : "Valor de K informado manualmente"}</strong>
        </div>
        <button className="text-button" type="button" onClick={() => onModeChange(mode === "guided" ? "manual" : "guided")}>
          {mode === "guided" ? "Informar K manualmente" : "Usar classificação guiada"}
        </button>
      </div>

      {mode === "manual" ? (
        <div className="eups-k-manual">
          <label className="eups-number-field" htmlFor="eups-k">
            <span>Fator K <small>t·h·MJ⁻¹·mm⁻¹</small></span>
            <input id="eups-k" aria-label="Fator K" inputMode="decimal" value={manualKText} placeholder="Informar valor técnico" onChange={(event) => onManualKChange(event.target.value)} />
            <em>Use esta alternativa somente quando houver um valor técnico específico para a área avaliada.</em>
          </label>
        </div>
      ) : (
        <>
          <fieldset className="eups-k-count" aria-describedby="eups-k-count-help">
            <legend>Quantos componentes formam a unidade de solo?</legend>
            <p id="eups-k-count-help">Consulte o levantamento ou laudo de solos da área. O sistema aplica automaticamente os pesos definidos para a quantidade informada.</p>
            <div className="eups-k-count-options">
              {([1, 2, 3, 4] as const).map((count) => (
                <button key={count} type="button" className={componentCount === count ? "is-selected" : ""} aria-pressed={componentCount === count} onClick={() => onComponentCountChange(count)}>
                  <strong>{count}</strong><span>{count === 1 ? "componente" : "componentes"}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {componentCount === null ? <div className="eups-k-awaiting"><Layers3 />Escolha a composição da unidade para iniciar a classificação.</div> : (
            <div className="eups-k-components">
              {Array.from({ length: componentCount }, (_, componentIndex) => {
                const selection = selections[componentIndex] ?? {};
                const componentResult = getEupsKComponentResult(componentIndex + 1, selection);
                const previousComplete = componentIndex === 0 || getEupsKComponentResult(componentIndex, selections[componentIndex - 1] ?? {}).state === "complete";
                return <ComponentCard
                  key={componentIndex}
                  componentIndex={componentIndex}
                  selection={selection}
                  componentResult={componentResult}
                  isEnabled={previousComplete}
                  onSelectionChange={(nextSelection) => onSelectionChange(componentIndex, nextSelection)}
                  onReset={() => onResetComponent(componentIndex)}
                />;
              })}
            </div>
          )}

          {result ? <KCompositionResult result={result} componentCount={componentCount!} /> : null}
        </>
      )}
    </div>
  );
}

function ComponentCard({
  componentIndex,
  selection,
  componentResult,
  isEnabled,
  onSelectionChange,
  onReset,
}: {
  componentIndex: number;
  selection: EupsKSelection;
  componentResult: ReturnType<typeof getEupsKComponentResult>;
  isEnabled: boolean;
  onSelectionChange: (selection: EupsKSelection) => void;
  onReset: () => void;
}) {
  const step = isEnabled ? getEupsKStep(componentIndex + 1, selection) : null;
  const selectedTrail = Object.entries(selection);
  const stateLabel = componentResult.state === "complete" ? "Identificado" : componentResult.state === "blocked" || componentResult.state === "not-applicable" ? "Revisar" : "Em classificação";

  return (
    <article className={`eups-k-component-card is-${componentResult.state} ${isEnabled ? "" : "is-locked"}`}>
      <header>
        <div><span>Componente {componentIndex + 1}</span><strong>{stateLabel}</strong></div>
        {isEnabled && selectedTrail.length > 0 ? <button type="button" className="icon-text-button" onClick={onReset}><RotateCcw />Reiniciar</button> : null}
      </header>
      {!isEnabled ? <p className="eups-k-component-waiting">Conclua o componente anterior para continuar a composição.</p> : (
        <>
          {selectedTrail.length > 0 ? <div className="eups-k-selection-trail" aria-label={`Escolhas do componente ${componentIndex + 1}`}>
            {componentResult.resolvedPath.map((item) => <span key={`${item.label}-${item.value}`}><small>{item.label}</small>{item.value}</span>)}
          </div> : null}
          {componentResult.state === "complete" ? <div className="eups-k-component-success"><CheckCircle2 /><span><strong>{componentResult.erosionClass}</strong> · índice {componentResult.index}</span></div> : null}
          {componentResult.state === "blocked" || componentResult.state === "not-applicable" ? <div className="eups-k-component-alert"><CircleAlert /><span>{componentResult.message}</span></div> : null}
          {step ? <StaticCombobox id={`eups-k-${componentIndex + 1}-${step.field.id}`} label={step.field.label} value="" options={step.options.map((option) => ({ value: option, label: option }))} onChange={(value) => onSelectionChange({ ...selection, [step.field.id]: value })} placeholder={`Selecionar ${step.field.label.toLocaleLowerCase("pt-BR")}`} /> : null}
        </>
      )}
    </article>
  );
}

function KCompositionResult({ result, componentCount }: { result: GuidedKResult; componentCount: EupsKComponentCount }) {
  if (result.state === "pending") return <div className="eups-k-awaiting"><Sparkles />Complete todos os componentes para calcular o fator K.</div>;
  if (result.state === "blocked") return <div className="eups-k-result-blocked"><CircleAlert />A composição não permite calcular K automaticamente. Revise os componentes ou informe um valor técnico manualmente.</div>;

  return <div className="eups-k-result">
    <div className="eups-k-result-topline"><span>K de referência calculado</span><strong>{formatNumber(result.k, 4)}</strong><small>t·h·MJ⁻¹·mm⁻¹</small></div>
    <p>Índice ponderado: <strong>{formatNumber(result.weightedIndex, 2)}</strong> · classe resultante: <strong>{result.erosionClass}</strong></p>
    <details>
      <summary>Como o K foi composto</summary>
      <div className="table-wrap"><table className="eups-k-composition-table"><thead><tr><th>Componente</th><th>Participação</th><th>Classe</th><th>Índice</th></tr></thead><tbody>{result.components.map((component, index) => <tr key={component.component}><th>Componente {component.component}</th><td>{formatNumber(EUPS_K_COMPONENT_WEIGHTS[componentCount][index]! * 100, 0)}%</td><td>{component.erosionClass}</td><td>{component.index}</td></tr>)}</tbody></table></div>
    </details>
  </div>;
}

function formatNumber(value: number | null, digits: number): string {
  return value === null ? "—" : value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
