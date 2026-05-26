"use client";

import { useCallback, useState } from "react";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { MapView } from "@/components/MapView";
import { SearchBar } from "@/components/SearchBar";
import type { AnalysisResult } from "@/lib/types/forestry";

export default function Home() {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectArea = useCallback(async (areaId: string) => {
    setSelectedAreaId(areaId);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analyze/${encodeURIComponent(areaId)}`);
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

      try {
        const response = await fetch(
          `/api/forest-at?lng=${encodeURIComponent(lng)}&lat=${encodeURIComponent(lat)}`
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

  return (
    <main className="relative h-dvh min-h-[720px] overflow-hidden bg-[var(--sage-50)]">
      <MapView
        analysis={analysis}
        onSelectForestAt={selectForestAt}
        selectedAreaId={selectedAreaId}
      />
      <div className="map-vignette" />

      <header className="pointer-events-none fixed left-0 right-0 top-0 z-20 px-4 pt-4 sm:px-6">
        <div className="pointer-events-auto mx-auto flex max-w-6xl flex-col gap-3 rounded-lg glass-panel p-3 sm:flex-row sm:items-center sm:gap-5">
          <div className="min-w-0 sm:w-72">
            <div className="text-xl font-semibold text-[var(--forest-950)]">
              Metsapeegel
            </div>
            <div className="truncate text-sm text-[var(--muted)]">
              Vaata, mis valitud metsaalal andmete põhjal toimus.
            </div>
          </div>
          <SearchBar onSelectArea={selectArea} />
        </div>
      </header>

      <AnalysisPanel
        analysis={analysis}
        error={error}
        isLoading={isLoading}
      />
    </main>
  );
}
