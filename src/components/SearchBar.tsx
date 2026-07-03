"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { withBasePath } from "@/lib/appBasePath";
import type { SearchResult } from "@/lib/types/forestry";

type SearchResponse = {
  results: SearchResult[];
};

export function SearchBar({
  onSelectArea
}: {
  onSelectArea: (areaId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          withBasePath(`/api/search?q=${encodeURIComponent(query)}`),
          { signal: controller.signal }
        );
        const payload = (await response.json()) as SearchResponse;
        setResults(payload.results);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 120);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function selectResult(result: SearchResult) {
    setQuery(result.label);
    setIsOpen(false);
    onSelectArea(result.id);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (results[0]) {
      selectResult(results[0]);
    }
  }

  return (
    <div className="relative w-full sm:w-[260px] sm:flex-none" ref={wrapperRef}>
      <form
        className="flex h-10 items-center gap-2 rounded-md border border-white/70 bg-white/90 px-3 shadow-sm"
        onSubmit={submit}
      >
        <Search aria-hidden className="size-4 shrink-0 text-[var(--forest-700)]" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Otsi katastritunnuse järgi..."
          value={query}
        />
        {isLoading ? (
          <Loader2 aria-hidden className="size-4 animate-spin text-slate-400" />
        ) : query ? (
          <button
            aria-label="Tühjenda otsing"
            className="grid size-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
            onClick={() => {
              setQuery("");
              setIsOpen(true);
            }}
            type="button"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </form>

      {isOpen && results.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-lg border border-white/80 bg-white shadow-panel">
          {results.map((result) => (
            <button
              className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-[var(--sage-50)]"
              key={result.id}
              onClick={() => selectResult(result)}
              type="button"
            >
              <MapPin
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-[var(--forest-700)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-950">
                  {result.label}
                </span>
                {result.subtitle ? (
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {result.subtitle}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
