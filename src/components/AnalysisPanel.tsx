"use client";

import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { ConfidenceScore } from "@/components/ConfidenceScore";
import { EvidenceList } from "@/components/EvidenceList";
import { SourceBadges } from "@/components/SourceBadges";
import { StatusBadge } from "@/components/StatusBadge";
import { Timeline } from "@/components/Timeline";
import type { AnalysisResult } from "@/lib/types/forestry";

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function AnalysisPanel({
  analysis,
  isLoading,
  error
}: {
  analysis: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <aside className="fixed bottom-3 left-3 right-3 z-10 max-h-[42dvh] overflow-y-auto rounded-lg glass-panel p-3 shadow-panel sm:bottom-5 sm:left-auto sm:right-5 sm:top-28 sm:max-h-none sm:w-[440px] sm:p-5">
      {isLoading ? (
        <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-slate-600 sm:min-h-56">
          <Loader2 aria-hidden className="size-5 animate-spin text-[var(--forest-700)]" />
          Koostan tõlgendust...
        </div>
      ) : error ? (
        <div className="flex min-h-32 items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:min-h-56">
          <AlertTriangle aria-hidden className="size-5 shrink-0" />
          {error}
        </div>
      ) : analysis ? (
        <div className="space-y-5">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={analysis.status} />
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                {analysis.area.areaHa} ha
              </span>
              {analysis.area.forestHa ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                  metsamaad {analysis.area.forestHa} ha
                </span>
              ) : null}
            </div>
            <h2 className="text-xl font-semibold leading-7 text-slate-950">
              {analysis.headline}
            </h2>
            {analysis.area.type === "parcel" || analysis.area.type === "forest" ? (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                {analysis.area.etakId ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
                    ETAK mets {analysis.area.etakId}
                  </span>
                ) : null}
                {analysis.area.cadastralId ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    {analysis.area.cadastralId}
                  </span>
                ) : null}
                {analysis.area.ownershipForm ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    {analysis.area.ownershipForm}
                  </span>
                ) : null}
                {analysis.area.landUse ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    {analysis.area.landUse.toLocaleLowerCase("et")}
                  </span>
                ) : null}
              </div>
            ) : null}
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {analysis.summary}
            </p>
          </div>

          <Section title="Usaldusskoor">
            <ConfidenceScore score={analysis.confidenceScore} />
          </Section>

          <Section title="Mis juhtus?">
            <ul className="space-y-2 text-sm leading-6 text-slate-700">
              {analysis.whatHappened.map((item) => (
                <li className="flex gap-2" key={item}>
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--forest-600)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Mille põhjal?">
            <EvidenceList evidence={analysis.evidence} />
          </Section>

          <Section title="Mis on puudu?">
            <ul className="space-y-2 text-sm leading-6 text-slate-700">
              {analysis.missingInfo.map((item) => (
                <li className="flex gap-2" key={item}>
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--amber)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {analysis.warnings.length > 0 ? (
              <div className="mt-3 space-y-2">
                {analysis.warnings.map((warning) => (
                  <div
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-900"
                    key={warning}
                  >
                    {warning}
                  </div>
                ))}
              </div>
            ) : null}
          </Section>

          <Section title="Ajajoon">
            <Timeline events={analysis.timeline} />
          </Section>

          <Section title="Andmeallikad">
            <SourceBadges sources={analysis.sources} />
          </Section>

          <Section title="Tehniline detail">
            <details className="group rounded-lg border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-slate-800">
                JSON / raw facts
                <ChevronDown
                  aria-hidden
                  className="size-4 transition group-open:rotate-180"
                />
              </summary>
              <pre className="max-h-72 overflow-auto border-t border-slate-200 p-3 text-xs leading-5 text-slate-700">
                {JSON.stringify(analysis.rawFacts, null, 2)}
              </pre>
            </details>
          </Section>
        </div>
      ) : (
        <div>
          <div className="mb-2 inline-flex rounded-full bg-[var(--sage-100)] px-2.5 py-1 text-xs font-semibold text-[var(--forest-800)]">
            Metsandusandmete tõlgenduskiht
          </div>
          <h2 className="text-lg font-semibold leading-6 text-slate-950">
            Klõpsa rohelisel metsaalal.
          </h2>
          <p className="mt-2 text-sm leading-5 text-slate-600">
            Valik päritakse Maa- ja Ruumiameti ETAK WFS-ist ning tehakse
            ainult siis, kui klõps jääb tüübi “Mets” polügooni sisse.
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs leading-5 text-slate-600">
            Maakonnad on taust. Katastrist kuvatakse tunnus ja omandivorm,
            mitte eraomaniku nimi.
          </div>
        </div>
      )}
    </aside>
  );
}
