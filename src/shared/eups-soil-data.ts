import rawDataset from "./data/eups-soil-lookup.json";
import type { EupsSoilDataset } from "./eups-soil-lookup";

export async function loadEupsSoilDataset(): Promise<EupsSoilDataset> {
  return rawDataset as EupsSoilDataset;
}
