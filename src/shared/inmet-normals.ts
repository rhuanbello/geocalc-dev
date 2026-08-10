import inmetNormals19611990 from "./data/inmet-normals-1961-1990.json";
import inmetNormals19812010 from "./data/inmet-normals-1981-2010.json";
import inmetNormals19912020 from "./data/inmet-normals-1991-2020.json";
import type { MonthlyInput } from "./water-balance";

export type ClimateDataSource = "inmet" | "open-meteo";
export type InmetNormalPeriod = "1961-1990" | "1981-2010" | "1991-2020";

export type InmetNormalStation = {
  code: string;
  name: string;
  uf: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  status: string;
  precipitation: number[];
  temperature: number[];
};

export type InmetNormalsDataset = {
  source: string;
  period: InmetNormalPeriod;
  generatedAt: string;
  stationCount: number;
  stations: InmetNormalStation[];
};

export const DEFAULT_INMET_NORMAL_PERIOD: InmetNormalPeriod = "1991-2020";

const datasets: Record<InmetNormalPeriod, InmetNormalsDataset> = {
  "1961-1990": inmetNormals19611990 as InmetNormalsDataset,
  "1981-2010": inmetNormals19812010 as InmetNormalsDataset,
  "1991-2020": inmetNormals19912020 as InmetNormalsDataset,
};

export function getInmetNormalsDataset(
  period: InmetNormalPeriod = DEFAULT_INMET_NORMAL_PERIOD,
): InmetNormalsDataset {
  return datasets[period];
}

export function listInmetStations(
  period: InmetNormalPeriod = DEFAULT_INMET_NORMAL_PERIOD,
): InmetNormalStation[] {
  return getInmetNormalsDataset(period).stations;
}

export function getInmetStationByCode(
  code: string | null,
  period: InmetNormalPeriod = DEFAULT_INMET_NORMAL_PERIOD,
): InmetNormalStation | null {
  if (!code) {
    return null;
  }

  return listInmetStations(period).find((station) => station.code === code) ?? null;
}

export function searchInmetStations(
  query: string,
  period: InmetNormalPeriod = DEFAULT_INMET_NORMAL_PERIOD,
): InmetNormalStation[] {
  const normalizedQuery = normalizeSearchText(query);
  const stations = listInmetStations(period);
  if (!normalizedQuery) {
    return stations.slice(0, 24);
  }

  return stations
    .filter((station) =>
      [
        station.code,
        station.name,
        station.uf,
        `${station.name} ${station.uf}`,
      ].some((value) => normalizeSearchText(value).includes(normalizedQuery)),
    )
    .slice(0, 40);
}

export function inmetStationToMonthlyInputs(
  station: InmetNormalStation,
): MonthlyInput[] {
  return Array.from({ length: 12 }, (_, index) => ({
    precipitation: station.precipitation[index] ?? null,
    temperature: station.temperature[index] ?? null,
  }));
}

export function inmetStationLabel(station: InmetNormalStation): string {
  return `${station.code} - ${station.name}, ${station.uf}`;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
