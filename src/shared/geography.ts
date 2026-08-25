export type GeographicPoint = { latitude: number; longitude: number };

const EARTH_RADIUS_METERS = 6_371_008.8;

export function distanceBetweenPoints(
  start: GeographicPoint,
  end: GeographicPoint,
): number {
  const latitudeDelta = degreesToRadians(end.latitude - start.latitude);
  const longitudeDelta = degreesToRadians(end.longitude - start.longitude);
  const latitudeStart = degreesToRadians(start.latitude);
  const latitudeEnd = degreesToRadians(end.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeStart) * Math.cos(latitudeEnd) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function measureLine(points: GeographicPoint[]): number | null {
  if (points.length < 2) {
    return null;
  }

  return points.slice(1).reduce(
    (total, point, index) => total + distanceBetweenPoints(points[index]!, point),
    0,
  );
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
