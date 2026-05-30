"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bbox, pointOnFeature } from "@turf/turf";
import { LoaderCircle, LocateFixed, RotateCcw } from "lucide-react";
import maplibregl, { GeoJSONSource } from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import countiesGeojson from "@/data/official/counties.geojson";
import type {
  AnalysisResult,
  AreaMapAction,
  AreaQueryResponse
} from "@/lib/types/forestry";

type Props = {
  analysis: AnalysisResult | null;
  selectedAreaId: string | null;
  onSelectForestAt: (coordinates: { lng: number; lat: number }) => void;
  onSelectForestFeature: (
    feature: Feature<Geometry, Record<string, unknown>>
  ) => void;
};

type GeoCollection = FeatureCollection<Geometry, Record<string, unknown>>;
type LayerVisibility = {
  cadastre: boolean;
  protection: boolean;
  registry: boolean;
};

type QueryOverlayState = {
  label: string;
  status: "idle" | "loading" | "ready" | "error";
  matchedCount: number;
  inspectedCount: number;
  message?: string;
};

const emptyCollection: GeoCollection = {
  type: "FeatureCollection",
  features: []
};

const maaametBaseTile =
  "/api/maaamet-tile?layer=pohi_mvr2&bbox={bbox-epsg-3857}";

const maaametHybridTile =
  "/api/maaamet-tile?layer=HYBRID&transparent=true&bbox={bbox-epsg-3857}";

const maaametForestTile =
  "/api/maaamet-tile?layer=mets_1&transparent=true&bbox={bbox-epsg-3857}";

const maaametForestDetailTile =
  "/api/maaamet-tile?layer=BK_METS&transparent=true&bbox={bbox-epsg-3857}";

const cadastralBoundaryTile =
  "https://gsavalik.envir.ee/geoserver/kataster/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=ky_kehtiv&STYLES=ky_kehtiv_tunnuseta&FORMAT=image/png&TRANSPARENT=TRUE&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}";

const estoniaBounds: [[number, number], [number, number]] = [
  [21.55, 57.2],
  [28.45, 59.78]
];

const forestPolygonMinZoom = 7.7;

const defaultLayerVisibility: LayerVisibility = {
  cadastre: false,
  protection: false,
  registry: false
};

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

function setLayerVisibility(
  map: maplibregl.Map,
  layerIds: string[],
  isVisible: boolean
) {
  const visibility = isVisible ? "visible" : "none";
  for (const layerId of layerIds) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", visibility);
    }
  }
}

function queryResultPoints(data: GeoCollection): GeoCollection {
  const features: Feature<Geometry, Record<string, unknown>>[] = [];

  for (const feature of data.features) {
    try {
      const point = pointOnFeature(feature);
      features.push({
        type: "Feature",
        properties: {
          ...feature.properties,
          sourceAreaId: feature.properties.areaId
        },
        geometry: point.geometry
      });
    } catch {
      // Ignore invalid geometries in the visual helper layer.
    }
  }

  return {
    type: "FeatureCollection",
    features
  };
}

function setForestPreviewVisibility(map: maplibregl.Map, isVisible: boolean) {
  setLayerVisibility(
    map,
    [
      "maaamet-forest-cover",
      "maaamet-forest-detail",
      "etak-forest-preview-fill",
      "etak-forest-preview-line"
    ],
    isVisible
  );
}

