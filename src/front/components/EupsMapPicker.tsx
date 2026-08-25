import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
import { Crosshair, MapPin, Ruler, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MapPoint } from "@/components/MapPicker";

type EupsMapPickerProps = {
  point: MapPoint | null;
  slopeLine: MapPoint[];
  onPointChange: (point: MapPoint) => void;
  onSlopeLineChange: (line: MapPoint[]) => void;
};

const markerIcon = L.icon({
  iconRetinaUrl: markerIcon2xUrl,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [13, 50],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER: L.LatLngExpression = [-14.2, -51.9];
const DEFAULT_ZOOM = 4;

export function EupsMapPicker({
  point,
  slopeLine,
  onPointChange,
  onSlopeLineChange,
}: EupsMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const verticesRef = useRef<L.LayerGroup | null>(null);
  const onPointChangeRef = useRef(onPointChange);
  const onSlopeLineChangeRef = useRef(onSlopeLineChange);
  const modeRef = useRef<"point" | "measure">("point");
  const slopeLineRef = useRef<MapPoint[]>(slopeLine);
  const [mode, setMode] = useState<"point" | "measure">("point");

  useEffect(() => {
    onPointChangeRef.current = onPointChange;
    onSlopeLineChangeRef.current = onSlopeLineChange;
    modeRef.current = mode;
    slopeLineRef.current = slopeLine;
  }, [onPointChange, onSlopeLineChange]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    slopeLineRef.current = slopeLine;
  }, [slopeLine]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, { zoomControl: false, worldCopyJump: true })
      .setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    verticesRef.current = L.layerGroup().addTo(map);
    map.on("click", (event) => {
      const nextPoint = { latitude: event.latlng.lat, longitude: event.latlng.lng };
      if (modeRef.current === "measure") {
        onSlopeLineChangeRef.current([...slopeLineRef.current, nextPoint]);
        return;
      }
      onPointChangeRef.current(nextPoint);
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      lineRef.current = null;
      verticesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const latLng: L.LatLngExpression = [point.latitude, point.longitude];
    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, { icon: markerIcon }).addTo(map);
    } else {
      markerRef.current.setLatLng(latLng);
    }
    map.setView(latLng, Math.max(map.getZoom(), 9), { animate: true });
  }, [point]);

  useEffect(() => {
    const map = mapRef.current;
    const vertices = verticesRef.current;
    if (!map || !vertices) return;
    lineRef.current?.remove();
    lineRef.current = null;
    vertices.clearLayers();
    if (slopeLine.length > 0) {
      const points = slopeLine.map((item) => [item.latitude, item.longitude] as L.LatLngExpression);
      lineRef.current = L.polyline(points, { color: "#009b6e", weight: 4, dashArray: "8 6" }).addTo(map);
      slopeLine.forEach((item, index) => {
        L.circleMarker([item.latitude, item.longitude], {
          radius: 5,
          color: "#1a3b29",
          fillColor: "#ffffff",
          fillOpacity: 1,
          weight: 2,
        }).bindTooltip(index === 0 ? "Início da vertente" : `Ponto ${index + 1}`).addTo(vertices);
      });
    }
  }, [slopeLine]);

  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    if (slopeLine.length > 1) {
      map.fitBounds(L.latLngBounds(slopeLine.map((item) => [item.latitude, item.longitude])), {
        padding: [42, 42], maxZoom: 15, animate: true,
      });
      return;
    }
    if (point) {
      map.setView([point.latitude, point.longitude], 8, { animate: true });
      return;
    }
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
  };

  return (
    <div className="map-frame eups-map-frame">
      <div ref={containerRef} className="map-canvas" aria-label="Mapa da área de estudo" />
      <div className="eups-map-toolbar" aria-label="Ferramentas do mapa">
        <button
          type="button"
          className={mode === "point" ? "active" : undefined}
          onClick={() => setMode("point")}
          aria-label="Selecionar ponto de estudo"
        ><MapPin /><span>Local</span></button>
        <button
          type="button"
          className={mode === "measure" ? "active" : undefined}
          onClick={() => setMode("measure")}
          aria-label="Desenhar vertente"
        ><Ruler /><span>Medir L</span></button>
        <button type="button" onClick={() => onSlopeLineChange([])} title="Limpar vertente" aria-label="Limpar vertente"><Crosshair /><span>Limpar</span></button>
        <button type="button" onClick={resetView} title="Reenquadrar mapa" aria-label="Reenquadrar mapa"><RotateCcw /><span>Reenquadrar</span></button>
      </div>
      <div className="map-hint">
        {mode === "measure"
          ? "Marque o início e o fim da vertente. Cada clique adiciona um ponto; L é preenchido a partir do segundo ponto."
          : "Defina o local de estudo e depois selecione Medir L para marcar a vertente."}
      </div>
    </div>
  );
}
