import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  K_RENDER_MIN_ZOOM,
  getKColor,
  getKFeaturesForBounds,
  queryKAtPoint,
  type KSpatialSample,
} from "@/lib/eups-k-pmtiles";

export type EupsSpatialPoint = {
  latitude: number;
  longitude: number;
};

type EupsSpatialMapProps = {
  point: EupsSpatialPoint | null;
  onPointChange: (point: EupsSpatialPoint) => void;
};

type KQuery =
  | { status: "idle" | "loading" }
  | { status: "ready"; sample: KSpatialSample }
  | { status: "unavailable" | "error" };

const BRAZIL_BOUNDS: L.LatLngBoundsExpression = [[-34, -74], [5.5, -34]];
const DEFAULT_MAP_CENTER: L.LatLngExpression = [-14.2, -51.9];
const DEFAULT_MAP_ZOOM = 4;

const locationIcon = L.divIcon({
  className: "eups-location-marker",
  html: '<span aria-hidden="true"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

export function EupsSpatialMap({ point, onPointChange }: EupsSpatialMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const kLayerRef = useRef<L.LayerGroup | null>(null);
  const onPointChangeRef = useRef(onPointChange);
  const [kVisible, setKVisible] = useState(true);
  const [kOpacity, setKOpacity] = useState(0.48);
  const [kLayerMessage, setKLayerMessage] = useState(`Aproxime até o zoom ${K_RENDER_MIN_ZOOM} para visualizar K.`);
  const [kQuery, setKQuery] = useState<KQuery>({ status: "idle" });

  useEffect(() => {
    onPointChangeRef.current = onPointChange;
  }, [onPointChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: false, worldCopyJump: true }).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    map.on("click", (event) => {
      onPointChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });

    kLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      kLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = kLayerRef.current;
    if (!map || !layer) return;

    let disposed = false;
    let renderVersion = 0;
    const refreshLayer = async () => {
      const currentRender = ++renderVersion;
      layer.clearLayers();
      if (!kVisible) {
        setKLayerMessage("Camada K oculta.");
        return;
      }
      if (map.getZoom() < K_RENDER_MIN_ZOOM) {
        setKLayerMessage(`Aproxime até o zoom ${K_RENDER_MIN_ZOOM} para visualizar K.`);
        return;
      }

      setKLayerMessage("Carregando polígonos de K...");
      try {
        const bounds = map.getBounds();
        const zoom = Math.min(12, Math.max(K_RENDER_MIN_ZOOM, Math.floor(map.getZoom())));
        const features = await getKFeaturesForBounds({
          north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest(),
        }, zoom);
        if (disposed || currentRender !== renderVersion) return;

        L.geoJSON(features, {
          interactive: false,
          style: (feature) => ({
            color: "#fff",
            fillColor: getKColor(Number(feature?.properties?.k_solos)),
            fillOpacity: kOpacity,
            opacity: 0.55,
            weight: 0.45,
          }),
        }).addTo(layer);
        setKLayerMessage(features.length ? "Camada K oficial carregada." : "Não há polígonos de K nesta área.");
      } catch {
        if (!disposed && currentRender === renderVersion) setKLayerMessage("Não foi possível carregar a camada K.");
      }
    };

    map.on("moveend zoomend", refreshLayer);
    void refreshLayer();
    return () => {
      disposed = true;
      map.off("moveend zoomend", refreshLayer);
    };
  }, [kOpacity, kVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const latLng: L.LatLngExpression = [point.latitude, point.longitude];
    map.setView(latLng, Math.max(map.getZoom(), K_RENDER_MIN_ZOOM), { animate: true });
    if (!markerRef.current) markerRef.current = L.marker(latLng, { icon: locationIcon }).addTo(map);
    else markerRef.current.setLatLng(latLng);
  }, [point]);

  useEffect(() => {
    if (!point) {
      setKQuery({ status: "idle" });
      return;
    }

    let disposed = false;
    setKQuery({ status: "loading" });
    void queryKAtPoint(point).then((sample) => {
      if (!disposed) setKQuery(sample ? { status: "ready", sample } : { status: "unavailable" });
    }).catch(() => {
      if (!disposed) setKQuery({ status: "error" });
    });
    return () => { disposed = true; };
  }, [point]);

  return <div className="eups-spatial-layout">
    <div className="eups-map-frame">
      <div ref={containerRef} className="eups-map-canvas" aria-label="Mapa da EUPS" />
      <button className="map-reset-control" type="button" aria-label="Reenquadrar mapa" title="Reenquadrar mapa" onClick={() => mapRef.current?.fitBounds(BRAZIL_BOUNDS, { padding: [20, 20] })}>
        <Maximize2 aria-hidden="true" />
      </button>
      <div className="map-hint">Clique no mapa para consultar a localização</div>
    </div>

    <aside className="eups-spatial-sidebar" aria-label="Camadas e consulta espacial">
      <fieldset className="eups-layer-controls">
        <legend>Camadas próprias</legend>
        <LayerControl id="eups-layer-r" name="Erosividade anual (R) — aguardando COG" visible={false} opacity={0} disabled />
        <LayerControl id="eups-layer-k" name="Erodibilidade espacial (K)" visible={kVisible} opacity={kOpacity} onVisibleChange={setKVisible} onOpacityChange={setKOpacity} />
      </fieldset>

      <div className="eups-spatial-legend" aria-label="Legenda da camada K"><strong>Legenda de K</strong><Legend /></div>

      <div className="eups-spatial-query" aria-live="polite">
        <strong>Consulta no ponto</strong>
        {!point ? <p>Selecione uma localização no mapa.</p> : <>
          <small>{formatCoordinate(point.latitude)}, {formatCoordinate(point.longitude)}</small>
          <dl>
            <div><dt>R anual</dt><dd><small>Aguardando COG oficial.</small></dd></div>
            <div><dt>K</dt><dd><KQueryValue query={kQuery} /></dd></div>
          </dl>
        </>}
      </div>

      <p className="eups-spatial-layer-status">{kLayerMessage}</p>
      <p className="eups-spatial-disclaimer">K é consultado em polígonos vetoriais. Os valores ainda não entram no cálculo, na síntese ou na exportação.</p>
    </aside>
  </div>;
}

