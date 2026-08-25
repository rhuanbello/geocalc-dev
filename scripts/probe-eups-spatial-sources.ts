import { fromUrl } from "geotiff";

type Point = { name: string; latitude: number; longitude: number };

const EMBRAPA_WMS = "https://geoinfo.dados.embrapa.br/geoserver/wms?service=WMS&request=GetCapabilities";
const TOPODATA_SEARCH = "https://data.inpe.br/bdc/stac/v1/search";
const OUTPUT = "docs/gerados/eups-spatial-sources-proof.json";
const REQUEST_TIMEOUT_MS = 20_000;
const points: Point[] = [
  { name: "Brasília, DF", latitude: -15.7939, longitude: -47.8828 },
  { name: "Niterói, RJ", latitude: -22.8832, longitude: -43.1034 },
  { name: "Bauru, SP", latitude: -22.3151, longitude: -49.0581 },
];

type ProbeResult = {
  generatedAt: string;
  embrapa: { reachable: boolean; candidates: string[]; error?: string };
  topodata: Array<{
    point: Point;
    asset?: string;
    slopePercent?: number;
    noData?: boolean;
    error?: string;
  }>;
};

async function main() {
  const result: ProbeResult = {
    generatedAt: new Date().toISOString(),
    embrapa: await probeEmbrapa(),
    topodata: await Promise.all(points.map(probeTopodata)),
  };
  await Bun.write(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Prova registrada em ${OUTPUT}`);
  console.log(JSON.stringify(result, null, 2));
}

async function probeEmbrapa(): Promise<ProbeResult["embrapa"]> {
  try {
    const response = await fetch(EMBRAPA_WMS, {
      headers: { "User-Agent": "GeoCalc EUPS source validation" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`WMS respondeu ${response.status}`);
    }
    const xml = await response.text();
    const normalized = xml.replace(/\s+/g, " ");
    const candidates = Array.from(
      new Set(
        Array.from(normalized.matchAll(/<Name>([^<]+)<\/Name>.{0,700}?<Title>([^<]*(?:erosiv|erodib)[^<]*)<\/Title>/gi))
          .map((match) => `${match[1]} — ${match[2]}`)
          .slice(0, 20),
      ),
    );
    return { reachable: true, candidates };
  } catch (error) {
    return {
      reachable: false,
      candidates: [],
      error: error instanceof Error ? error.message : "Falha ao consultar WMS da Embrapa.",
    };
  }
}

async function probeTopodata(point: Point): Promise<ProbeResult["topodata"][number]> {
  try {
    const response = await fetch(TOPODATA_SEARCH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        collections: ["topodata-1"],
        intersects: { type: "Point", coordinates: [point.longitude, point.latitude] },
        limit: 1,
      }),
    });
    if (!response.ok) throw new Error(`STAC respondeu ${response.status}`);
    const payload = (await response.json()) as {
      features?: Array<{ assets?: Record<string, { href?: string }> }>;
    };
    const asset = payload.features?.[0]?.assets?.SN?.href;
    if (!asset) throw new Error("Ativo SN de declividade não encontrado para o ponto.");
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const tiff = await fromUrl(asset, undefined, signal);
    const image = await tiff.getImage();
    const [minX, minY, maxX, maxY] = image.getBoundingBox();
    const width = image.getWidth();
    const height = image.getHeight();
    if (point.longitude < minX || point.longitude > maxX || point.latitude < minY || point.latitude > maxY) {
      throw new Error("Ponto fora do bloco TOPODATA retornado.");
    }
    const x = Math.min(width - 1, Math.max(0, Math.floor(((point.longitude - minX) / (maxX - minX)) * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor(((maxY - point.latitude) / (maxY - minY)) * height)));
    const rasters = await image.readRasters({
      window: [x, y, x + 1, y + 1],
      signal,
    });
    const slope = Number(rasters[0]?.[0]);
    const noData = slope === Number(image.getGDALNoData()) || !Number.isFinite(slope);
    return { point, asset, slopePercent: noData ? undefined : slope, noData };
  } catch (error) {
    return { point, error: error instanceof Error ? error.message : "Falha ao consultar TOPODATA." };
  }
}

void main();
