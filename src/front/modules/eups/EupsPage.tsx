import {
  BookOpen,
  Clipboard,
  Download,
  FileText,
  Layers3,
  LineChart,
  MapPinned,
  Ruler,
  Sprout,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Formula } from "@/components/Formula";
import { EupsMapPicker } from "@/components/EupsMapPicker";
import { LocationCombobox } from "@/components/LocationCombobox";
import { InmetStationCombobox } from "@/components/InmetStationCombobox";
import { StaticCombobox } from "@/components/StaticCombobox";
import { AppSidebar, type GeoCalcModule } from "@/components/AppSidebar";
import type { MapPoint } from "@/components/MapPicker";
import type { LocationSearchResult } from "@/lib/open-meteo";
import { fetchClimateNormals, reverseGeocodePoint } from "@/lib/open-meteo";
import { exportEupsWorkbook } from "@/lib/eups-excel-export";
import { fetchTopodataSlope } from "@/lib/eups-spatial";
import {
  EMPTY_EUPS_RAINFALL,
  EUPS_MONTHS,
  calculateEups,
  type EupsRainfallInput,
} from "$/eups";
import { measureLine } from "$/geography";
import {
  getInmetStationByCode,
  inmetStationLabel,
  listInmetStations,
  type InmetNormalPeriod,
  type InmetNormalStation,
} from "$/inmet-normals";
import "katex/dist/katex.min.css";

type RainfallMethod = "spatial" | "precipitation";
type RainfallSource = "manual" | "inmet" | "open-meteo";

const INMET_PERIOD_OPTIONS: Array<{ value: InmetNormalPeriod; label: string }> = [
  { value: "1961-1990", label: "1961-1990" },
  { value: "1981-2010", label: "1981-2010" },
  { value: "1991-2020", label: "1991-2020" },
];

const CP_EXAMPLES = [
  "Vegetação nativa: referência aproximada de 0,01.",
  "Pastagem ou cultura temporária com cobertura: referência aproximada de 0,25.",
  "Solo exposto, sem prática conservacionista: 1,00.",
];