function LayerControl({ id, name, visible, opacity, onVisibleChange, onOpacityChange, disabled = false }: { id: string; name: string; visible: boolean; opacity: number; onVisibleChange?: (value: boolean) => void; onOpacityChange?: (value: number) => void; disabled?: boolean }) {
  return <div className="eups-layer-control">
    <label htmlFor={id}><input id={id} type="checkbox" checked={visible} disabled={disabled} onChange={(event) => onVisibleChange?.(event.target.checked)} />{name}</label>
    <label htmlFor={`${id}-opacity`} className="eups-opacity-control">Opacidade <output>{Math.round(opacity * 100)}%</output><input id={`${id}-opacity`} type="range" min="0" max="1" step="0.05" value={opacity} disabled={disabled} onChange={(event) => onOpacityChange?.(Number(event.target.value))} /></label>
  </div>;
}

function Legend() {
  const items = [["#fee8c8", "até 0,020"], ["#fdbb84", "0,021–0,040"], ["#e34a33", "0,041–0,060"], ["#b30000", "0,061–0,080"], ["#7f0000", "acima de 0,080"]];
  return <div className="eups-legend-group">{items.map(([color, label]) => <div key={label}><i style={{ background: color }} />{label}</div>)}</div>;
}

function KQueryValue({ query }: { query: KQuery }) {
  if (query.status === "loading") return <small>Consultando polígonos...</small>;
  if (query.status === "unavailable") return <small>Indisponível nesta localização.</small>;
  if (query.status === "error") return <small>Não foi possível consultar K.</small>;
  if (query.status !== "ready") return <small>Aguardando seleção.</small>;
  return <>{query.sample.value.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <small>t·h·MJ⁻¹·mm⁻¹</small>{query.sample.erodibilityClass ? <small className="eups-query-detail">{query.sample.erodibilityClass}</small> : null}</>;
}

function formatCoordinate(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 5, maximumFractionDigits: 5 });
}
