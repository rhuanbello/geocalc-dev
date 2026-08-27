import * as flatgeobuf from "flatgeobuf/lib/mjs/geojson";
import GeoRasterLayer from "georaster-layer-for-leaflet";
import parseGeoraster from "georaster";
import { fromUrl, type GeoTIFFImage } from "geotiff";
import L from "leaflet";
import { Crosshair, Eye, EyeOff, Layers3, MapPin, SlidersHorizontal } from "lucide-react";
import { leafletLayer, PolygonSymbolizer } from "protomaps-leaflet";
import proj4 from "proj4";
import { useEffect, useRef, useState } from "react";
import { colorForK, colorForR, featureContainsPoint, type SpatialPoint } from "./eups-spatial-utils";

type LayerAvailability = "checking" | "ready" | "missing" | "failed";

type ValueState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "ready"; message: string; value: number; unit: string; detail?: string }
  | { status: "multiple"; message: string; detail: string }
  | { status: "empty"; message: string }
  | { status: "error"; message: string };

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const R_COG_URL = `${BASE_URL}data/eups/r-erosividade-1775.cog.tif`;
const K_PMTILES_URL = `${BASE_URL}data/eups/k-erodibilidade-6340.pmtiles`;
const K_FLATGEOBUF_URL = `${BASE_URL}data/eups/k-erodibilidade-6340.fgb`;
const BRAZIL_CENTER: L.LatLngExpression = [-14.2, -51.9];
const BRAZIL_ZOOM = 4;

const K_PROVENANCE = "K · Embrapa/CNPS · dataset 6340 · consulta exata no FlatGeobuf";
const R_PROVENANCE = "R · dataset 1775 · pixel consultado no COG local";

async function checkAsset(url: string): Promise<LayerAvailability> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok ? "ready" : "missing";
  } catch {
    return "failed";
  }
}

function formatNumber(value: number, digits = 3) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function stateMessage(availability: LayerAvailability, label: string) {
  const prefix = label ? `${label}: ` : "";
  if (availability === "checking") return `${prefix}verificando arquivo local…`;
  if (availability === "missing") return `${prefix}arquivo local não disponível neste ambiente.`;
  if (availability === "failed") return `${prefix}não foi possível acessar o arquivo local.`;
  return `${prefix}camada local pronta.`;
}