export function EupsPage({
  onModuleChange,
}: {
  onModuleChange: (module: GeoCalcModule) => void;
}) {
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [location, setLocation] = useState<LocationSearchResult | null>(null);
  const [slopeLine, setSlopeLine] = useState<MapPoint[]>([]);
  const [rainfallMethod, setRainfallMethod] = useState<RainfallMethod>("spatial");
  const [rainfallSource, setRainfallSource] = useState<RainfallSource>("manual");
  const [rainfallTexts, setRainfallTexts] = useState<string[]>(
    EMPTY_EUPS_RAINFALL.map(() => ""),
  );
  const [inmetPeriod, setInmetPeriod] = useState<InmetNormalPeriod>("1991-2020");
  const [stationCode, setStationCode] = useState<string | null>(null);
  const [previewStation, setPreviewStation] = useState<InmetNormalStation | null>(null);
  const [isImportingRainfall, setIsImportingRainfall] = useState(false);
  const [kText, setKText] = useState("");
  const [rText, setRText] = useState("");
  const [slopeLengthText, setSlopeLengthText] = useState("");
  const [slopeText, setSlopeText] = useState("");
  const [cpText, setCpText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [slopeLookup, setSlopeLookup] = useState<"idle" | "loading" | "available" | "unavailable">("idle");
  const [slopeLookupMessage, setSlopeLookupMessage] = useState("Defina um local para consultar a declividade.");

  const selectedStation = useMemo(
    () => getInmetStationByCode(stationCode, inmetPeriod),
    [stationCode, inmetPeriod],
  );
  const rainfall = useMemo<EupsRainfallInput[]>(
    () => rainfallTexts.map(parseDecimal),
    [rainfallTexts],
  );
  const slopeLineLength = useMemo(() => measureLine(slopeLine), [slopeLine]);
  const k = parseDecimal(kText);
  const spatialR = parseDecimal(rText);
  const slopeLength = parseDecimal(slopeLengthText);
  const slopePercent = parseDecimal(slopeText);
  const cp = parseDecimal(cpText);
  const result = useMemo(
    () =>
      calculateEups({
        rainfall,
        rainfallMethod,
        spatialR,
        k,
        slopeLength,
        slopePercent,
        cp,
      }),
    [rainfall, rainfallMethod, spatialR, k, slopeLength, slopePercent, cp],
  );

  useEffect(() => {
    if (!point) {
      setSlopeLookup("idle");
      setSlopeLookupMessage("Defina um local para consultar a declividade.");
      return;
    }

    let cancelled = false;
    setSlopeLookup("loading");
    setSlopeLookupMessage("Consultando a declividade no TOPODATA/INPE...");
    void fetchTopodataSlope(point)
      .then((slope) => {
        if (cancelled) return;
        setSlopeText(formatInput(slope));
        setSlopeLookup("available");
        setSlopeLookupMessage("Declividade carregada do TOPODATA/INPE. Revise o valor para a vertente medida.");
      })
      .catch((error) => {
        if (cancelled) return;
        setSlopeLookup("unavailable");
        setSlopeLookupMessage(error instanceof Error ? error.message : "Não foi possível consultar o TOPODATA.");
      });

    return () => {
      cancelled = true;
    };
  }, [point?.latitude, point?.longitude]);

  const updatePoint = async (nextPoint: MapPoint, selected?: LocationSearchResult | null) => {
    setPoint(nextPoint);
    setLocation(selected ?? null);
    if (selected) return;
    try {
      const namedLocation = await reverseGeocodePoint(nextPoint);
      if (namedLocation) setLocation(namedLocation);
    } catch {
      // Coordinates remain valid when reverse geocoding is unavailable.
    }
  };

  const updateSlopeLine = (nextLine: MapPoint[]) => {
    setSlopeLine(nextLine);
    const measured = measureLine(nextLine);
    if (measured !== null) setSlopeLengthText(formatInput(measured));
  };

  const selectStation = (station: InmetNormalStation | null) => {
    setPreviewStation(null);
    setStationCode(station?.code ?? null);
    if (!station) return;
    setRainfallSource("inmet");
    setRainfallTexts(station.precipitation.map(formatInput));
    void updatePoint(
      { latitude: station.latitude, longitude: station.longitude },
      {
        id: Number(station.code),
        name: station.name,
        admin1: station.uf,
        country: "Brasil",
        latitude: station.latitude,
        longitude: station.longitude,
        timezone: "auto",
      },
    );
    setNotice(`Precipitação da normal INMET ${inmetPeriod} carregada.`);
  };

  const importOpenMeteoRainfall = async () => {
    if (!point) {
      setNotice("Selecione um local antes de importar a precipitação.");
      return;
    }
    setIsImportingRainfall(true);
    try {
      const climate = await fetchClimateNormals({
        latitude: point.latitude,
        longitude: point.longitude,
        timezone: location?.timezone ?? "auto",
        startYear: 1991,
        endYear: 2020,
        effectiveEndDate: "2020-12-31",
      });
      setRainfallTexts(climate.inputs.map((input) => formatInput(input.precipitation)));
      setRainfallSource("open-meteo");
      setNotice(
        climate.missingMonths.length
          ? "Importação concluída com meses incompletos. Revise a tabela."
          : "Precipitação mensal Open-Meteo/ERA5 importada para 1991-2020.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível importar a precipitação.");
    } finally {
      setIsImportingRainfall(false);
    }
  };

  const copySummary = async () => {
    await navigator.clipboard.writeText(buildSummary({
      point, location, rainfallMethod, rainfallSource, k, spatialR,
      slopeLength, slopePercent, cp, result,
    }));
    setNotice("Síntese copiada para a área de transferência.");
  };

  const exportExcel = async () => {
    await exportEupsWorkbook({
      result,
      location,
      point,
      slopeLineLength,
      k,
      slopePercent,
      cp,
      rainfallMethod,
      spatialR,
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
            <p>Estimativa da perda média anual de solo por erosão hídrica, a partir da chuva, solo, relevo e práticas de manejo.</p>
          </div>
          <div className="module-header-index" aria-label="Módulo 02, EUPS"><span>Módulo</span><strong>02</strong><small>EUPS</small></div>
        </header>

        <section className="panel eups-methodology-panel">
          <PanelTitle icon={<BookOpen className="size-4" />} title="Equação Universal de Perda de Solo" description="O método estima perda média anual por erosão laminar. Os fatores permanecem visíveis e revisáveis ao longo do cálculo." />
          <div className="eups-method-grid">
            <MethodCard title="Erosão laminar" body="A água da chuva remove uma camada fina e relativamente uniforme da superfície do solo. O processo pode ser contínuo, mesmo sem formar sulcos visíveis." />
            <MethodCard title="Fatores da equação" body="K representa a suscetibilidade do solo; R o potencial erosivo da chuva; LS reúne comprimento e declividade; CP representa cobertura, manejo e conservação." formula="PS = K \times R \times LS \times CP" />
            <MethodCard title="Fator topográfico" body="O comprimento da vertente L e a declividade S definem a contribuição do relevo. O GeoCalc mede L no mapa e mantém S como um valor revisável." formula="LS = 0{,}00984 \times L^{0{,}63} \times S^{1{,}18}" />
            <MethodCard title="Leitura do resultado" body="PS é apresentado em t/ha/ano. A classificação segue o material de referência: baixa abaixo de 10, média de 10 a 25 e alta acima de 25." />
          </div>
        </section>

        <section className="panel eups-study-panel">
          <PanelTitle icon={<MapPinned className="size-4" />} title="Local e relevo" description="Defina um ponto representativo e desenhe a vertente para registrar o comprimento da rampa." />
          <div className="eups-study-grid">
            <div className="eups-study-controls">
              <LocationCombobox
                value={location}
                fallbackLabel={point ? "Coordenada selecionada no mapa" : undefined}
                onChange={(selected) => {
                  if (!selected) { setLocation(null); setPoint(null); return; }
                  void updatePoint({ latitude: selected.latitude, longitude: selected.longitude }, selected);
                }}
                onError={(message) => message && setNotice(message)}
              />
              <div className="coordinate-facts eups-coordinate-facts">
                <div><span>Latitude</span><strong>{point ? formatCoordinate(point.latitude) : "-"}</strong></div>
                <div><span>Longitude</span><strong>{point ? formatCoordinate(point.longitude) : "-"}</strong></div>
              </div>
              <div className="eups-measurement-card">
                <Ruler />
                <div><strong>Comprimento da vertente</strong><span>Selecione Medir L no mapa e marque pelo menos dois pontos ao longo da rampa. O valor é preenchido automaticamente e permanece editável.</span></div>
                <b>{slopeLineLength === null ? "Aguardando linha" : `${formatNumber(slopeLineLength, 1)} m`}</b>
              </div>
              <div className="spatial-status-card">
                <Layers3 />
                <div><strong>{slopeLookup === "loading" ? "Consultando relevo" : "Fatores espaciais"}</strong><span>{slopeLookupMessage} R e K dependem da disponibilização estável das camadas oficiais da Embrapa e continuam para revisão manual.</span></div>
              </div>
            </div>
            <EupsMapPicker point={point} slopeLine={slopeLine} onPointChange={(next) => void updatePoint(next)} onSlopeLineChange={updateSlopeLine} />
          </div>
        </section>

        <section className="panel eups-factors-panel">
          <PanelTitle icon={<Sprout className="size-4" />} title="Fatores da EUPS" description="Valores calculados ou informados para a área representativa. Revise-os antes de interpretar o resultado." />
          <div className="eups-r-methods" role="group" aria-label="Método da erosividade R">
            <button type="button" className={rainfallMethod === "spatial" ? "active" : undefined} onClick={() => setRainfallMethod("spatial")}><strong>Mapa de erosividade</strong><span>Embrapa · consulta espacial em validação</span></button>
            <button type="button" className={rainfallMethod === "precipitation" ? "active" : undefined} onClick={() => setRainfallMethod("precipitation")}><strong>Estimativa por precipitação</strong><span>Fórmula mensal da planilha de cálculo</span></button>
          </div>
          <div className="eups-factor-grid">
            <FactorField code="K" title="Erodibilidade do solo" unit="t·h·MJ⁻¹·mm⁻¹" value={kText} onChange={setKText} note="Valor numérico deve ser informado ou revisto." />
            {rainfallMethod === "spatial" ? <FactorField code="R" title="Erosividade da chuva" unit="MJ·mm·ha⁻¹·h⁻¹·ano⁻¹" value={rText} onChange={setRText} note="Enquanto a consulta Embrapa estiver em validação, informe o valor para revisão." /> : <ResultFactor code="R" title="Erosividade estimada" value={result.rainfallErosivity} unit="MJ·mm·ha⁻¹·h⁻¹·ano⁻¹" note="Soma dos índices I30 mensais." />}
            <FactorField code="L" title="Comprimento da vertente" unit="m" value={slopeLengthText} onChange={setSlopeLengthText} note="Preenchido pela linha desenhada ou editado manualmente." />
            <FactorField code="S" title="Declividade" unit="%" value={slopeText} onChange={setSlopeText} note={slopeLookup === "available" ? "Carregada do TOPODATA/INPE; o valor permanece revisável." : slopeLookup === "loading" ? "Consultando TOPODATA/INPE..." : "Informe ou revise o valor de declividade."} />
            <ResultFactor code="LS" title="Fator topográfico" value={result.topographicFactor} unit="adimensional" note="Calculado a partir de L e S." />
            <FactorField code="CP" title="Cobertura, manejo e conservação" unit="0 a 1" value={cpText} onChange={setCpText} note="Escolha humana e contextual; não é deduzida automaticamente." />
          </div>
          <div className="cp-reference"><strong>Referências de CP</strong>{CP_EXAMPLES.map((example) => <span key={example}>{example}</span>)}</div>
        </section>

        {rainfallMethod === "precipitation" ? (
          <section className="panel eups-rainfall-panel">
            <PanelTitle icon={<LineChart className="size-4" />} title="Precipitação para estimativa de R" description="R é calculado com a distribuição mensal da precipitação. O cálculo exige os 12 meses completos." />
            <div className="eups-rainfall-toolbar">
              <StaticCombobox id="eups-rainfall-source" label="Preencher precipitação" value={rainfallSource} options={[{ value: "manual", label: "Informar manualmente" }, { value: "inmet", label: "Normal INMET por estação" }, { value: "open-meteo", label: "Open-Meteo/ERA5 por coordenada" }]} onChange={(value) => setRainfallSource(value as RainfallSource)} />
              {rainfallSource === "inmet" ? <><StaticCombobox id="eups-inmet-period" label="Normal INMET" value={inmetPeriod} options={INMET_PERIOD_OPTIONS} onChange={(value) => { setInmetPeriod(value as InmetNormalPeriod); setStationCode(null); }} /><InmetStationCombobox period={inmetPeriod} value={selectedStation} onChange={selectStation} onPreviewChange={setPreviewStation} /></> : null}
              {rainfallSource === "open-meteo" ? <button className="action-button eups-import-button" type="button" disabled={!point || isImportingRainfall} onClick={() => void importOpenMeteoRainfall()}>{isImportingRainfall ? "Importando..." : "Importar precipitação"}</button> : null}
            </div>
            <div className="eups-rainfall-table-wrap"><table className="eups-rainfall-table"><thead><tr><th>Mês</th><th>r (mm)</th><th>I30</th></tr></thead><tbody>{EUPS_MONTHS.map((month, index) => <tr key={month}><td>{month}</td><td><input inputMode="decimal" aria-label={`Precipitação de ${month}`} value={rainfallTexts[index] ?? ""} onChange={(event) => setRainfallTexts((values) => values.map((value, valueIndex) => valueIndex === index ? event.target.value : value))} /></td><td>{formatNumber(result.rows[index]?.erosivityIndex, 2)}</td></tr>)}</tbody><tfoot><tr><td>Total / R</td><td>{formatNumber(result.precipitationTotal, 1)}</td><td>{formatNumber(result.rainfallErosivity, 2)}</td></tr></tfoot></table></div>
          </section>
        ) : null}

        <section className="panel eups-result-panel">
          <PanelTitle icon={<Layers3 className="size-4" />} title="Resultado da estimativa" description="PNE mostra a contribuição natural de chuva, solo e relevo; PS inclui a cobertura, o manejo e a conservação representados por CP." />
          <div className="eups-result-grid">
            <ResultCard label="Potencial natural de erosão" code="PNE" value={result.naturalErosionPotential} unit="t/ha/ano" />
            <ResultCard label="Perda média anual estimada" code="PS" value={result.soilLoss} unit="t/ha/ano" emphasis />
            <ResultCard label="Classificação" code="PS" value={result.classification} unit="" />
          </div>
          {!result.isComplete ? <div className="eups-errors" role="status"><strong>Dados necessários para concluir:</strong><span>{result.errors[0] ?? "Revise os fatores informados."}</span></div> : null}
        </section>

        <section className="panel report-panel eups-report-panel">
          <PanelTitle icon={<FileText className="size-4" />} title="Síntese dos resultados" description="Registra os fatores adotados, suas fontes e o resultado da estimativa." />
          <textarea value={buildSummary({ point, location, rainfallMethod, rainfallSource, k, spatialR, slopeLength, slopePercent, cp, result })} readOnly />
          <div className="button-row"><button className="action-button" type="button" onClick={() => void copySummary()}><Clipboard />Copiar síntese</button><button className="secondary-button" type="button" onClick={() => void exportExcel()}><Download />Exportar Excel</button></div>
        </section>

        <section className="panel reference-panel">
          <PanelTitle icon={<BookOpen className="size-4" />} title="Referências e fontes" description="Fontes metodológicas e espaciais previstas para a análise por ponto." />
          <div className="reference-grid eups-reference-grid">
            <ReferenceCard title="EUPS" body="Wischmeier e Smith. Fórmula e parâmetros adotados na tabela de cálculo." />
            <ReferenceCard title="Embrapa" body="Mapa nacional de erosividade da chuva e mapa de erodibilidade dos solos do Brasil." href="https://geoinfo.dados.embrapa.br/" />
            <ReferenceCard title="TOPODATA / INPE" body="Dados geomorfométricos derivados de SRTM; declividade em porcentagem." href="https://data.inpe.br/bdc/stac/v1/collections/topodata-1" />
            <ReferenceCard title="Dados de precipitação" body="INMET por normal climatológica e Open-Meteo/ERA5 como alternativa por coordenada." href="https://open-meteo.com/en/docs/historical-weather-api" />
          </div>
        </section>
        {notice ? <div className="eups-notice" role="status">{notice}<button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso">×</button></div> : null}
      </main>
    </div>
  );
}

function MethodCard({ title, body, formula }: { title: string; body: string; formula?: string }) {
  return <article className="eups-method-card"><h3>{title}</h3><p>{body}</p>{formula ? <Formula latex={formula} className="formula" /> : null}</article>;
}

function FactorField({ code, title, unit, value, onChange, note }: { code: string; title: string; unit: string; value: string; onChange: (value: string) => void; note: string }) {
  return <article className="eups-factor-card"><span className="eups-factor-code">{code}</span><h3>{title}</h3><small>{unit}</small><input value={value} inputMode="decimal" aria-label={title} placeholder="Informar valor" onChange={(event) => onChange(event.target.value)} /><p>{note}</p></article>;
}

function ResultFactor({ code, title, value, unit, note }: { code: string; title: string; value: number | null; unit: string; note: string }) {
  return <article className="eups-factor-card is-result"><span className="eups-factor-code">{code}</span><h3>{title}</h3><strong>{formatNumber(value, 3)}</strong><small>{unit}</small><p>{note}</p></article>;
}

function ResultCard({ label, code, value, unit, emphasis = false }: { label: string; code: string; value: number | string | null; unit: string; emphasis?: boolean }) {
  return <article className={`eups-result-card${emphasis ? " is-emphasis" : ""}`}><span>{code}</span><h3>{label}</h3><strong>{typeof value === "number" ? formatNumber(value, 2) : value ?? "-"}</strong>{unit ? <small>{unit}</small> : null}</article>;
}

function ReferenceCard({ title, body, href }: { title: string; body: string; href?: string }) {
  return <article className="reference-card">{href ? <a href={href} target="_blank" rel="noreferrer">{title}</a> : <strong>{title}</strong>}<span>{body}</span></article>;
}

function PanelTitle({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="panel-title"><div className="panel-title-icon">{icon}</div><div><h2>{title}</h2><p>{description}</p></div></div>;
}

function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized || normalized === "-" || normalized.endsWith(".")) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatInput(value: number | null): string {
  return value === null ? "" : value.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "-" : value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatCoordinate(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 5, maximumFractionDigits: 5 });
}

function buildSummary({ point, location, rainfallMethod, rainfallSource, k, spatialR, slopeLength, slopePercent, cp, result }: { point: MapPoint | null; location: LocationSearchResult | null; rainfallMethod: RainfallMethod; rainfallSource: RainfallSource; k: number | null; spatialR: number | null; slopeLength: number | null; slopePercent: number | null; cp: number | null; result: ReturnType<typeof calculateEups> }) {
  const local = location ? [location.name, location.admin1, location.country].filter(Boolean).join(", ") : "Não informado";
  return [
    "Síntese dos resultados - Perda de Solo (EUPS)", "", `Local: ${local}`,
    `Coordenadas: ${point ? `${formatCoordinate(point.latitude)}, ${formatCoordinate(point.longitude)}` : "não informadas"}`,
    `Método de R: ${rainfallMethod === "spatial" ? "mapa de erosividade da Embrapa (consulta em validação)" : `estimativa pela precipitação mensal (${rainfallSource})`}`,
    `Situação: ${result.isComplete ? "cálculo concluído" : "pendente de entradas ou revisão"}`, "",
    "Fatores adotados:", `- K: ${formatNumber(k, 3)}`, `- R: ${formatNumber(result.rainfallErosivity ?? spatialR, 2)}`,
    `- L: ${formatNumber(slopeLength, 1)} m`, `- S: ${formatNumber(slopePercent, 1)} %`, `- LS: ${formatNumber(result.topographicFactor, 3)}`,
    `- CP: ${formatNumber(cp, 3)}`, "", `Potencial natural de erosão (PNE): ${formatNumber(result.naturalErosionPotential, 2)} t/ha/ano`,
    `Perda média anual estimada (PS): ${formatNumber(result.soilLoss, 2)} t/ha/ano`, `Classificação: ${result.classification ?? "não calculada"}`,
    "", "Referências: EUPS (Wischmeier e Smith); Embrapa para R e K; TOPODATA/INPE para declividade.",
  ].join("\n");
}
