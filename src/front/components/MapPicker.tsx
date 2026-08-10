import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
import { Maximize2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { InmetNormalStation } from "$/inmet-normals";

export type MapPoint = {
  latitude: number;
  longitude: number;
};

type MapPickerProps = {
  point: MapPoint | null;
  onPointChange: (point: MapPoint) => void;
  stations?: InmetNormalStation[];
  selectedStationCode?: string | null;
  previewStation?: InmetNormalStation | null;
  onStationSelect?: (station: InmetNormalStation) => void;
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

const stationIcon = L.divIcon({
  className: "inmet-station-marker",
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const selectedStationIcon = L.divIcon({
  className: "inmet-station-marker is-selected",
  html: '<span></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const previewStationIcon = L.divIcon({
  className: "inmet-station-marker is-preview",
  html: '<span></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const DEFAULT_MAP_CENTER: L.LatLngExpression = [-14.2, -51.9];
const DEFAULT_MAP_ZOOM = 4;
const CONTEXT_ZOOM = 5;

export function MapPicker({
  point,
  onPointChange,
  stations = [],
  selectedStationCode,
  previewStation,
  onStationSelect,
}: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const stationLayerRef = useRef<L.LayerGroup | null>(null);
  const onPointChangeRef = useRef(onPointChange);
  const onStationSelectRef = useRef(onStationSelect);

  useEffect(() => {
    onPointChangeRef.current = onPointChange;
  }, [onPointChange]);

  useEffect(() => {
    onStationSelectRef.current = onStationSelect;
  }, [onStationSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      worldCopyJump: true,
    }).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    map.on("click", (event) => {
      onPointChangeRef.current({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    });
    stationLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      stationLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const latLng: L.LatLngExpression = [point.latitude, point.longitude];
    map.setView(latLng, Math.max(map.getZoom(), 7), { animate: true });

    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, { icon: markerIcon }).addTo(map);
    } else {
      markerRef.current.setLatLng(latLng);
    }
  }, [point]);

  useEffect(() => {
    const map = mapRef.current;
    const focusedStation =
      previewStation ??
      stations.find((station) => station.code === selectedStationCode);

    if (!map || !focusedStation) {
      return;
    }

    map.setView(
      [focusedStation.latitude, focusedStation.longitude],
      7,
      { animate: true },
    );
  }, [stations, selectedStationCode, previewStation]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = stationLayerRef.current;
    if (!map || !layer) {
      return;
    }

    layer.clearLayers();
    stations.forEach((station) => {
      const marker = L.marker([station.latitude, station.longitude], {
        bubblingMouseEvents: false,
        icon:
          station.code === previewStation?.code
            ? previewStationIcon
            : station.code === selectedStationCode
              ? selectedStationIcon
              : stationIcon,
        keyboard: true,
        title: `${station.code} - ${station.name}, ${station.uf}`,
      });
      marker.bindTooltip(
        `<strong>${station.name}</strong><br>${station.code} · ${station.uf}`,
        { direction: "top", offset: [0, -8] },
      );
      marker.on("click", () => {
        onStationSelectRef.current?.(station);
      });
      marker.addTo(layer);
    });
  }, [stations, selectedStationCode, previewStation]);

  const resetMapView = () => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (point) {
      map.setView([point.latitude, point.longitude], CONTEXT_ZOOM, {
        animate: true,
      });
      return;
    }

    if (stations.length > 0) {
      const bounds = L.latLngBounds(
        stations.map((station) => [station.latitude, station.longitude]),
      );
      map.fitBounds(bounds, {
        animate: true,
        maxZoom: CONTEXT_ZOOM,
        padding: [36, 36],
      });
      return;
    }

    map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, { animate: true });
  };

  return (
    <div className="map-frame">
      <div ref={containerRef} className="map-canvas" aria-label="Mapa" />
      <button
        className="map-reset-control"
        type="button"
        aria-label="Reenquadrar mapa"
        title="Reenquadrar mapa"
        onClick={(event) => {
          event.stopPropagation();
          resetMapView();
        }}
      >
        <Maximize2 aria-hidden="true" />
      </button>
      <div className="map-hint">
        {stations.length
          ? "Clique em uma estação INMET para usar a normal climatológica"
          : "Clique no mapa para selecionar outro ponto"}
      </div>
    </div>
  );
}