function setForestPolygonVisibility(map: maplibregl.Map, isVisible: boolean) {
  setLayerVisibility(
    map,
    ["etak-forest-preview-fill", "etak-forest-preview-line"],
    isVisible
  );
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function selectedForestColor(_analysis: AnalysisResult | null): string {
  return "#16a34a";
}

function forestFeatureKey(feature: Feature<Geometry, Record<string, unknown>>) {
  return String(
    feature.properties.etakId ??
      feature.properties.etakFeatureId ??
      feature.id ??
      JSON.stringify(feature.geometry).slice(0, 160)
  );
}

function featureFromMapEvent(
  event: maplibregl.MapLayerMouseEvent
): Feature<Geometry, Record<string, unknown>> | null {
  const feature = event.features?.[0];
  if (!feature?.geometry) {
    return null;
  }

  return {
    type: "Feature",
    id: feature.id,
    properties: { ...(feature.properties ?? {}) },
    geometry: feature.geometry as Geometry
  };
}

export function MapView({
  analysis,
  selectedAreaId,
  onSelectForestAt,
  onSelectForestFeature
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<LayerVisibility>(
    defaultLayerVisibility
  );
  const [queryOverlay, setQueryOverlay] = useState<QueryOverlayState | null>(
    null
  );
  const [showForestZoomHint, setShowForestZoomHint] = useState(true);
  const [isForestPreviewLoading, setIsForestPreviewLoading] = useState(false);
  const [hasForestPreviewFeatures, setHasForestPreviewFeatures] =
    useState(false);
  const visibleForestCacheRef = useRef<
    Map<string, Feature<Geometry, Record<string, unknown>>>
  >(new Map());
  const visibleForestOrderRef = useRef<string[]>([]);

  const fitEstonia = useCallback((duration = 650) => {
    mapRef.current?.fitBounds(estoniaBounds, {
      padding: { top: 120, right: 80, bottom: 60, left: 80 },
      duration
    });
  }, []);

  const zoomToSelected = useCallback(() => {
    const map = mapRef.current;
    const selectedFeature = selectedAreaFeature(selectedAreaId, analysis);
    if (!map || !selectedFeature) {
      return;
    }

    const bounds = bbox(selectedFeature);
    const isDesktop = window.innerWidth >= 920;
    map.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]]
      ],
      {
        padding: {
          top: 130,
          right: isDesktop ? 520 : 70,
          bottom: isDesktop ? 80 : 360,
          left: isDesktop ? 470 : 70
        },
        maxZoom: 10.8,
        duration: 700
      }
    );
  }, [analysis, selectedAreaId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      attributionControl: false,
      center: [25.25, 58.62],
      zoom: 6.45,
      minZoom: 5.2,
      maxZoom: 12,
      maxBounds: [
        [18.6, 56.75],
        [31.9, 60.45]
      ],
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": "#d9e8d2"
            }
          }
        ]
      }
    });

    mapRef.current = map;
    map.getCanvas().style.cursor = "grab";

    const resizeMap = () => map.resize();
    const resizeObserver = new ResizeObserver(resizeMap);
    resizeObserver.observe(containerRef.current);
    window.addEventListener("resize", resizeMap);
    window.requestAnimationFrame(resizeMap);

    let visibleForestAbort: AbortController | null = null;
    let visibleForestTimer: number | null = null;

    function mergeVisibleForestData(data: GeoCollection, maxFeatures: number) {
      const cache = visibleForestCacheRef.current;
      const order = visibleForestOrderRef.current;

      for (const feature of data.features) {
        const key = forestFeatureKey(feature);
        if (!cache.has(key)) {
          order.push(key);
        }
        cache.set(key, feature);
      }

      while (order.length > maxFeatures) {
        const oldest = order.shift();
        if (oldest) {
          cache.delete(oldest);
        }
      }

      return {
        type: "FeatureCollection" as const,
        features: Array.from(cache.values())
      };
    }

    function scheduleVisibleForestLoad() {
      if (visibleForestTimer) {
        window.clearTimeout(visibleForestTimer);
      }

      visibleForestTimer = window.setTimeout(async () => {
        if (!map.getSource("etak-forest-preview")) {
          return;
        }

        const zoom = map.getZoom();
        visibleForestAbort?.abort();
        setShowForestZoomHint(zoom < forestPolygonMinZoom);

        if (zoom < forestPolygonMinZoom) {
          visibleForestAbort = null;
          visibleForestCacheRef.current.clear();
          visibleForestOrderRef.current = [];
          setIsForestPreviewLoading(false);
          setHasForestPreviewFeatures(false);
          setForestPolygonVisibility(map, false);
          setGeojsonSource(map, "etak-forest-preview", emptyCollection);
          return;
        }

        setForestPolygonVisibility(map, true);
        setHasForestPreviewFeatures(visibleForestCacheRef.current.size > 0);
        setIsForestPreviewLoading(visibleForestCacheRef.current.size === 0);
        visibleForestAbort = new AbortController();

        const bounds = map.getBounds();
        const requestBbox = [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth()
        ]
          .map((coordinate) => coordinate.toFixed(6))
          .join(",");

        const count = zoom < 8.4 ? 1000 : 1700;
        const maxCachedFeatures = zoom < 8.4 ? 1600 : 2600;

        try {
          const response = await fetch(
            `/api/forests-bbox?bbox=${encodeURIComponent(requestBbox)}&count=${count}`,
            { signal: visibleForestAbort.signal }
          );
          if (!response.ok) {
            throw new Error("Visible ETAK forest load failed.");
          }

          const data = (await response.json()) as GeoCollection;
          const mergedData = mergeVisibleForestData(data, maxCachedFeatures);
          setGeojsonSource(
            map,
            "etak-forest-preview",
            mergedData
          );
          setHasForestPreviewFeatures(mergedData.features.length > 0);
          setIsForestPreviewLoading(false);
        } catch (cause) {
          if (cause instanceof DOMException && cause.name === "AbortError") {
            return;
          }
          setIsForestPreviewLoading(false);
        }
      }, 280);
    }

    map.on("load", () => {
      map.addSource("maaamet-base-map", {
        type: "raster",
        tiles: [maaametBaseTile],
        tileSize: 256,
        attribution: "Maa- ja Ruumiamet"
      });
      map.addSource("maaamet-hybrid-labels", {
        type: "raster",
        tiles: [maaametHybridTile],
        tileSize: 256,
        attribution: "Maa- ja Ruumiamet"
      });
      map.addSource("maaamet-forest-cover", {
        type: "raster",
        tiles: [maaametForestTile],
        tileSize: 256,
        attribution: "Maa- ja Ruumiamet"
      });
      map.addSource("maaamet-forest-detail", {
        type: "raster",
        tiles: [maaametForestDetailTile],
        tileSize: 256,
        attribution: "Maa- ja Ruumiamet"
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
      map.addSource("etak-forest-preview", {
        type: "geojson",
        data: emptyCollection
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
      map.addSource("query-results", {
        type: "geojson",
        data: emptyCollection
      });
      map.addSource("query-result-points", {
        type: "geojson",
        data: emptyCollection
      });

      map.addLayer({
        id: "maaamet-base-map",
        type: "raster",
        source: "maaamet-base-map",
        paint: {
          "raster-opacity": 0.56,
          "raster-saturation": -0.65,
          "raster-contrast": -0.22,
          "raster-brightness-max": 1,
          "raster-brightness-min": 0.12
        }
      });

      map.addLayer({
        id: "maaamet-forest-cover",
        type: "raster",
        source: "maaamet-forest-cover",
        paint: {
          "raster-opacity": 0.36,
          "raster-saturation": -0.28,
          "raster-contrast": 0.02
        }
      });

      map.addLayer({
        id: "maaamet-forest-detail",
        type: "raster",
        source: "maaamet-forest-detail",
        minzoom: forestPolygonMinZoom,
        paint: {
          "raster-opacity": 0.22,
          "raster-saturation": -0.35,
          "raster-contrast": 0.02
        }
      });

      map.addLayer({
        id: "maaamet-hybrid-labels",
        type: "raster",
        source: "maaamet-hybrid-labels",
        paint: {
          "raster-opacity": 0.48,
          "raster-saturation": -0.52,
          "raster-contrast": -0.02,
          "raster-brightness-max": 0.96,
          "raster-brightness-min": 0.02
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
          "line-opacity": 0.28,
          "line-width": 1
        }
      });

      map.addLayer({
        id: "etak-forest-preview-fill",
        type: "fill",
        source: "etak-forest-preview",
        minzoom: forestPolygonMinZoom,
        paint: {
          "fill-color": "#1f7a3a",
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            0.18,
            8.4,
            0.3,
            10,
            0.46
          ]
        }
      });

      map.addLayer({
        id: "etak-forest-preview-line",
        type: "line",
        source: "etak-forest-preview",
        minzoom: forestPolygonMinZoom,
        paint: {
          "line-color": "#0b3d22",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            0.6,
            11,
            1.4
          ],
          "line-opacity": 0.72
        }
      });

      map.addLayer({
        id: "cadastral-boundaries",
        type: "raster",
        source: "cadastral-boundaries",
        minzoom: 9,
        layout: {
          visibility: "none"
        },
        paint: {
          "raster-opacity": 0.7
        }
      });

      map.addLayer({
        id: "protected-fill",
        type: "fill",
        source: "protected-areas",
        layout: {
          visibility: "none"
        },
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": 0.025
        }
      });

      map.addLayer({
        id: "protected-line",
        type: "line",
        source: "protected-areas",
        layout: {
          visibility: "none"
        },
        paint: {
          "line-color": "#1d4ed8",
          "line-width": 1.4,
          "line-opacity": 0.28
        }
      });

      map.addLayer({
        id: "metsaregister-stands-fill",
        type: "fill",
        source: "metsaregister-stands",
        layout: {
          visibility: "none"
        },
        paint: {
          "fill-color": "#2f8f46",
          "fill-opacity": 0.2
        }
      });

      map.addLayer({
        id: "metsaregister-stands-line",
        type: "line",
        source: "metsaregister-stands",
        layout: {
          visibility: "none"
        },
        paint: {
          "line-color": "#14532d",
          "line-width": 1.6,
          "line-opacity": 0.72
        }
      });

      map.addLayer({
        id: "forest-notices-line",
        type: "line",
        source: "forest-notices",
        layout: {
          visibility: "none"
        },
        paint: {
          "line-color": "#2563eb",
          "line-width": 3,
          "line-opacity": 0.82,
          "line-dasharray": [2, 1]
        }
      });

      map.addLayer({
        id: "query-results-fill",
        type: "fill",
        source: "query-results",
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": 0.38
        }
      });

      map.addLayer({
        id: "query-results-line",
        type: "line",
        source: "query-results",
        paint: {
          "line-color": "#1d4ed8",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            1.4,
            11,
            3.1
          ],
          "line-opacity": 0.94
        }
      });

      map.addLayer({
        id: "query-result-points",
        type: "circle",
        source: "query-result-points",
        maxzoom: 8.4,
        paint: {
          "circle-color": "#2563eb",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            8.5,
            8,
            5.5
          ],
          "circle-opacity": 0.86,
          "circle-stroke-color": "#dbeafe",
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            2,
            8,
            1.4
          ]
        }
      });

      map.addLayer({
        id: "selected-fill",
        type: "fill",
        source: "selected-area",
        paint: {
          "fill-color": "#16a34a",
          "fill-opacity": 0.28
        }
      });

      map.addLayer({
        id: "selected-line",
        type: "line",
        source: "selected-area",
        paint: {
          "line-color": "#052e16",
          "line-width": 3,
          "line-opacity": 0.9
        }
      });

      map.fitBounds(estoniaBounds, {
        padding: { top: 120, right: 80, bottom: 60, left: 80 },
        duration: 0
      });
      scheduleVisibleForestLoad();
    });

    const tooltip = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10
    });

    map.on("mousemove", "etak-forest-preview-fill", (event) => {
      const feature = event.features?.[0];
      if (!feature) {
        return;
      }

      map.getCanvas().style.cursor = "pointer";
      tooltip
        .setLngLat(event.lngLat)
        .setHTML(
          `<strong>Metsaala</strong><br/>${
            feature.properties?.etakId
              ? `ETAK ${escapeHtml(feature.properties.etakId)}<br/>`
              : ""
          }${
            feature.properties?.areaHa
              ? `${escapeHtml(feature.properties.areaHa)} ha`
              : "ETAK puittaimestik"
          }`
        )
        .addTo(map);
    });

    map.on("mouseleave", "etak-forest-preview-fill", () => {
      map.getCanvas().style.cursor = "grab";
      tooltip.remove();
    });

    map.on("moveend", scheduleVisibleForestLoad);
    map.on("zoomend", scheduleVisibleForestLoad);

    map.on("click", "etak-forest-preview-fill", (event) => {
      const clickedFeature = featureFromMapEvent(event);
      if (clickedFeature) {
        const cachedFeature =
          visibleForestCacheRef.current.get(forestFeatureKey(clickedFeature)) ??
          clickedFeature;
        onSelectForestFeature(cachedFeature);
        return;
      }

      onSelectForestAt({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    });

    map.on("mousemove", "query-results-fill", (event) => {
      const feature = event.features?.[0];
      if (!feature) {
        return;
      }

      map.getCanvas().style.cursor = "pointer";
      tooltip
        .setLngLat(event.lngLat)
        .setHTML(
          `<strong>${escapeHtml(feature.properties?.label ?? "Filtri tulemus")}</strong><br/>${escapeHtml(
            feature.properties?.matchReason ?? "Vastab kaardifiltrile."
          )}`
        )
        .addTo(map);
    });

    map.on("mouseleave", "query-results-fill", () => {
      map.getCanvas().style.cursor = "grab";
      tooltip.remove();
    });

    map.on("click", "query-results-fill", (event) => {
      const clickedFeature = featureFromMapEvent(event);
      if (clickedFeature) {
        onSelectForestFeature(clickedFeature);
        return;
      }

      onSelectForestAt({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    });

    map.on("mousemove", "query-result-points", (event) => {
      const feature = event.features?.[0];
      if (!feature) {
        return;
      }

      map.getCanvas().style.cursor = "pointer";
      tooltip
        .setLngLat(event.lngLat)
        .setHTML(
          `<strong>${escapeHtml(feature.properties?.label ?? "Filtri tulemus")}</strong><br/>${escapeHtml(
            feature.properties?.matchReason ?? "Vastab kaardifiltrile."
          )}`
        )
        .addTo(map);
    });

    map.on("mouseleave", "query-result-points", () => {
      map.getCanvas().style.cursor = "grab";
      tooltip.remove();
    });

    map.on("click", "query-result-points", (event) => {
      onSelectForestAt({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    });

    return () => {
      if (visibleForestTimer) {
        window.clearTimeout(visibleForestTimer);
      }
      visibleForestAbort?.abort();
      resizeObserver.disconnect();
      window.removeEventListener("resize", resizeMap);
      tooltip.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [onSelectForestAt, onSelectForestFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    function updateLayerVisibility() {
      if (!mapRef.current) {
        return;
      }

      setLayerVisibility(mapRef.current, ["cadastral-boundaries"], visibleLayers.cadastre);
      setLayerVisibility(
        mapRef.current,
        ["protected-fill", "protected-line"],
        visibleLayers.protection
      );
      setLayerVisibility(
        mapRef.current,
        [
          "metsaregister-stands-fill",
          "metsaregister-stands-line",
          "forest-notices-line"
        ],
        visibleLayers.registry
      );
    }

    if (map.loaded()) {
      updateLayerVisibility();
    } else {
      map.once("load", updateLayerVisibility);
    }
  }, [visibleLayers]);

  useEffect(() => {
    function onEvidenceSource(event: Event) {
      const sourceId = (event as CustomEvent<{ sourceId?: string }>).detail
        ?.sourceId;

      if (sourceId === "maaamet-cadastre") {
        setVisibleLayers((current) => ({ ...current, cadastre: true }));
      }
      if (sourceId === "eelis") {
        setVisibleLayers((current) => ({ ...current, protection: true }));
      }
      if (sourceId === "metsaregister") {
        setVisibleLayers((current) => ({ ...current, registry: true }));
      }
    }

    window.addEventListener("metsapeegel:evidence-source", onEvidenceSource);
    return () =>
      window.removeEventListener(
        "metsapeegel:evidence-source",
        onEvidenceSource
      );
  }, []);

  useEffect(() => {
    async function onAreaQuery(event: Event) {
      const action = (event as CustomEvent<AreaMapAction>).detail;
      const map = mapRef.current;
      if (!map || !action || action.type !== "highlight_area_query") {
        return;
      }

      const bounds = map.getBounds();
      const requestBbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ]
        .map((coordinate) => coordinate.toFixed(6))
        .join(",");
      const params = new URLSearchParams({
        bbox: requestBbox,
        filter: action.filterId,
        limit: "30"
      });

      if (action.year) {
        params.set("year", String(action.year));
      }
      if (action.beforeYear) {
        params.set("beforeYear", String(action.beforeYear));
      }
      if (action.ownershipForm) {
        params.set("ownershipForm", action.ownershipForm);
      }
      if (action.minAreaHa) {
        params.set("minAreaHa", String(action.minAreaHa));
      }
      if (action.maxAreaHa) {
        params.set("maxAreaHa", String(action.maxAreaHa));
      }
      if (action.minStands) {
        params.set("minStands", String(action.minStands));
      }

      setQueryOverlay({
        label: action.label,
        status: "loading",
        matchedCount: 0,
        inspectedCount: 0,
        message: "Kontrollin nähtavaid metsaalasid ametlike allikatega..."
      });
      setForestPreviewVisibility(map, false);
      setGeojsonSource(map, "query-results", emptyCollection);
      setGeojsonSource(map, "query-result-points", emptyCollection);

      try {
        const response = await fetch(`/api/area-query?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Kaardifiltri päring ebaõnnestus.");
        }

        const result = (await response.json()) as AreaQueryResponse;
        setGeojsonSource(map, "query-results", result);
        setGeojsonSource(map, "query-result-points", queryResultPoints(result));
        setQueryOverlay({
          label: result.query.label,
          status: "ready",
          matchedCount: result.query.matchedCount,
          inspectedCount: result.query.inspectedCount,
          message:
            result.query.matchedCount > 0
              ? "Tulemused jäid kaardile; klõpsa esile tõstetud alal, et avada detailid."
              : "Selles kaardivaates vastavaid alasid ei leitud."
        });
      } catch (cause) {
        setForestPreviewVisibility(map, true);
        setGeojsonSource(map, "query-results", emptyCollection);
        setGeojsonSource(map, "query-result-points", emptyCollection);
        setQueryOverlay({
          label: action.label,
          status: "error",
          matchedCount: 0,
          inspectedCount: 0,
          message:
            cause instanceof Error
              ? cause.message
              : "Kaardifiltri päring ebaõnnestus."
        });
      }
    }

    window.addEventListener("metsapeegel:area-query", onAreaQuery);
    return () => window.removeEventListener("metsapeegel:area-query", onAreaQuery);
  }, []);

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
      if (currentMap.getLayer("selected-fill")) {
        currentMap.setPaintProperty(
          "selected-fill",
          "fill-color",
          selectedForestColor(analysis)
        );
      }
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
              left: isDesktop ? 470 : 70
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
      <div className="absolute inset-0 h-full w-full" ref={containerRef} />
      <div className="fixed bottom-3 left-3 z-10 flex max-w-[calc(100vw-1.5rem)] flex-col gap-2 sm:bottom-5 sm:left-[450px]">
        {!queryOverlay && showForestZoomHint ? (
          <div className="glass-panel max-w-sm rounded-lg px-3 py-2 text-xs font-medium leading-5 text-slate-700 shadow-panel">
            Suumi veidi sisse, et ETAK metsaalad kaardile ilmuksid ja neid
            valida saaks.
          </div>
        ) : null}

        {!queryOverlay && isForestPreviewLoading && !hasForestPreviewFeatures ? (
          <div className="glass-panel inline-flex max-w-xs items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 shadow-panel">
            <LoaderCircle aria-hidden className="size-4 animate-spin text-emerald-700" />
            Laen ETAK metsaalasid...
          </div>
        ) : null}

        {queryOverlay ? (
          <div className="glass-panel max-w-sm rounded-lg p-3 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900">
                  {queryOverlay.label}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-slate-600">
                  {queryOverlay.status === "loading"
                    ? queryOverlay.message
                    : `${queryOverlay.matchedCount}/${queryOverlay.inspectedCount} nähtavast alast vastas filtrile. ${queryOverlay.message ?? ""}`}
                </div>
              </div>
              <button
                className="shrink-0 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:text-slate-950"
                onClick={() => {
                  const map = mapRef.current;
                  if (map) {
                    setGeojsonSource(map, "query-results", emptyCollection);
                    setGeojsonSource(map, "query-result-points", emptyCollection);
                    setForestPreviewVisibility(map, true);
                  }
                  setQueryOverlay(null);
                }}
                type="button"
              >
                Puhasta
              </button>
            </div>
          </div>
        ) : null}

        <div className="hidden gap-1.5 sm:flex">
          <button
            className="grid size-9 place-items-center rounded-md bg-white/85 text-slate-700 ring-1 ring-slate-200 backdrop-blur hover:bg-white"
            onClick={() => fitEstonia()}
            title="Reset view"
            type="button"
          >
            <RotateCcw aria-hidden className="size-4" />
          </button>
          <button
            className="grid size-9 place-items-center rounded-md bg-white/85 text-slate-700 ring-1 ring-slate-200 backdrop-blur hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!analysis}
            onClick={zoomToSelected}
            title="Zoom to selected"
            type="button"
          >
            <LocateFixed aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </>
  );
}
