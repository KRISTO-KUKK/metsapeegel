"use client";

import { useEffect, useRef } from "react";
import { bbox } from "@turf/turf";
import maplibregl, { GeoJSONSource } from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import countiesGeojson from "@/data/official/counties.geojson";
import type { AnalysisResult } from "@/lib/types/forestry";

type Props = {
  analysis: AnalysisResult | null;
  selectedAreaId: string | null;
  onSelectForestAt: (coordinates: { lng: number; lat: number }) => void;
};

type GeoCollection = FeatureCollection<Geometry, Record<string, unknown>>;

const emptyCollection: GeoCollection = {
  type: "FeatureCollection",
  features: []
};

const maaametBasicMapTile =
  "https://kaart.maaamet.ee/wms/alus-geo?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=pohi_vr2&STYLES=&FORMAT=image/png&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}";

const maaametForestTile =
  "https://kaart.maaamet.ee/wms/alus-geo?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=BK_METS&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}";

const etakForestSld =
  '<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"><NamedLayer><Name>etak:e_305_puittaimestik_a</Name><UserStyle><FeatureTypeStyle><Rule><PolygonSymbolizer><Fill><CssParameter name="fill">#16a34a</CssParameter><CssParameter name="fill-opacity">0.82</CssParameter></Fill><Stroke><CssParameter name="stroke">#064e3b</CssParameter><CssParameter name="stroke-opacity">0.55</CssParameter><CssParameter name="stroke-width">0.4</CssParameter></Stroke></PolygonSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';

const etakForestTile =
  `https://gsavalik.envir.ee/geoserver/etak/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=etak:e_305_puittaimestik_a&STYLES=&CQL_FILTER=tyyp_tekst%3D%27Mets%27&SLD_BODY=${encodeURIComponent(etakForestSld)}&FORMAT=image/png&TRANSPARENT=TRUE&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}`;

const cadastralBoundaryTile =
  "https://gsavalik.envir.ee/geoserver/kataster/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=ky_kehtiv&STYLES=ky_kehtiv_tunnuseta&FORMAT=image/png&TRANSPARENT=TRUE&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}";

function asGeoCollection(value: unknown): GeoCollection {
  return value as GeoCollection;
}

function selectedAreaFeature(
  selectedAreaId: string | null,
  analysis: AnalysisResult | null
): Feature<Geometry, Record<string, unknown>> | null {
  if (!selectedAreaId || analysis?.area.id !== selectedAreaId) {
    return null;
  }

  return {
    type: "Feature",
    properties: {
      ...analysis.area
    },
    geometry: analysis.area.geometry
  };
}

function featuresFromRawFacts(
  analysis: AnalysisResult | null,
  key: "stands" | "notices" | "protectedAreas"
): GeoCollection {
  if (!analysis) {
    return emptyCollection;
  }

  const rows = analysis.rawFacts[key];
  if (!Array.isArray(rows)) {
    return emptyCollection;
  }

  const features: Feature<Geometry, Record<string, unknown>>[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const record = row as Record<string, unknown>;
    const geometry = record.geometry as Geometry | undefined;
    if (!geometry) {
      continue;
    }

    features.push({
      type: "Feature",
      properties: {
        ...record,
        areaId: analysis.area.id
      },
      geometry
    });
  }

  return {
    type: "FeatureCollection",
    features
  };
}

function setGeojsonSource(
  map: maplibregl.Map,
  sourceId: string,
  data: GeoCollection
) {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  source?.setData(data);
}

