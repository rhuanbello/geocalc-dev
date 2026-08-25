import type { MapPoint } from "@/components/MapPicker";

const TOPODATA_SEARCH = "https://data.inpe.br/bdc/stac/v1/search";

type TopodataFeature = {
  assets?: Record<string, { href?: string }>;
};

/**
 * Reads the TOPODATA slope raster at the selected coordinate. The returned
 * value is a percentage and remains editable because a point is only a local
 * representation of a slope segment.
 */
export async function fetchTopodataSlope(point: MapPoint): Promise<number> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);

  try {
    const searchResponse = await fetch(TOPODATA_SEARCH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        collections: ["topodata-1"],
        intersects: {
          type: "Point",
          coordinates: [point.longitude, point.latitude],
        },
        limit: 1,
      }),
    });

    if (!searchResponse.ok) {
      throw new Error(`TOPODATA respondeu ${searchResponse.status}.`);
    }

    const payload = (await searchResponse.json()) as { features?: TopodataFeature[] };
    const asset = payload.features?.[0]?.assets?.SN?.href;
    if (!asset) {
      throw new Error("A camada de declividade não está disponível para esta coordenada.");
    }

    const { fromUrl } = await import("geotiff");
    const tiff = await fromUrl(asset, undefined, controller.signal);
    const image = await tiff.getImage();
    const boundingBox = image.getBoundingBox();
    if (boundingBox.length !== 4) {
      throw new Error("O bloco TOPODATA retornou uma extensão inválida.");
    }
    const pixelWindow = topodataPixelWindow({
      longitude: point.longitude,
      latitude: point.latitude,
      boundingBox: [boundingBox[0], boundingBox[1], boundingBox[2], boundingBox[3]],
      width: image.getWidth(),
      height: image.getHeight(),
    });
    const rasters = await image.readRasters({ window: pixelWindow, signal: controller.signal });
    const slope = Number(rasters[0]?.[0]);
    const noData = Number(image.getGDALNoData());

    if (!Number.isFinite(slope) || slope === noData) {
      throw new Error("O TOPODATA não possui declividade válida para esta coordenada.");
    }

    return slope;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function topodataPixelWindow({
  longitude,
  latitude,
  boundingBox,
  width,
  height,
}: {
  longitude: number;
  latitude: number;
  boundingBox: [number, number, number, number];
  width: number;
  height: number;
}): [number, number, number, number] {
  const [minX, minY, maxX, maxY] = boundingBox;
  if (longitude < minX || longitude > maxX || latitude < minY || latitude > maxY) {
    throw new Error("A coordenada está fora do bloco TOPODATA retornado.");
  }

  const x = Math.min(width - 1, Math.max(0, Math.floor(((longitude - minX) / (maxX - minX)) * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(((maxY - latitude) / (maxY - minY)) * height)));
  return [x, y, x + 1, y + 1];
}
