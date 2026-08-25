import {
  BarChart3,
  BadgeCheck,
  BookOpen,
  Clipboard,
  CloudSun,
  Database,
  Download,
  FileText,
  Loader2,
  MapPin,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { InmetStationCombobox } from "@/components/InmetStationCombobox";
import { LocationCombobox } from "@/components/LocationCombobox";
import { MapPicker, type MapPoint } from "@/components/MapPicker";
import { StaticCombobox } from "@/components/StaticCombobox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/components/ui/tooltip";
import {
  Toast,
  ToastClose,
  ToastProvider,
  ToastProgress,
  ToastTitle,
  ToastViewport,
} from "@/shadcn/components/ui/toast";
import {
  fetchClimateNormals,
  reverseGeocodePoint,
  CLIMATE_MODEL_LABEL,
  type LocationSearchResult,
} from "@/lib/open-meteo";
import {
  MONTHS,
  SUPPORTED_LATITUDES,
  calculateWaterBalance,
  getMonthlyInputError,
  nearestFactorSelection,
  type FactorSelection,
  type Hemisphere,
  type MonthlyInput,
  type MonthlyWaterBalance,
} from "$/water-balance";
import { formatIsoDatePtBr } from "$/date-format";
import {
  CLIMATE_IMPORT_METHODOLOGY,
  REFERENCE_SOURCES,
  WATER_BALANCE_METHODOLOGY,
  getClimatePeriodPresets,
  type ClimatePeriodPresetId,
} from "$/academic";
import {
  getInmetStationByCode,
  inmetStationLabel,
  inmetStationToMonthlyInputs,
  listInmetStations,
  type ClimateDataSource,
  type InmetNormalPeriod,
  type InmetNormalStation,
} from "$/inmet-normals";
import "katex/dist/katex.min.css";
import {Formula} from "@/components/Formula";
import { AppSidebar, type GeoCalcModule } from "@/components/AppSidebar";
import { EupsPage } from "@/modules/eups/EupsPage";

type SourceState = "manual" | "open-meteo" | "inmet";

type MonthlyTextInput = {
  precipitation: string;
  temperature: string;
};

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_START_YEAR = 1991;
const DEFAULT_END_YEAR = 2020;
const NOTIFICATION_DURATION = 4000;
const CLIMATE_PERIOD_PRESETS = getClimatePeriodPresets();
const EMPTY_MONTHLY_TEXT_INPUTS: MonthlyTextInput[] = MONTHS.map(() => ({
  precipitation: "",
  temperature: "",
}));
const HEMISPHERE_OPTIONS: Array<{ value: Hemisphere; label: string }> = [
  { value: "south", label: "Sul" },
  { value: "north", label: "Norte" },
];

function inmetPeriodYears(period: InmetNormalPeriod): [number, number] {
  const [startYear, endYear] = period.split("-").map(Number);
  return [startYear, endYear];
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatInputNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }

  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

function formatCoordinate(value: number): string {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  });
}

