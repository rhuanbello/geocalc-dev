export type SpatialPoint = { latitude: number; longitude: number };

export function colorForK(value: number) {
  if (!Number.isFinite(value) || value === 0) return "#64748b";
  if (value < 0.009) return "#d9f0d3";
  if (value < 0.015) return "#a6dba0";
  if (value < 0.03) return "#fddc7a";
  if (value < 0.045) return "#f49a57";
  if (value < 0.06) return "#d95f4c";
  return "#972f47";
}

export function colorForR(value: number) {
  if (!Number.isFinite(value)) return null;
  const stops = [1416, 5000, 8500, 12000, 16000, 20722];
  const colors = ["#f8f3d3", "#f7cf6a", "#ef9a47", "#d85c45", "#8d3049", "#4b1f3d"];
  const index = stops.findIndex((stop) => value <= stop);
  return colors[index === -1 ? colors.length - 1 : index];
}

function pointInRing([longitude, latitude]: [number, number], ring: number[][]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x1, y1] = ring[index] ?? [];
    const [x2, y2] = ring[previous] ?? [];
    if ((y1 > latitude) !== (y2 > latitude) && longitude < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

export function featureContainsPoint(feature: GeoJSON.Feature, point: SpatialPoint) {
  const coordinate: [number, number] = [point.longitude, point.latitude];
  const geometry = feature.geometry;
  if (!geometry) return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.some((polygon) => pointInRing(coordinate, polygon[0] as number[][]) && !polygon.slice(1).some((hole) => pointInRing(coordinate, hole as number[][])));
}