export function MapView({
  analysis,
  selectedAreaId,
  onSelectForestAt
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      attributionControl: false,
      center: [25.25, 58.62],
      zoom: 6.3,
      minZoom: 5.2,
      maxZoom: 12,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": "#eefaf0"
            }
          }
        ]
      }
    });

    mapRef.current = map;

    map.on("load", () => {
      map.addSource("maaamet-basic-map", {
        type: "raster",
        tiles: [maaametBasicMapTile],
        tileSize: 256,
        attribution: "Maa- ja Ruumiamet"
      });
      map.addSource("maaamet-forest-cover", {
        type: "raster",
        tiles: [maaametForestTile],
        tileSize: 256,
        attribution: "Maa- ja Ruumiamet"
      });
      map.addSource("etak-forests", {
        type: "raster",
        tiles: [etakForestTile],
        tileSize: 256,
        attribution: "Maa- ja Ruumiamet ETAK"
      });
      map.addSource("cadastral-boundaries", {
        type: "raster",
        tiles: [cadastralBoundaryTile],
        tileSize: 256,
        attribution: "Maa- ja Ruumiamet kataster"
      });
      map.addSource("counties", {
        type: "geojson",
        data: asGeoCollection(countiesGeojson),
        promoteId: "id"
      });
      map.addSource("metsaregister-stands", {
        type: "geojson",
        data: emptyCollection
      });
      map.addSource("forest-notices", {
        type: "geojson",
        data: emptyCollection
      });
      map.addSource("protected-areas", {
        type: "geojson",
        data: emptyCollection
      });
      map.addSource("selected-area", {
        type: "geojson",
        data: emptyCollection
      });

      map.addLayer({
        id: "maaamet-basic-map",
        type: "raster",
        source: "maaamet-basic-map",
        paint: {
          "raster-opacity": 0.58,
          "raster-saturation": -0.28,
          "raster-contrast": -0.12,
          "raster-brightness-max": 0.98,
          "raster-brightness-min": 0.08
        }
      });

      map.addLayer({
        id: "maaamet-forest-cover",
        type: "raster",
        source: "maaamet-forest-cover",
        paint: {
          "raster-opacity": 0.34,
          "raster-saturation": 0.45,
          "raster-contrast": 0.24
        }
      });

      map.addLayer({
        id: "etak-forests",
        type: "raster",
        source: "etak-forests",
        paint: {
          "raster-opacity": 0.82,
          "raster-saturation": 0.55,
          "raster-contrast": 0.2,
          "raster-brightness-min": 0.03,
          "raster-brightness-max": 0.98
        }
      });

      map.addLayer({
        id: "counties-fill",
        type: "fill",
        source: "counties",
        paint: {
          "fill-color": "#dff7e8",
          "fill-opacity": 0.02
        }
      });

      map.addLayer({
        id: "counties-line",
        type: "line",
        source: "counties",
        paint: {
          "line-color": "#2f6b3c",
          "line-opacity": 0.76,
          "line-width": 1.25
        }
      });

      map.addLayer({
        id: "cadastral-boundaries",
        type: "raster",
        source: "cadastral-boundaries",
        minzoom: 9,
        paint: {
          "raster-opacity": 0.7
        }
      });

      map.addLayer({
        id: "protected-fill",
        type: "fill",
        source: "protected-areas",
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": 0.18
        }
      });

      map.addLayer({
        id: "metsaregister-stands-fill",
        type: "fill",
        source: "metsaregister-stands",
        paint: {
          "fill-color": "#facc15",
          "fill-opacity": 0.22
        }
      });

      map.addLayer({
        id: "metsaregister-stands-line",
        type: "line",
        source: "metsaregister-stands",
        paint: {
          "line-color": "#854d0e",
          "line-width": 1.6,
          "line-opacity": 0.78
        }
      });

      map.addLayer({
        id: "forest-notices-line",
        type: "line",
        source: "forest-notices",
        paint: {
          "line-color": "#2563eb",
          "line-width": 3,
          "line-opacity": 0.82,
          "line-dasharray": [2, 1]
        }
      });

      map.addLayer({
        id: "selected-fill",
        type: "fill",
        source: "selected-area",
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.26
        }
      });

      map.addLayer({
        id: "selected-line",
        type: "line",
        source: "selected-area",
        paint: {
          "line-color": "#061a0d",
          "line-width": 3,
          "line-opacity": 0.9
        }
      });

      map.fitBounds(
        [
          [21.55, 57.2],
          [28.45, 59.78]
        ],
        {
          padding: { top: 120, right: 80, bottom: 60, left: 80 },
          duration: 0
        }
      );
    });

    map.on("click", (event) => {
      onSelectForestAt({
        lng: event.lngLat.lng,
        lat: event.lngLat.lat
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onSelectForestAt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const currentMap = map;

    function updateSelection() {
      const selectedFeature = selectedAreaFeature(selectedAreaId, analysis);

      setGeojsonSource(
        currentMap,
        "selected-area",
        selectedFeature
          ? {
              type: "FeatureCollection",
              features: [selectedFeature]
            }
          : emptyCollection
      );
      setGeojsonSource(
        currentMap,
        "metsaregister-stands",
        featuresFromRawFacts(analysis, "stands")
      );
      setGeojsonSource(
        currentMap,
        "forest-notices",
        featuresFromRawFacts(analysis, "notices")
      );
      setGeojsonSource(
        currentMap,
        "protected-areas",
        featuresFromRawFacts(analysis, "protectedAreas")
      );

      if (selectedFeature) {
        const bounds = bbox(selectedFeature);
        const isDesktop = window.innerWidth >= 920;
        currentMap.fitBounds(
          [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]]
          ],
          {
            padding: {
              top: 130,
              right: isDesktop ? 520 : 70,
              bottom: isDesktop ? 80 : 360,
              left: 70
            },
            maxZoom: 10.8,
            duration: 850
          }
        );
      }
    }

    if (currentMap.loaded()) {
      updateSelection();
    } else {
      currentMap.once("load", updateSelection);
    }
  }, [selectedAreaId, analysis]);

  return (
    <>
      <div className="absolute inset-0" ref={containerRef} />
      <div className="pointer-events-none fixed bottom-3 left-16 z-10 hidden rounded-md bg-white/75 px-2 py-1 text-[11px] text-slate-600 shadow-sm backdrop-blur sm:block">
        Metsad: ETAK WMS/WFS · eraldised: Metsaregister · kaitseinfo: EELIS
      </div>
    </>
  );
}
