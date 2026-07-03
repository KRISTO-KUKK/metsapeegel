"use client";

import { useCallback, useState } from "react";
import type { Feature, Geometry } from "geojson";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { AssistantPanel } from "@/components/AssistantPanel";
import { MapView } from "@/components/MapView";
import {
  NationalStatsButton,
  NationalStatsPanel
} from "@/components/NationalStatsPanel";
import { SearchBar } from "@/components/SearchBar";
import { withBasePath } from "@/lib/appBasePath";
import type {
  AnalysisResult,
  SentinelComparisonResult,
  SentinelComparisonState
} from "@/lib/types/forestry";

export default function Home() {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNationalStatsOpen, setIsNationalStatsOpen] = useState(false);
  const [sentinelComparison, setSentinelComparison] =
    useState<SentinelComparisonState>({ status: "idle" });

  const selectArea = useCallback(async (areaId: string) => {
    setSelectedAreaId(areaId);
    setIsLoading(true);
    setError(null);
    setSentinelComparison({ status: "idle" });

    try {
      const response = await fetch(withBasePath(`/api/analyze/${encodeURIComponent(areaId)}`));
      if (!response.ok) {
        throw new Error("Analüüsi laadimine ebaõnnestus.");
      }
      const payload = (await response.json()) as AnalysisResult;
      setAnalysis(payload);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Analüüsi laadimine ebaõnnestus."
      );
      setAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectForestAt = useCallback(
    async ({ lng, lat }: { lng: number; lat: number }) => {
      setIsLoading(true);
      setError(null);
      setSentinelComparison({ status: "idle" });

      try {
        const response = await fetch(
          withBasePath(`/api/forest-at?lng=${encodeURIComponent(lng)}&lat=${encodeURIComponent(lat)}`)
        );

        if (response.status === 404) {
          return;
        }

        if (!response.ok) {
          throw new Error("Metsaala päring ebaõnnestus.");
        }

        const payload = (await response.json()) as { analysis: AnalysisResult };
        setSelectedAreaId(payload.analysis.area.id);
        setAnalysis(payload.analysis);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Metsaala päring ebaõnnestus."
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const selectForestFeature = useCallback(
    async (feature: Feature<Geometry, Record<string, unknown>>) => {
      setIsLoading(true);
      setError(null);
      setSentinelComparison({ status: "idle" });

      try {
        const response = await fetch(withBasePath("/api/analyze-feature"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ feature })
        });

        if (response.status === 404) {
          return;
        }

        if (!response.ok) {
          throw new Error("Metsaala päring ebaõnnestus.");
        }

        const payload = (await response.json()) as { analysis: AnalysisResult };
        setSelectedAreaId(payload.analysis.area.id);
        setAnalysis(payload.analysis);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Metsaala päring ebaõnnestus."
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const searchSentinelComparison = useCallback(async () => {
    if (!analysis) {
      return;
    }

    setSentinelComparison({ status: "loading" });

    try {
      const response = await fetch(withBasePath("/api/sentinel-comparison"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ geometry: analysis.area.geometry })
      });

      const payload = (await response.json()) as
        | SentinelComparisonResult
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Sentinel võrdluspiltide otsing ebaõnnestus."
        );
      }

      setSentinelComparison({
        status: "loaded",
        result: payload as SentinelComparisonResult
      });
    } catch (cause) {
      setSentinelComparison({
        status: "error",
        message:
          cause instanceof Error
            ? cause.message
            : "Sentinel võrdluspiltide otsing ebaõnnestus."
      });
    }
  }, [analysis]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[var(--sage-50)]">
      <MapView
        analysis={analysis}
        onSelectForestFeature={selectForestFeature}
        onSelectForestAt={selectForestAt}
        selectedAreaId={selectedAreaId}
      />
      <div className="map-vignette" />

      <header className="pointer-events-none fixed left-3 top-3 z-30 w-[calc(100vw-1.5rem)] sm:left-5 sm:w-auto">
        <div className="header-shell pointer-events-auto flex w-full flex-col gap-2 rounded-lg px-3 py-2 sm:w-fit sm:max-w-[calc(100vw-2.5rem)] sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 shrink-0 items-center">
            <img
              alt="Metsatark"
              className="h-10 w-auto max-w-[220px] object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.32)] sm:h-11 sm:max-w-[255px]"
              src={withBasePath("/metsatark-logo.png")}
            />
          </div>
          <SearchBar onSelectArea={selectArea} />
        </div>
      </header>

      <AssistantPanel analysis={analysis} isLoading={isLoading} />

      <AnalysisPanel
        analysis={analysis}
        error={error}
        isLoading={isLoading}
        onSearchSentinelComparison={searchSentinelComparison}
        sentinelComparison={sentinelComparison}
      />

      <NationalStatsButton onClick={() => setIsNationalStatsOpen(true)} />
      <NationalStatsPanel
        isOpen={isNationalStatsOpen}
        onClose={() => setIsNationalStatsOpen(false)}
      />
    </main>
  );
}