export function EupsSpatialMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const rLayerRef = useRef<L.GridLayer | null>(null);
  const kLayerRef = useRef<L.GridLayer | null>(null);
  const rImageRef = useRef<GeoTIFFImage | null>(null);
  const [point, setPoint] = useState<SpatialPoint | null>(null);
  const [rAvailability, setRAvailability] = useState<LayerAvailability>("checking");
  const [kAvailability, setKAvailability] = useState<LayerAvailability>("checking");
  const [showR, setShowR] = useState(true);
  const [showK, setShowK] = useState(true);
  const [rOpacity, setROpacity] = useState(0.62);
  const [kOpacity, setKOpacity] = useState(0.68);
  const [rValue, setRValue] = useState<ValueState>({ status: "idle", message: "Selecione um ponto para consultar R." });
  const [kValue, setKValue] = useState<ValueState>({ status: "idle", message: "Selecione um ponto para consultar K." });

  useEffect(() => {
    void Promise.all([checkAsset(R_COG_URL), checkAsset(K_PMTILES_URL), checkAsset(K_FLATGEOBUF_URL)]).then(([r, pmtiles, fgb]) => {
      setRAvailability(r);
      setKAvailability(pmtiles === "ready" && fgb === "ready" ? "ready" : pmtiles === "checking" || fgb === "checking" ? "checking" : pmtiles === "failed" || fgb === "failed" ? "failed" : "missing");
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || containerRef.current.clientWidth === 0) return;
    const map = L.map(containerRef.current, { zoomControl: false, worldCopyJump: true }).setView(BRAZIL_CENTER, BRAZIL_ZOOM);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);
    map.on("click", (event) => {
      const selectedPoint = { latitude: event.latlng.lat, longitude: event.latlng.lng };
      setPoint(selectedPoint);
      if (!markerRef.current) markerRef.current = L.circleMarker(event.latlng, { radius: 7, color: "#fff", weight: 2, fillColor: "#194b43", fillOpacity: 1 }).addTo(map);
      else markerRef.current.setLatLng(event.latlng);
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || rAvailability !== "ready" || rLayerRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        proj4.defs("EPSG:4674", "+proj=longlat +ellps=GRS80 +no_defs +type=crs");
        const [response, tiff] = await Promise.all([fetch(R_COG_URL), fromUrl(R_COG_URL)]);
        if (!response.ok) throw new Error(`COG indisponível: ${response.status}`);
        const georaster = await parseGeoraster(await response.arrayBuffer());
        if (cancelled) return;
        rImageRef.current = await tiff.getImage();
        const layer = new GeoRasterLayer({ georaster, opacity: rOpacity, resolution: 96, proj4, pixelValuesToColorFn: (values: number[]) => colorForR(values[0] ?? Number.NaN) });
        layer.addTo(map);
        rLayerRef.current = layer;
      } catch { if (!cancelled) setRAvailability("failed"); }
    })();
    return () => { cancelled = true; };
  }, [rAvailability, rOpacity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || kAvailability !== "ready" || kLayerRef.current) return;
    try {
      const layer = leafletLayer({
        url: K_PMTILES_URL,
        opacity: kOpacity,
        paintRules: [{ dataLayer: "k_erodibilidade_6340", symbolizer: new PolygonSymbolizer({ fill: (_zoom, feature) => colorForK(Number(feature?.props.k_solos)), opacity: 0.78, stroke: "#765a4a", width: 0.2 }) }],
        attribution: "K: Embrapa/CNPS, dataset 6340",
      }) as unknown as L.GridLayer;
      layer.addTo(map);
      kLayerRef.current = layer;
    } catch { setKAvailability("failed"); }
  }, [kAvailability, kOpacity]);

  useEffect(() => { rLayerRef.current?.setOpacity(showR ? rOpacity : 0); }, [showR, rOpacity]);
  useEffect(() => { kLayerRef.current?.setOpacity(showK ? kOpacity : 0); }, [showK, kOpacity]);

  useEffect(() => {
    if (!point) return;
    const queryK = async () => {
      if (kAvailability !== "ready") return setKValue({ status: "empty", message: stateMessage(kAvailability, "K") });
      setKValue({ status: "loading", message: "Consultando K na unidade de mapeamento…" });
      try {
        const delta = 0.00002;
        const candidates: GeoJSON.Feature[] = [];
        for await (const feature of flatgeobuf.deserialize(K_FLATGEOBUF_URL, { minX: point.longitude - delta, maxX: point.longitude + delta, minY: point.latitude - delta, maxY: point.latitude + delta })) candidates.push(feature as GeoJSON.Feature);
        const matches = candidates.filter((feature) => featureContainsPoint(feature, point));
        if (matches.length === 0) return setKValue({ status: "empty", message: "K sem cobertura para este ponto." });
        if (matches.length > 1) return setKValue({ status: "multiple", message: "O ponto está na borda de mais de uma unidade de solo.", detail: "Mova o marcador levemente para consultar uma unidade única." });
        const properties = matches[0]?.properties ?? {};
        const value = Number(properties.k_solos);
        if (!Number.isFinite(value)) return setKValue({ status: "empty", message: "A unidade encontrada não possui K numérico." });
        setKValue({ status: "ready", message: "Valor de referência espacial; não foi aplicado ao cálculo.", value, unit: String(properties.fator_k_um ?? "t·h·MJ⁻¹·mm⁻¹"), detail: String(properties.legenda ?? properties.nom_unidad ?? "Unidade sem legenda") });
      } catch { setKValue({ status: "error", message: "Não foi possível consultar K no arquivo local." }); }
    };
    const queryR = async () => {
      if (rAvailability !== "ready") return setRValue({ status: "empty", message: stateMessage(rAvailability, "R") });
      setRValue({ status: "loading", message: "Consultando R no pixel do COG…" });
      try {
        const image = rImageRef.current ?? await (await fromUrl(R_COG_URL)).getImage();
        rImageRef.current = image;
        const [originX, originY] = image.getOrigin();
        const [resolutionX, resolutionY] = image.getResolution();
        const pixelX = Math.floor((point.longitude - originX) / resolutionX);
        const pixelY = Math.floor((point.latitude - originY) / resolutionY);
        if (pixelX < 0 || pixelY < 0 || pixelX >= image.getWidth() || pixelY >= image.getHeight()) return setRValue({ status: "empty", message: "R sem cobertura para este ponto." });
        const rasters = await image.readRasters({ window: [pixelX, pixelY, pixelX + 1, pixelY + 1], width: 1, height: 1 });
        const value = Number(rasters[0]?.[0]);
        const noData = Number(image.getGDALNoData());
        if (!Number.isFinite(value) || value === noData) return setRValue({ status: "empty", message: "O pixel selecionado é NoData." });
        setRValue({ status: "ready", message: "Valor de referência espacial; não foi aplicado ao cálculo.", value, unit: "MJ·mm·ha⁻¹·h⁻¹·ano⁻¹" });
      } catch { setRValue({ status: "error", message: "Não foi possível consultar R no COG local." }); }
    };
    void Promise.all([queryK(), queryR()]);
  }, [point, kAvailability, rAvailability]);

  return <section className="panel eups-spatial-panel">
    <div className="panel-title"><div className="panel-title-icon"><Layers3 className="size-4" /></div><div><h2>Camadas espaciais de referência</h2><p>Consulta visual local de erosividade e erodibilidade. Os valores não preenchem a EUPS.</p></div></div>
    <div className="eups-spatial-guidance"><Crosshair className="size-4" /><p>Clique no mapa para consultar o pixel de R e a unidade de solo de K. O mapa base usa OpenStreetMap; as camadas temáticas vêm somente dos arquivos locais da plataforma.</p></div>
    <div className="eups-spatial-layout">
      <div className="eups-map-frame"><div ref={containerRef} className="eups-map-canvas" aria-label="Mapa das camadas espaciais da EUPS" /></div>
      <aside className="eups-spatial-sidebar" aria-label="Controles e consulta espacial">
        <div className="eups-layer-controls"><div className="eups-spatial-side-title"><SlidersHorizontal className="size-4" />Camadas locais</div><LayerControl label="Erosividade da chuva · R" visible={showR} opacity={rOpacity} availability={rAvailability} onVisibleChange={setShowR} onOpacityChange={setROpacity} /><LayerControl label="Erodibilidade do solo · K" visible={showK} opacity={kOpacity} availability={kAvailability} onVisibleChange={setShowK} onOpacityChange={setKOpacity} /></div>
        <div className="eups-spatial-legend"><strong>Legenda</strong><div className="eups-ramp"><span>R menor</span><i /><i /><i /><i /><i /><span>R maior</span></div><div className="eups-k-legend"><span className="k-zero" />K = 0 · categoria especial da fonte</div></div>
        <div className="eups-spatial-selection"><div className="eups-spatial-side-title"><MapPin className="size-4" />Consulta do ponto</div>{point ? <p className="eups-coordinate">{point.latitude.toLocaleString("pt-BR", { maximumFractionDigits: 5 })}, {point.longitude.toLocaleString("pt-BR", { maximumFractionDigits: 5 })}</p> : <p>Selecione um ponto no mapa.</p>}<ValueCard label="R · erosividade" source={R_PROVENANCE} state={rValue} /><ValueCard label="K · erodibilidade" source={K_PROVENANCE} state={kValue} /></div>
      </aside>
    </div>
  </section>;
}

