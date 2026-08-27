import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { VectorTile } from "@mapbox/vector-tile";
import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";
import { PbfReader } from "pbf";
import { PMTiles } from "pmtiles";

export type EupsKPoint = {
  latitude: number;
  longitude: number;
};

export type KSpatialSample = {
  value: number;
  mappingUnit: string | null;
  erodibilityClass: string | null;
};

type KFeature = Feature<Polygon | MultiPolygon, GeoJsonProperties>;
type TileCoordinate = { x: number; y: number; z: number };

export const K_RENDER_MIN_ZOOM = 7;
const K_QUERY_ZOOM = 12;
const K_LAYER_NAME = "k_erodibilidade";
const MAX_LATITUDE = 85.05112878;

let pmtiles: PMTiles | null = null;
const tileCache = new Map<string, Promise<KFeature[]>>();

export function getKColor(value: number) {
  if (value <= 0.02) return "#fee8c8";
  if (value <= 0.04) return "#fdbb84";
  if (value <= 0.06) return "#e34a33";
  if (value <= 0.08) return "#b30000";
  return "#7f0000";
}

export function getKTileCoordinate(point: EupsKPoint, zoom: number): TileCoordinate {
  const tileCount = 2 ** zoom;
  const latitude = Math.min(MAX_LATITUDE, Math.max(-MAX_LATITUDE, point.latitude));
  const latitudeRadians = latitude * Math.PI / 180;
  const x = Math.min(tileCount - 1, Math.max(0, Math.floor((point.longitude + 180) / 360 * tileCount)));
  const y = Math.min(tileCount - 1, Math.max(0, Math.floor((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * tileCount)));

  return { x, y, z: zoom };
}

export function findKSample(features: KFeature[], point: EupsKPoint): KSpatialSample | null {
  for (const feature of features) {
    const value = Number(feature.properties?.k_solos);
    if (!Number.isFinite(value) || !booleanPointInPolygon([point.longitude, point.latitude], feature)) {
      continue;
    }

    return {
      value,
      mappingUnit: stringValue(feature.properties?.cod_um),
      erodibilityClass: stringValue(feature.properties?.erod_um),
    };
  }

  return null;
}

export async function queryKAtPoint(point: EupsKPoint, signal?: AbortSignal) {
  const center = getKTileCoordinate(point, K_QUERY_ZOOM);
  const tiles = neighboringTiles(center);
  const features = (await Promise.all(tiles.map((tile) => readKTile(tile, signal)))).flat();

  return findKSample(features, point);
}

export async function getKFeaturesForBounds(bounds: { north: number; south: number; east: number; west: number }, zoom: number, signal?: AbortSignal) {
  const northWest = getKTileCoordinate({ latitude: bounds.north, longitude: bounds.west }, zoom);
  const southEast = getKTileCoordinate({ latitude: bounds.south, longitude: bounds.east }, zoom);
  const tiles: TileCoordinate[] = [];

  for (let x = northWest.x; x <= southEast.x; x += 1) {
    for (let y = northWest.y; y <= southEast.y; y += 1) {
      tiles.push({ x, y, z: zoom });
    }
  }

  return (await Promise.all(tiles.map((tile) => readKTile(tile, signal)))).flat();
}

function getPmtiles() {
  if (!pmtiles) {
    pmtiles = new PMTiles(`${import.meta.env.BASE_URL ?? "/"}eups/k-erodibilidade.pmtiles`);
  }

  return pmtiles;
}

function neighboringTiles(center: TileCoordinate) {
  const tileCount = 2 ** center.z;
  const tiles: TileCoordinate[] = [];

  for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
    for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
      const y = center.y + yOffset;
      if (y < 0 || y >= tileCount) {
        continue;
      }

      tiles.push({
        x: (center.x + xOffset + tileCount) % tileCount,
        y,
        z: center.z,
      });
    }
  }

  return tiles;
}

function readKTile(tile: TileCoordinate, signal?: AbortSignal): Promise<KFeature[]> {
  const key = `${tile.z}/${tile.x}/${tile.y}`;
  const cached = tileCache.get(key);
  if (cached) {
    return cached;
  }

  const request = getPmtiles().getZxy(tile.z, tile.x, tile.y, signal).then((response) => {
    if (!response) {
      return [];
    }

    const layer = new VectorTile(new PbfReader(response.data)).layers[K_LAYER_NAME];
    if (!layer) {
      return [];
    }

    const features: KFeature[] = [];
    for (let index = 0; index < layer.length; index += 1) {
      const feature = layer.feature(index).toGeoJSON(tile.x, tile.y, tile.z) as KFeature;
      if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
        features.push(feature);
      }
    }

    return features;
  });

  tileCache.set(key, request);
  return request;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
