import { centroid } from "@turf/turf";
import type { Feature, Geometry } from "geojson";

export function getGeometryCenter(geometry: Geometry): [number, number] {
  const point = centroid({
    type: "Feature",
    properties: {},
    geometry
  } satisfies Feature<Geometry>);

  return point.geometry.coordinates as [number, number];
}