function LayerControl({ label, visible, opacity, availability, onVisibleChange, onOpacityChange }: { label: string; visible: boolean; opacity: number; availability: LayerAvailability; onVisibleChange: (value: boolean) => void; onOpacityChange: (value: number) => void }) {
  const ready = availability === "ready";
  return <div className="eups-layer-control"><div><strong>{label}</strong><small>{stateMessage(availability, "")}</small></div><button type="button" aria-label={`${visible ? "Ocultar" : "Exibir"} ${label}`} disabled={!ready} onClick={() => onVisibleChange(!visible)}>{visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</button><input aria-label={`Opacidade de ${label}`} type="range" min="0" max="1" step="0.05" value={opacity} disabled={!ready} onChange={(event) => onOpacityChange(Number(event.target.value))} /></div>;
}

function ValueCard({ label, source, state }: { label: string; source: string; state: ValueState }) {
  const detail = "detail" in state ? state.detail : undefined;
  return <article className={`eups-spatial-value is-${state.status}`}><span>{label}</span>{state.status === "ready" ? <strong>{formatNumber(state.value)} <small>{state.unit}</small></strong> : <strong>{state.status === "loading" ? "Consultando…" : "—"}</strong>}<p>{state.message}</p>{detail ? <em>{detail}</em> : null}<small>{source}</small></article>;
}
