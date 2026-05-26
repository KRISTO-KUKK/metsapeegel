import { booleanIntersects } from "@turf/turf";
import type { Feature, Geometry } from "geojson";

function asFeature(geometry: Geometry): Feature<Geometry> {
  return {
    type: "Feature",
    properties: {},
    geometry
  };
}

export function geometriesOverlap(a: Geometry, b: Geometry): boolean {
  try {
    return booleanIntersects(asFeature(a), asFeature(b));
  } catch {
    return false;
  }
}
