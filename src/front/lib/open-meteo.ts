import {
  aggregateDailyClimateToMonthlyNormals,
  type ClimateAggregationResult,
  type DailyClimateSeries,
} from "$/climate";
import type { ClimateCacheEntry } from "$/academic";

export const CLIMATE_MODEL = "era5";
export const CLIMATE_MODEL_LABEL = "ERA5";

export type LocationSearchResult = {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

type ReverseGeocodingResponse = {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

type GeocodingResponse = {
  results?: Array<{
    id: number;
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
};

type ArchiveResponse = {
  daily: DailyClimateSeries;
};

type ClimateNormalsParams = {
  latitude: number;
  longitude: number;
  timezone: string;
  startYear: number;
  endYear: number;
  effectiveEndDate: string;
};

const CLIMATE_CACHE_PREFIX = "geocalc:climate-normal";
const REVERSE_GEOCODING_CACHE_PREFIX = "geocalc:reverse-geocoding";
const CLIMATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function searchLocations(
  query: string,
): Promise<LocationSearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 3) {
    return [];
  }

  const params = new URLSearchParams({
    name: trimmedQuery,
    count: "6",
    language: "pt",
    format: "json"
  });
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Não foi possível buscar locais.");
  }

  const payload = (await response.json()) as GeocodingResponse;
  return (payload.results ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    country: item.country ?? "",
    admin1: item.admin1,
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone ?? "auto",
  }));
}

export async function fetchClimateNormals(
  params: ClimateNormalsParams,
): Promise<ClimateAggregationResult> {
  const cacheKey = buildClimateCacheKey(params);
  const cached = readSessionCache<ClimateAggregationResult>(cacheKey);

  if (cached) {
    return { ...cached, fromCache: true };
  }

  const query = new URLSearchParams({
    latitude: params.latitude.toString(),
    longitude: params.longitude.toString(),
    start_date: `${params.startYear}-01-01`,
    end_date: params.effectiveEndDate,
    daily: "temperature_2m_mean,precipitation_sum",
    models: CLIMATE_MODEL,
    timezone: params.timezone || "auto",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  });
  const response = await fetch(
    `https://archive-api.open-meteo.com/v1/archive?${query.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Não foi possível importar a série climática.");
  }

  const payload = (await response.json()) as ArchiveResponse;
  const result = aggregateDailyClimateToMonthlyNormals(payload.daily, {
    requireCompleteMonths: true,
    effectiveEndDate: params.effectiveEndDate,
  });
  writeSessionCache(cacheKey, result);
  return result;
}

export function buildClimateCacheKey(params: ClimateNormalsParams): string {
  const latitude = params.latitude.toFixed(4);
  const longitude = params.longitude.toFixed(4);
  const timezone = params.timezone || "auto";

  return [
    CLIMATE_CACHE_PREFIX,
    latitude,
    longitude,
    timezone,
    CLIMATE_MODEL,
    params.startYear,
    params.endYear,
    params.effectiveEndDate,
  ].join(":");
}

export async function reverseGeocodePoint(point: {
  latitude: number;
  longitude: number;
}): Promise<LocationSearchResult | null> {
  const cacheKey = buildReverseGeocodingCacheKey(point);
  const cached = readSessionCache<LocationSearchResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const query = new URLSearchParams({
    lat: point.latitude.toString(),
    lon: point.longitude.toString(),
    format: "jsonv2",
    addressdetails: "1",
    zoom: "10",
    "accept-language": "pt-BR,pt",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${query.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Não foi possível identificar o nome do local selecionado.");
  }

  const payload = (await response.json()) as ReverseGeocodingResponse;
  const address = payload.address;
  const name =
    address?.city ??
    address?.town ??
    address?.village ??
    address?.municipality ??
    address?.county ??
    payload.display_name?.split(",")[0]?.trim();

  if (!name) {
    return null;
  }

  const location: LocationSearchResult = {
    id:
      Number(
        `${point.latitude.toFixed(4)}${point.longitude.toFixed(4)}`
          .replace(/\D/g, "")
          .slice(0, 9),
      ) || Date.now(),
    name,
    admin1: address?.state,
    country: address?.country ?? "",
    latitude: point.latitude,
    longitude: point.longitude,
    timezone: "auto",
  };
  writeSessionCache(cacheKey, location);
  return location;
}

export function buildReverseGeocodingCacheKey(point: {
  latitude: number;
  longitude: number;
}): string {
  return [
    REVERSE_GEOCODING_CACHE_PREFIX,
    point.latitude.toFixed(4),
    point.longitude.toFixed(4),
  ].join(":");
}

function readSessionCache<T>(key: string): T | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(key);
    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw) as ClimateCacheEntry<T>;
    if (!entry.expiresAt || Date.now() > entry.expiresAt) {
      globalThis.sessionStorage?.removeItem(key);
      return null;
    }

    return entry.value;
  } catch {
    return null;
  }
}

function writeSessionCache<T>(key: string, value: T) {
  try {
    const entry: ClimateCacheEntry<T> = {
      createdAt: Date.now(),
      expiresAt: Date.now() + CLIMATE_CACHE_TTL_MS,
      value,
    };
    globalThis.sessionStorage?.setItem(key, JSON.stringify(entry));
  } catch {
    // Cache is opportunistic; network import remains the source of truth.
  }
}