function parseDecimalText(value: string): number | null {
  const trimmed = value.trim();

  if (
    !trimmed ||
    trimmed === "-" ||
    trimmed.endsWith(",") ||
    trimmed.endsWith(".")
  ) {
    return null;
  }

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function locationLabel(
  location: LocationSearchResult | null,
  point?: MapPoint | null,
): string {
  if (!location) {
    return point ? "Coordenada selecionada no mapa" : "Sem local selecionado";
  }

  return [location.name, location.admin1, location.country]
    .filter(Boolean)
    .join(", ");
}

function selectedCoordinateLabel(point: MapPoint | null): string | undefined {
  return point ? "Coordenada selecionada no mapa" : undefined;
}

function getEffectiveEndDate(endYear: number): string {
  const requestedEnd = new Date(Date.UTC(endYear, 11, 31));
  const safeCurrentDate = new Date();
  safeCurrentDate.setDate(safeCurrentDate.getDate() - 5);

  const effectiveEnd =
    requestedEnd.getTime() < safeCurrentDate.getTime()
      ? requestedEnd
      : safeCurrentDate;

  return effectiveEnd.toISOString().slice(0, 10);
}

export function App() {
  const [activeModule, setActiveModule] = useState<GeoCalcModule>("water-balance");

  if (activeModule === "eups") {
    return <EupsPage onModuleChange={setActiveModule} />;
  }

  return <WaterBalancePage onModuleChange={setActiveModule} />;
}

function WaterBalancePage({
  onModuleChange,
}: {
  onModuleChange: (module: GeoCalcModule) => void;
}) {
  const [monthlyTextInputs, setMonthlyTextInputs] = useState<MonthlyTextInput[]>(
    EMPTY_MONTHLY_TEXT_INPUTS,
  );
  const [sourceState, setSourceState] = useState<SourceState>("manual");
  const [climateDataSource, setClimateDataSource] =
    useState<ClimateDataSource>("inmet");
  const [inmetPeriod, setInmetPeriod] =
    useState<InmetNormalPeriod>("1991-2020");
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<LocationSearchResult | null>(null);
  const [selectedInmetStationCode, setSelectedInmetStationCode] =
    useState<string | null>(null);
  const [previewedInmetStation, setPreviewedInmetStation] =
    useState<InmetNormalStation | null>(null);
  const [factorSelection, setFactorSelection] = useState<FactorSelection>({
    hemisphere: "south",
    latitude: 30,
  });
  const [periodPreset, setPeriodPreset] =
    useState<ClimatePeriodPresetId>("1991-2020");
  const [startYear, setStartYear] = useState(DEFAULT_START_YEAR);
  const [endYear, setEndYear] = useState(DEFAULT_END_YEAR);
  const [isImporting, setIsImporting] = useState(false);
  const [isIdentifyingLocation, setIsIdentifyingLocation] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: number;
    message: string;
  }>>([]);
  const nextNotificationId = useRef(0);
  const notificationTimeouts = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const monthlyInputs = useMemo<MonthlyInput[]>(
    () =>
      monthlyTextInputs.map((input) => ({
        precipitation: parseDecimalText(input.precipitation),
        temperature: parseDecimalText(input.temperature),
      })),
    [monthlyTextInputs],
  );
  const selectedInmetStation = useMemo(
    () =>
      climateDataSource === "inmet"
        ? getInmetStationByCode(selectedInmetStationCode, inmetPeriod)
        : null,
    [climateDataSource, inmetPeriod, selectedInmetStationCode],
  );
  const selectedInmetPeriod = climateDataSource === "inmet" ? inmetPeriod : null;
  const effectiveEndDate = useMemo(() => getEffectiveEndDate(endYear), [endYear]);
  const waterBalance = useMemo(
    () => calculateWaterBalance(monthlyInputs, factorSelection),
    [monthlyInputs, factorSelection],
  );
  const report = useMemo(
    () =>
      buildReport({
        result: waterBalance,
        location: selectedLocation,
        point: selectedPoint,
        startYear,
        endYear,
        effectiveEndDate,
        sourceState,
        selectedInmetStation,
        selectedInmetPeriod,
        climateModel: CLIMATE_MODEL_LABEL,
      }),
    [
      waterBalance,
      selectedLocation,
      selectedPoint,
      startYear,
      endYear,
      effectiveEndDate,
      sourceState,
      selectedInmetStation,
      selectedInmetPeriod,
    ],
  );
  const chartData = waterBalance.rows.map((row) => ({
    month: row.shortName,
    precipitation: roundForChart(row.precipitation),
    correctedEtp: roundForChart(row.correctedEtp),
    balance: roundForChart(row.balance),
  }));
  const hasAnyInput = monthlyInputs.some(
    (input) => input.precipitation !== null || input.temperature !== null,
  );
  const canImport =
    climateDataSource === "open-meteo" &&
    selectedPoint !== null &&
    startYear >= 1940 &&
    endYear >= 1940 &&
    startYear <= endYear &&
    endYear <= CURRENT_YEAR;

  const updatePoint = (point: MapPoint, location: LocationSearchResult | null) => {
    setSelectedInmetStationCode(null);
    setSelectedPoint(point);
    setSelectedLocation(location);
    setFactorSelection(nearestFactorSelection(point.latitude));
  };

  const updatePointFromMap = async (point: MapPoint) => {
    if (climateDataSource === "inmet") {
      return;
    }

    setSelectedInmetStationCode(null);
    setSelectedPoint(point);
    setSelectedLocation(null);
    setFactorSelection(nearestFactorSelection(point.latitude));
    setIsIdentifyingLocation(true);

    try {
      const location = await reverseGeocodePoint(point);
      if (location) {
        setSelectedLocation(location);
      }
    } catch {
      // The selected coordinate remains usable when location naming is unavailable.
    } finally {
      setIsIdentifyingLocation(false);
    }
  };

  const clearLocation = () => {
    setSelectedPoint(null);
    setSelectedLocation(null);
    setSelectedInmetStationCode(null);
    setPreviewedInmetStation(null);
    showNotification("Local removido.");
  };

  const handleImportClimate = async () => {
    if (!selectedPoint) {
      return;
    }

    setIsImporting(true);

    try {
      const result = await fetchClimateNormals({
        latitude: selectedPoint.latitude,
        longitude: selectedPoint.longitude,
        timezone: selectedLocation?.timezone ?? "auto",
        startYear,
        endYear,
        effectiveEndDate,
      });
      setMonthlyTextInputs(
        result.inputs.map((input) => ({
          precipitation: formatInputNumber(input.precipitation),
          temperature: formatInputNumber(input.temperature),
        })),
      );
      setSourceState("open-meteo");
      showNotification(
        result.missingMonths.length
          ? "Importação concluída com meses sem dados completos. Revise a tabela."
          : result.fromCache
            ? `Dados climáticos ${CLIMATE_MODEL_LABEL} recuperados do cache desta sessão. Os campos continuam editáveis.`
            : `Dados climáticos ${CLIMATE_MODEL_LABEL} importados. Os campos continuam editáveis.`,
      );
    } catch (error) {
      showNotification(
        error instanceof Error
          ? error.message
          : "Não foi possível importar dados climáticos.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const updateMonthlyInput = (
    index: number,
    field: keyof MonthlyTextInput,
    value: string,
  ) => {
    setMonthlyTextInputs((current) =>
      current.map((input, inputIndex) =>
        inputIndex === index ? { ...input, [field]: value } : input,
      ),
    );
    setSourceState("manual");
  };

  const updateClimateDataSource = (dataSource: ClimateDataSource) => {
    setClimateDataSource(dataSource);
    setPreviewedInmetStation(null);

    if (dataSource === "inmet") {
      const [startYear, endYear] = inmetPeriodYears(inmetPeriod);
      setSelectedInmetStationCode(null);
      setSelectedPoint(null);
      setSelectedLocation(null);
      setMonthlyTextInputs(EMPTY_MONTHLY_TEXT_INPUTS);
      setSourceState("manual");
      setPeriodPreset(inmetPeriod);
      setStartYear(startYear);
      setEndYear(endYear);
      return;
    }

    setSelectedInmetStationCode(null);
    setSelectedPoint(null);
    setSelectedLocation(null);
    setMonthlyTextInputs(EMPTY_MONTHLY_TEXT_INPUTS);
    setSourceState("manual");
  };

  const updateInmetPeriod = (period: InmetNormalPeriod) => {
    const [nextStartYear, nextEndYear] = inmetPeriodYears(period);
    setClimateDataSource("inmet");
    setInmetPeriod(period);
    setSelectedInmetStationCode(null);
    setSelectedPoint(null);
    setSelectedLocation(null);
    setPreviewedInmetStation(null);
    setMonthlyTextInputs(EMPTY_MONTHLY_TEXT_INPUTS);
    setSourceState("manual");
    setPeriodPreset(period);
    setStartYear(nextStartYear);
    setEndYear(nextEndYear);
  };

  const selectInmetStation = (station: InmetNormalStation | null) => {
    setPreviewedInmetStation(null);

    if (!station) {
      setSelectedInmetStationCode(null);
      setSelectedPoint(null);
      setSelectedLocation(null);
      setMonthlyTextInputs(EMPTY_MONTHLY_TEXT_INPUTS);
      setSourceState("manual");
      return;
    }

    const [startYear, endYear] = inmetPeriodYears(inmetPeriod);
    setSelectedInmetStationCode(station.code);
    setSelectedPoint({
      latitude: station.latitude,
      longitude: station.longitude,
    });
    setSelectedLocation({
      id: Number(station.code),
      name: station.name,
      admin1: station.uf,
      country: "Brasil",
      latitude: station.latitude,
      longitude: station.longitude,
      timezone: "auto",
    });
    setFactorSelection(nearestFactorSelection(station.latitude));
    setPeriodPreset(inmetPeriod);
    setStartYear(startYear);
    setEndYear(endYear);
    setMonthlyTextInputs(
      inmetStationToMonthlyInputs(station).map((input) => ({
        precipitation: formatInputNumber(input.precipitation),
        temperature: formatInputNumber(input.temperature),
      })),
    );
    setSourceState("inmet");
    showNotification(
      `Dados INMET ${inmetPeriod} carregados para ${inmetStationLabel(station)}.`,
    );
  };

  const updateStartYear = (value: number) => {
    setStartYear(value);
    setPeriodPreset("custom");
  };

  const updateEndYear = (value: number) => {
    setEndYear(value);
    setPeriodPreset("custom");
  };

  const updatePeriodPreset = (presetId: ClimatePeriodPresetId) => {
    setPeriodPreset(presetId);
    const preset = CLIMATE_PERIOD_PRESETS.find((item) => item.id === presetId);

    if (!preset || preset.id === "custom") {
      return;
    }

    setStartYear(preset.startYear);
    setEndYear(preset.endYear === "current" ? CURRENT_YEAR : preset.endYear);
  };

  const clearInputs = () => {
    setMonthlyTextInputs(EMPTY_MONTHLY_TEXT_INPUTS);
    setSourceState("manual");
    showNotification("Tabela limpa para preenchimento manual.");
  };

  const dismissNotification = (id: number) => {
    const timeout = notificationTimeouts.current.get(id);

    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      notificationTimeouts.current.delete(id);
    }

    setNotifications((current) =>
      current.filter((notification) => notification.id !== id),
    );
  };

  const showNotification = (message: string) => {
    const id = nextNotificationId.current++;

    setNotifications((current) => [
      ...current,
      { id, message }
    ]);

    notificationTimeouts.current.set(
      id,
      window.setTimeout(() => dismissNotification(id), NOTIFICATION_DURATION),
    );
  };

  useEffect(
    () => () => {
      notificationTimeouts.current.forEach((timeout) =>
        window.clearTimeout(timeout),
      );
    },
    [],
  );

  const copyReport = async () => {
    await navigator.clipboard.writeText(report);
    showNotification("Síntese copiada para a área de transferência.");
  };

  const exportExcel = async () => {
    const { exportWaterBalanceWorkbook } = await import("@/lib/excel-export");

    await exportWaterBalanceWorkbook({
      result: waterBalance,
      location: selectedLocation,
      point: selectedPoint,
      startYear,
      endYear,
      effectiveEndDate,
      sourceState,
      selectedInmetStation,
      inmetPeriod: selectedInmetPeriod,
      climateModel: CLIMATE_MODEL_LABEL,
    });
    showNotification("Planilha Excel exportada com sucesso.");
  };

  return (
    <TooltipProvider>
      <ToastProvider duration={NOTIFICATION_DURATION}>
        <div className="app-layout">
          <AppSidebar activeModule="water-balance" onModuleChange={onModuleChange} />

        <main className="app-shell">
          <ModuleHeader />

          <MethodologyPanel />

          <ClimateMethodPanel />

          <ClimatePanel
            selectedLocation={selectedLocation}
            selectedPoint={selectedPoint}
            climateDataSource={climateDataSource}
            selectedInmetStation={selectedInmetStation}
            selectedInmetPeriod={selectedInmetPeriod}
            previewedInmetStation={previewedInmetStation}
            factorSelection={factorSelection}
            startYear={startYear}
            endYear={endYear}
            periodPreset={periodPreset}
            effectiveEndDate={effectiveEndDate}
            canImport={canImport}
            isImporting={isImporting}
            isIdentifyingLocation={isIdentifyingLocation}
            onClimateDataSourceChange={updateClimateDataSource}
            onInmetPeriodChange={updateInmetPeriod}
            onPointChange={updatePoint}
            onMapPointChange={(point) => void updatePointFromMap(point)}
            onInmetStationChange={selectInmetStation}
            onInmetStationPreviewChange={setPreviewedInmetStation}
            onLocationClear={clearLocation}
            onLocationSearchError={(message) => {
              if (message) {
                showNotification(message);
              }
            }}
            onFactorSelectionChange={setFactorSelection}
            onPeriodPresetChange={updatePeriodPreset}
            onStartYearChange={updateStartYear}
            onEndYearChange={updateEndYear}
            onImportClimate={() => void handleImportClimate()}
          />

          <CalculationTable
            rows={waterBalance.rows}
            inputs={monthlyTextInputs}
            monthlyInputs={monthlyInputs}
            hasAnyInput={hasAnyInput}
            onInputChange={updateMonthlyInput}
            onClearInputs={clearInputs}
          />

          <FullWidthChart chartData={chartData} hasAnyInput={hasAnyInput} />

          <ReportPanel report={report} onCopy={copyReport} onExport={exportExcel} />

          <ReferencePanel />
          </main>
        </div>

        {notifications.map((notification) => (
          <Toast
            key={notification.id}
            open
            duration={Infinity}
            // style={
            //   {
            //     "--toast-duration": `${NOTIFICATION_DURATION}ms`,
            //   } as CSSProperties
            // }
            onOpenChange={(open) => {
              if (!open) {
                dismissNotification(notification.id);
              }
            }}
          >
            <ToastTitle>{notification.message}</ToastTitle>
            <ToastClose aria-label="Fechar notificação">×</ToastClose>
            <ToastProgress />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </TooltipProvider>
  );
}

function ModuleHeader() {
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  const logoUrl = `${baseUrl}brand/logo-geoquimica-colorido.png`;

  return (
    <header className="module-header" id="balanco-hidrico">
      <div className="module-header-institution">
        <img src={logoUrl} alt="PPG Geoquímica UFF" />
        <span>Programa de Pós-Graduação em Geociências</span>
      </div>
      <div className="module-header-content">
        <span className="module-kicker">GeoCalc · módulo de cálculo</span>
        <h1>Balanço Hídrico <span>(BH)</span></h1>
        <p>
          Estimativa mensal da disponibilidade de água a partir de precipitação,
          temperatura e fator de correção por latitude.
        </p>
      </div>
      <div className="module-header-index" aria-label="Módulo 01, balanço hídrico">
        <span>Módulo</span>
        <strong>01</strong>
        <small>BH</small>
      </div>
    </header>
  );
}

function MethodologyPanel() {
  return (
    <section className="panel methodology-panel">
      <PanelTitle
        icon={<BookOpen className="size-4" />}
        title="Conceitos básicos e metodologia"
        description="Uma introdução ao método antes da tabela de cálculo."
      />
      <div className="methodology-grid">
        {WATER_BALANCE_METHODOLOGY.map((section) => (
          <article
            key={section.title}
            className={`methodology-card${
              section.title === "Índices na fórmula de Thornthwaite"
                ? " is-thornthwaite-indices"
                : section.title === "Correção de Etp para a latitude" ||
                    section.title === "Superávit (SH) e Déficit (DH) Hídricos"
                  ? " is-half-width"
                  : ""
            }`}
          >
            <h3>{section.title}</h3>
            {section.note ? (
              <p className="methodology-card-note">
                <strong>Observação</strong>
                <span>{section.note}</span>
              </p>
            ) : null}
            <p>{section.body}</p>
            {section.formulas?.length ? (
              <div className="methodology-card-formulas">
                {section.formulas.map((formula) => (
                  <Formula key={formula} latex={formula} className="formula" />
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ClimateMethodPanel() {
  return (
    <section className="panel climate-method-panel">
      <PanelTitle
        icon={<CloudSun className="size-4" />}
        title="Fontes de dados da obtenção da precipitação e temperatura"
        description="O INMET é a fonte principal por estação; Open-Meteo/ERA5 é a alternativa para coordenadas sem estação disponível."
      />
      <div className="climate-method-grid">
        {CLIMATE_IMPORT_METHODOLOGY.map((section) => (
          <article key={section.title} className="climate-method-card">
            <h3>{section.title}</h3>
            <p>{section.body}</p>
            {section.formulas?.length ? (
              <div className="climate-method-card-formulas">
                {section.formulas.map((formula) => (
                  <Formula key={formula} latex={formula} className="formula" />
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ClimatePanel({
  selectedLocation,
  selectedPoint,
  climateDataSource,
  selectedInmetStation,
  selectedInmetPeriod,
  previewedInmetStation,
  factorSelection,
  startYear,
  endYear,
  periodPreset,
  effectiveEndDate,
  canImport,
  isImporting,
  isIdentifyingLocation,
  onClimateDataSourceChange,
  onInmetPeriodChange,
  onPointChange,
  onMapPointChange,
  onInmetStationChange,
  onInmetStationPreviewChange,
  onLocationClear,
  onLocationSearchError,
  onFactorSelectionChange,
  onPeriodPresetChange,
  onStartYearChange,
  onEndYearChange,
  onImportClimate,
}: {
  selectedLocation: LocationSearchResult | null;
  selectedPoint: MapPoint | null;
  climateDataSource: ClimateDataSource;
  selectedInmetStation: InmetNormalStation | null;
  selectedInmetPeriod: InmetNormalPeriod | null;
  previewedInmetStation: InmetNormalStation | null;
  factorSelection: FactorSelection;
  startYear: number;
  endYear: number;
  periodPreset: ClimatePeriodPresetId;
  effectiveEndDate: string;
  canImport: boolean;
  isImporting: boolean;
  isIdentifyingLocation: boolean;
  onClimateDataSourceChange: (dataSource: ClimateDataSource) => void;
  onInmetPeriodChange: (period: InmetNormalPeriod) => void;
  onPointChange: (point: MapPoint, location: LocationSearchResult | null) => void;
  onMapPointChange: (point: MapPoint) => void;
  onInmetStationChange: (station: InmetNormalStation | null) => void;
  onInmetStationPreviewChange: (station: InmetNormalStation | null) => void;
  onLocationClear: () => void;
  onLocationSearchError: (message: string | null) => void;
  onFactorSelectionChange: (selection: FactorSelection) => void;
  onPeriodPresetChange: (preset: ClimatePeriodPresetId) => void;
  onStartYearChange: (value: number) => void;
  onEndYearChange: (value: number) => void;
  onImportClimate: () => void;
}) {
  const isInmetSource = climateDataSource === "inmet";

  return (
    <section className="panel climate-panel">
      <PanelTitle
        icon={<MapPin className="size-4" />}
        title="Local e clima"
        description="Busque uma cidade ou selecione um ponto no mapa para orientar os fatores e a importação climática."
      />

      <div className="climate-grid">
        <div className="climate-controls">
          <div className="source-toggle" aria-label="Fonte dos dados climáticos">
            <div className={`source-group ${isInmetSource ? "active" : ""}`}>
              <div className="source-group-heading">
                <Database aria-hidden="true" />
                <span className="source-group-copy">
                  <span className="source-group-title">
                    INMET
                    <span className="source-recommended">
                      <BadgeCheck aria-hidden="true" />
                      Recomendado
                    </span>
                  </span>
                  <small>Normal por estação</small>
                </span>
              </div>

              <div className="source-period-toggle" role="group" aria-label="Período de referência INMET">
                <button
                  type="button"
                  aria-label="INMET 1961-1990"
                  className={selectedInmetPeriod === "1961-1990" ? "active" : ""}
                  onClick={() => onInmetPeriodChange("1961-1990")}
                >
                  <span className="source-title">1961-1990</span>
                </button>
                <button
                  type="button"
                  aria-label="INMET 1981-2010"
                  className={selectedInmetPeriod === "1981-2010" ? "active" : ""}
                  onClick={() => onInmetPeriodChange("1981-2010")}
                >
                  <span className="source-title">1981-2010</span>
                </button>
                <button
                  type="button"
                  aria-label="INMET 1991-2020"
                  className={selectedInmetPeriod === "1991-2020" ? "active" : ""}
                  onClick={() => onInmetPeriodChange("1991-2020")}
                >
                  <span className="source-title">1991-2020</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              className={`source-option ${isInmetSource ? "" : "active"}`}
              onClick={() => onClimateDataSourceChange("open-meteo")}
            >
              <CloudSun />
              <span>
                <span className="source-group-title">Open-Meteo/ERA5</span>
                <small>Estimativa por coordenada</small>
              </span>
            </button>
          </div>

          {isInmetSource ? (
            <InmetStationCombobox
              period={selectedInmetPeriod ?? "1991-2020"}
              value={selectedInmetStation}
              onChange={onInmetStationChange}
              onPreviewChange={onInmetStationPreviewChange}
            />
          ) : (
            <LocationCombobox
              value={selectedLocation}
              fallbackLabel={
                !selectedLocation
                  ? isIdentifyingLocation
                    ? "Identificando local..."
                    : selectedCoordinateLabel(selectedPoint)
                  : undefined
              }
              onError={onLocationSearchError}
              onChange={(location) => {
                if (!location) {
                  onLocationClear();
                  return;
                }

                onPointChange(
                  {
                    latitude: location.latitude,
                    longitude: location.longitude,
                  },
                  location,
                );
              }}
            />
          )}

          <div className="climate-factor-controls">
            <StaticCombobox
              id="hemisphere"
              label="Hemisfério"
              value={factorSelection.hemisphere}
              options={HEMISPHERE_OPTIONS}
              onChange={(hemisphere) =>
                onFactorSelectionChange({
                  hemisphere,
                  latitude: SUPPORTED_LATITUDES[hemisphere][0],
                })
              }
            />
            <StaticCombobox
              id="latitude"
              label="Latitude de fator"
              value={factorSelection.latitude}
              options={SUPPORTED_LATITUDES[factorSelection.hemisphere].map(
                (latitude) => ({
                  value: latitude,
                  label: `${latitude} graus`,
                }),
              )}
              onChange={(latitude) =>
                onFactorSelectionChange({
                  ...factorSelection,
                  latitude: Number(latitude) as FactorSelection["latitude"],
                })
              }
            />
          </div>

          {isInmetSource ? (
            <div className="inmet-period-card">
              <span>Período de referência</span>
              <strong>{selectedInmetPeriod}</strong>
              <small>Normal climatológica oficial disponível para as estações exibidas.</small>
            </div>
          ) : (
            <StaticCombobox
              id="period-preset"
              label="Período de referência"
              className="period-combobox"
              value={periodPreset}
              options={CLIMATE_PERIOD_PRESETS.map((preset) => ({
                value: preset.id,
                label: preset.label,
              }))}
              onChange={(value) =>
                onPeriodPresetChange(value as ClimatePeriodPresetId)
              }
            />
          )}

          {!isInmetSource && periodPreset === "custom" ? (
            <div className="period-grid">
              <div className="field">
                <label htmlFor="start-year">Início</label>
                <input
                  id="start-year"
                  type="number"
                  value={startYear}
                  min={1940}
                  max={CURRENT_YEAR}
                  onChange={(event) =>
                    onStartYearChange(Number(event.target.value))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="end-year">Fim</label>
                <input
                  id="end-year"
                  type="number"
                  value={endYear}
                  min={1940}
                  max={CURRENT_YEAR}
                  onChange={(event) =>
                    onEndYearChange(Number(event.target.value))
                  }
                />
              </div>
            </div>
          ) : null}

          {isInmetSource ? (
            <div className="import-card inmet-source-card">
              <div>
                <strong>Dados observacionais por estação</strong>
                <span>
                  Ao selecionar uma estação INMET completa, a tabela recebe
                  automaticamente a precipitação e a temperatura mensal da normal
                  climatológica {selectedInmetPeriod}.
                </span>
              </div>
            </div>
          ) : (
            <div className="import-card">
              <div>
                <strong>Importar dados climáticos</strong>
                <span>
                  Usa Open-Meteo/{CLIMATE_MODEL_LABEL} para transformar dados
                  diários em médias mensais do período de referência. Modelo:{" "}
                  {CLIMATE_MODEL_LABEL}. Data final efetiva:{" "}
                  {formatIsoDatePtBr(effectiveEndDate)}.
                </span>
              </div>
              <button
                className="action-button climate-cta"
                type="button"
                disabled={!canImport || isImporting}
                onClick={onImportClimate}
              >
                {isImporting ? <Loader2 className="spin" /> : <CloudSun />}
                Importar dados climáticos
              </button>
            </div>
          )}

          {selectedPoint ? (
            <div className="coordinate-facts" aria-label="Coordenadas selecionadas">
              <div>
                <span>Latitude</span>
                <strong>{formatCoordinate(selectedPoint.latitude)}</strong>
              </div>
              <div>
                <span>Longitude</span>
                <strong>{formatCoordinate(selectedPoint.longitude)}</strong>
              </div>
            </div>
          ) : null}

        </div>

        <MapPicker
          point={selectedPoint}
          onPointChange={isInmetSource ? () => undefined : onMapPointChange}
          stations={
            isInmetSource
              ? listInmetStations(selectedInmetPeriod ?? "1991-2020")
              : []
          }
          selectedStationCode={selectedInmetStation?.code ?? null}
          previewStation={previewedInmetStation}
          onStationSelect={onInmetStationChange}
        />
      </div>
    </section>
  );
}

function CalculationTable({
  rows,
  inputs,
  monthlyInputs,
  hasAnyInput,
  onInputChange,
  onClearInputs,
}: {
  rows: MonthlyWaterBalance[];
  inputs: MonthlyTextInput[];
  monthlyInputs: MonthlyInput[];
  hasAnyInput: boolean;
  onInputChange: (
    index: number,
    field: keyof MonthlyTextInput,
    value: string,
  ) => void;
  onClearInputs: () => void;
}) {
  return (
    <section className="panel table-panel">
      <div className="table-heading">
        <PanelTitle
          icon={<BarChart3 className="size-4" />}
          title="Tabela de cálculo"
          description="Precipitação e temperatura são entradas; as demais colunas são calculadas automaticamente."
        />
        <button
          className="table-clear-button"
          type="button"
          disabled={!hasAnyInput}
          onClick={onClearInputs}
        >
          Limpar dados
        </button>
      </div>
      <div className="table-legend" aria-label="Legenda de entrada e saída">
        <div>
          <span className="legend-swatch input-swatch" />
          Entrada
        </div>
        <div>
          <span className="legend-swatch output-swatch" />
          Saída calculada
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <CalculationTableHeader description="Mês de referência do cálculo.">
                Mês
              </CalculationTableHeader>
              <CalculationTableHeader
                className="input-column"
                description="P: precipitação mensal acumulada em milímetros."
              >
                P (mm)
              </CalculationTableHeader>
              <CalculationTableHeader
                className="input-column"
                description="T: temperatura média mensal em graus Celsius."
              >
                T (C)
              </CalculationTableHeader>
              <CalculationTableHeader
                className="output-column"
                description="FC: fator de correção mensal por hemisfério e latitude."
              >
                Fator
              </CalculationTableHeader>
              <CalculationTableHeader
                className="output-column"
                description="i: índice calorimétrico mensal calculado por (T / 5)^1,514."
              >
                i
              </CalculationTableHeader>
              <CalculationTableHeader
                className="output-column"
                description="ETP: evapotranspiração potencial mensal antes da correção."
              >
                ETP
              </CalculationTableHeader>
              <CalculationTableHeader
                className="output-column"
                description="ETP corrigida: ETP multiplicada pelo fator de correção mensal."
              >
                ETP corr.
              </CalculationTableHeader>
              <CalculationTableHeader
                className="output-column"
                description="SH: superávit hídrico, valores positivos do balanço hídrico."
              >
                SH
              </CalculationTableHeader>
              <CalculationTableHeader
                className="output-column"
                description="DH: déficit hídrico, valores negativos do balanço hídrico."
              >
                DH
              </CalculationTableHeader>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const monthlyInput = monthlyInputs[index] ?? {
                precipitation: null,
                temperature: null,
              };
              const precipitationError = getMonthlyInputError(
                monthlyInput,
                "precipitation",
                index,
              );
              const temperatureError = getMonthlyInputError(monthlyInput, "temperature", index);

              return (
                <tr key={row.month}>
                  <td>{row.monthName}</td>
                  <td className="input-cell">
                    <CalculationInput
                      value={inputs[index]?.precipitation ?? ""}
                      error={precipitationError}
                      ariaLabel={`Precipitação de ${row.monthName}`}
                      onChange={(value) => onInputChange(index, "precipitation", value)}
                    />
                  </td>
                  <td className="input-cell">
                    <CalculationInput
                      value={inputs[index]?.temperature ?? ""}
                      error={temperatureError}
                      ariaLabel={`Temperatura de ${row.monthName}`}
                      onChange={(value) => onInputChange(index, "temperature", value)}
                    />
                  </td>
                <td className="output-cell">{formatNumber(row.correctionFactor, 2)}</td>
                <td className="output-cell">{formatNumber(row.monthlyHeatIndex, 2)}</td>
                <td className="output-cell">{formatNumber(row.etp, 1)}</td>
                <td className="output-cell">{formatNumber(row.correctedEtp, 1)}</td>
                <td className="output-cell positive">
                  {row.balance !== null && row.balance > 0
                    ? formatNumber(row.balance, 1)
                    : "-"}
                </td>
                <td className="output-cell negative">
                  {row.balance !== null && row.balance < 0
                    ? formatNumber(row.balance, 1)
                    : "-"}
                </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CalculationInput({
  value,
  error,
  ariaLabel,
  onChange,
}: {
  value: string;
  error: string | null;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  const input = (
    <input
      value={value}
      className={error ? "input-invalid" : undefined}
      inputMode="decimal"
      aria-invalid={error ? true : undefined}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    />
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{input}</TooltipTrigger>
      {error ? (
        <TooltipContent className="calculation-input-error-tooltip">{error}</TooltipContent>
      ) : null}
    </Tooltip>
  );
}

function CalculationTableHeader({
  children,
  className,
  description,
}: {
  children: ReactNode;
  className?: string;
  description: string;
}) {
  return (
    <th className={className}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="table-header-tooltip-trigger" tabIndex={0}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent>{description}</TooltipContent>
      </Tooltip>
    </th>
  );
}

function FullWidthChart({
  chartData,
  hasAnyInput,
}: {
  chartData: Array<{
    month: string;
    precipitation: number | null;
    correctedEtp: number | null;
    balance: number | null;
  }>;
  hasAnyInput: boolean;
}) {
  return (
    <section className="panel chart-panel">
      <PanelTitle
        icon={<BarChart3 className="size-4" />}
        title="Gráfico mensal"
        description="Comparação entre água disponível, demanda potencial e saldo."
      />
      {hasAnyInput ? (
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ left: 0, right: 20, top: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <ChartTooltip
                formatter={(value) => `${formatNumber(Number(value), 1)} mm`}
                labelFormatter={(label) => `Mês: ${label}`}
              />
              <Bar dataKey="balance" name="BH" fill="var(--leaf)" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="precipitation"
                name="Precipitação"
                stroke="var(--water)"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="correctedEtp"
                name="ETP corrigida"
                stroke="var(--sun)"
                strokeWidth={3}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="empty-panel">
          <BarChart3 />
          <strong>Gráfico aguardando dados</strong>
          <span>
            Insira precipitação e temperatura ou importe dados climáticos para
            visualizar as séries mensais.
          </span>
        </div>
      )}
    </section>
  );
}

function ReportPanel({
  report,
  onCopy,
  onExport,
}: {
  report: string;
  onCopy: () => Promise<void>;
  onExport: () => Promise<void>;
}) {
  return (
    <section className="panel report-panel">
      <PanelTitle
        icon={<FileText className="size-4" />}
        title="Síntese dos resultados"
        description="Texto local para copiar em trabalhos, pesquisas e relatórios."
      />
      <textarea value={report} readOnly />
      <div className="button-row">
        <button className="action-button" type="button" onClick={() => void onCopy()}>
          <Clipboard />
          Copiar síntese
        </button>
        <button className="secondary-button" type="button" onClick={() => void onExport()}>
          <Download />
          Exportar Excel
        </button>
      </div>
    </section>
  );
}

function ReferencePanel() {
  return (
    <section className="panel reference-panel">
      <PanelTitle
        icon={<BookOpen className="size-4" />}
        title="Referências e fontes"
        description="Créditos metodológicos e fontes externas usadas na seleção de local, mapa e dados climáticos."
      />
      <div className="reference-grid">
        {REFERENCE_SOURCES.map((source) => (
          <article className="reference-card" key={source.label}>
            {source.href ? (
              <a href={source.href} target="_blank" rel="noreferrer">
                {source.label}
              </a>
            ) : (
              <strong>{source.label}</strong>
            )}
            <span>{source.description}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function PanelTitle({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="panel-title">
      <div className="panel-title-icon">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function buildReport(params: {
  result: ReturnType<typeof calculateWaterBalance>;
  location: LocationSearchResult | null;
  point: MapPoint | null;
  startYear: number;
  endYear: number;
  effectiveEndDate: string;
  sourceState: SourceState;
  selectedInmetStation: InmetNormalStation | null;
  selectedInmetPeriod: InmetNormalPeriod | null;
  climateModel: string;
}): string {
  const {
    result,
    location,
    point,
    startYear,
    endYear,
    effectiveEndDate,
    sourceState,
    selectedInmetStation,
    selectedInmetPeriod,
    climateModel,
  } = params;
  const deficit = result.annual.maxDeficit;
  const surplus = result.annual.maxSurplus;
  const coordinates = point
    ? `${formatCoordinate(point.latitude)}, ${formatCoordinate(point.longitude)}`
    : "não informado";
  const completionNote = result.isComplete
    ? "Todos os meses possuem entradas suficientes para o cálculo anual."
    : "O cálculo anual será completado quando todos os meses tiverem precipitação e temperatura.";
  const sourceLines =
    sourceState === "inmet" && selectedInmetStation
      ? [
          `Fonte dos dados: INMET Normais Climatológicas do Brasil ${selectedInmetPeriod}`,
          `Estação INMET: ${inmetStationLabel(selectedInmetStation)}`,
        ]
      : sourceState === "open-meteo"
        ? [
            `Fonte dos dados: Open-Meteo Historical Weather API (${climateModel})`,
            `Modelo: ${climateModel}`,
          ]
        : ["Fonte dos dados: entrada manual"];
  const referenceLines =
    sourceState === "inmet"
      ? [
          "- INMET Normais Climatológicas do Brasil: https://portal.inmet.gov.br/normais",
          "- Referência metodológica: Thornthwaite, 1948: https://doi.org/10.2307/210739",
          "- OpenStreetMap: https://www.openstreetmap.org/copyright",
          "- Leaflet: https://leafletjs.com/",
        ]
      : [
          "- Referência metodológica: Thornthwaite, 1948: https://doi.org/10.2307/210739",
          "- Open-Meteo Historical Weather API: https://open-meteo.com/en/docs/historical-weather-api",
          "- OpenStreetMap: https://www.openstreetmap.org/copyright",
          "- Leaflet: https://leafletjs.com/",
          "- Nominatim: https://nominatim.org/release-docs/latest/api/Reverse/",
        ];

  return [
    "Síntese dos resultados - Balanço hídrico",
    "",
    `Local: ${locationLabel(location, point)}`,
    `Coordenadas: ${coordinates}`,
    `Período de referência: ${startYear}-${endYear}`,
    ...(sourceState === "open-meteo"
      ? [`Data final efetiva da importação: ${formatIsoDatePtBr(effectiveEndDate)}`]
      : []),
    ...sourceLines,
    "Base técnica e metodológica preparada para o GeoCalc.",
    `Situação: ${completionNote}`,
    "",
    "Resumo anual:",
    `- Precipitação total: ${formatNumber(result.annual.precipitationTotal)} mm`,
    `- ETP corrigida total: ${formatNumber(result.annual.correctedEtpTotal)} mm`,
    `- Balanço hídrico anual: ${formatNumber(result.annual.balanceTotal)} mm`,
    `- Índice calorimétrico anual I: ${formatNumber(result.annual.annualHeatIndex, 3)}`,
    `- Expoente a: ${formatNumber(result.annual.exponentA, 3)}`,
    "",
    `Maior déficit: ${deficit ? `${deficit.monthName} (${formatNumber(deficit.balance)} mm)` : "não calculado"}`,
    `Maior superávit: ${surplus ? `${surplus.monthName} (${formatNumber(surplus.balance)} mm)` : "não calculado"}`,
    "",
    "Interpretação:",
    "BH positivo indica excedente mensal entre precipitação e evapotranspiração potencial corrigida. BH negativo indica déficit potencial, quando a demanda evaporativa supera a entrada de água pela chuva.",
    "",
    "Fórmulas:",
    "i = (T / 5)^1,514; I = soma(i); a = 675e-9 * I^3 - 771e-7 * I^2 + 0,01792 * I + 0,49239; ETP = 16 * (10 * T / I)^a; ETP corrigida = ETP * fator; BH = P - ETP corrigida.",
    "",
    "Referências e fontes:",
    ...referenceLines,
  ].join("\n");
}

function roundForChart(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(2));
}
