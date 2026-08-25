export type SpatialFactorStatus = "available" | "unavailable" | "validation";

export type SpatialFactor = {
  value: number | null;
  unit: string;
  source: string;
  scale: string;
  status: SpatialFactorStatus;
  message?: string;
};

export type SpatialKFactor = SpatialFactor & {
  className?: string;
  range?: [number, number];
  requiresReview: boolean;
};

export type SpatialFactorsResponse = {
  coordinate: { latitude: number; longitude: number };
  queriedAt: string;
  rainfallErosivity: SpatialFactor;
  soilErodibility: SpatialKFactor;
  slope: SpatialFactor;
};

export function isSpatialFactorsResponse(value: unknown): value is SpatialFactorsResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SpatialFactorsResponse>;
  return (
    typeof candidate.queriedAt === "string" &&
    hasCoordinate(candidate.coordinate) &&
    hasFactor(candidate.rainfallErosivity) &&
    hasFactor(candidate.soilErodibility) &&
    hasFactor(candidate.slope) &&
    typeof candidate.soilErodibility?.requiresReview === "boolean"
  );
}

function hasCoordinate(value: unknown): value is { latitude: number; longitude: number } {
  if (!value || typeof value !== "object") return false;
  const coordinate = value as { latitude?: unknown; longitude?: unknown };
  return typeof coordinate.latitude === "number" && typeof coordinate.longitude === "number";
}

function hasFactor(value: unknown): value is SpatialFactor {
  if (!value || typeof value !== "object") return false;
  const factor = value as Partial<SpatialFactor>;
  return (
    (typeof factor.value === "number" || factor.value === null) &&
    typeof factor.unit === "string" &&
    typeof factor.source === "string" &&
    typeof factor.scale === "string" &&
    (factor.status === "available" || factor.status === "unavailable" || factor.status === "validation")
  );
}
