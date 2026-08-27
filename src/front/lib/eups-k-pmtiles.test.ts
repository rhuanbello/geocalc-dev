import { describe, expect, test } from "bun:test";
import { findKSample, getKColor, getKTileCoordinate } from "./eups-k-pmtiles";

describe("consulta vetorial de K", () => {
  test("localiza o fator K no polígono que contém o ponto", () => {
    const sample = findKSample([{
      type: "Feature",
      properties: { k_solos: 0.024, cod_um: "UM-01", erod_um: "Média" },
      geometry: { type: "Polygon", coordinates: [[[-44, -23], [-43, -23], [-43, -22], [-44, -22], [-44, -23]]] },
    }], { latitude: -22.5, longitude: -43.5 });

    expect(sample).toEqual({ value: 0.024, mappingUnit: "UM-01", erodibilityClass: "Média" });
  });

  test("não inventa um valor fora de um polígono", () => {
    const sample = findKSample([{
      type: "Feature",
      properties: { k_solos: 0.024 },
      geometry: { type: "Polygon", coordinates: [[[-44, -23], [-43, -23], [-43, -22], [-44, -22], [-44, -23]]] },
    }], { latitude: -21, longitude: -43.5 });

    expect(sample).toBeNull();
  });

  test("mantém a coordenada de tile dentro dos limites do zoom", () => {
    expect(getKTileCoordinate({ latitude: -22.9, longitude: -43.2 }, 12)).toEqual({ x: 1556, y: 2315, z: 12 });
  });

  test("usa uma escala de cores estável para K", () => {
    expect(getKColor(0.024)).toBe("#fdbb84");
  });
});
