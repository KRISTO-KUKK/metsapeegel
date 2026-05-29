"use client";

import { BarChart3, ExternalLink, Leaf, TreePine, X } from "lucide-react";
import clsx from "clsx";
import {
  dominantSpeciesAreaShares,
  dominantSpeciesStockShares,
  managementRestrictionShares,
  nationalForestInsights,
  nationalForestStatSources,
  nationalMetrics,
  ownershipShares,
  type NationalShare
} from "@/lib/data/nationalForestStats";

function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-lg border border-emerald-100 bg-emerald-50/75 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-700">{detail}</p>
    </article>
  );
}

function ShareBars({
  title,
  items,
  maxValue
}: {
  title: string;
  items: NationalShare[];
  maxValue?: number;
}) {
  const max = maxValue ?? Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="rounded-lg border border-slate-200 bg-white/88 px-3 py-3">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="mt-3 space-y-2.5">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-slate-700">{item.label}</span>
              <span className="font-semibold text-slate-950">
                {item.value.toLocaleString("et-EE")} {item.unit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={clsx(
                  "h-full rounded-full",
                  item.detail === "era"
                    ? "bg-sky-500"
                    : item.detail === "riik" || item.detail === "RMK"
                      ? "bg-emerald-600"
                      : "bg-lime-600"
                )}
                style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function NationalStatsButton({
  onClick
}: {
  onClick: () => void;
}) {
  return (
    <button
      className="fixed right-3 top-3 z-30 inline-flex items-center gap-2 rounded-lg border border-emerald-900/30 bg-gradient-to-br from-[#062616] via-[#0c3a21] to-[#174f2c] px-3 py-2 text-sm font-semibold text-white shadow-panel hover:from-[#0b321f] hover:to-[#1c5c34] sm:right-5 sm:top-5"
      onClick={onClick}
      type="button"
    >
      <BarChart3 aria-hidden className="size-4" />
      Eesti statistika
    </button>
  );
}

export function NationalStatsPanel({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/34 p-3 backdrop-blur-sm sm:p-5">
      <section className="ml-auto flex h-full max-w-[760px] flex-col overflow-hidden rounded-xl border border-white/70 bg-[var(--sage-50)] shadow-panel">
        <header className="shrink-0 border-b border-white/80 bg-gradient-to-br from-[#062616] via-[#0c3a21] to-[#174f2c] px-4 py-4 text-white">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/12 ring-1 ring-white/20">
              <TreePine aria-hidden className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-lime-200">
                SMI ja Keskkonnaportaal
              </div>
              <h2 className="mt-1 text-xl font-semibold leading-7">
                Eesti metsade üldpilt
              </h2>
              <p className="mt-1 text-sm leading-5 text-emerald-50/90">
                Taustakiht valitud ala tõlgendamiseks. See ei asenda konkreetse
                metsaala tõendipakki.
              </p>
            </div>
            <button
              aria-label="Sulge Eesti statistika"
              className="ml-auto grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/18"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {nationalMetrics.map((metric) => (
              <MetricCard
                detail={metric.detail}
                key={metric.id}
                label={metric.label}
                value={metric.value}
              />
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <ShareBars items={ownershipShares} title="Metsaomand" />
            <ShareBars
              items={managementRestrictionShares}
              maxValue={2.35}
              title="Majandamise piirangu üldjaotus"
            />
            <ShareBars
              items={dominantSpeciesAreaShares}
              title="Metsamaa pindala enamuspuuliigiti"
            />
            <ShareBars
              items={dominantSpeciesStockShares}
              title="Metsatagavara enamuspuuliigiti"
            />
          </div>

          <section className="mt-4 rounded-lg border border-lime-200 bg-lime-50/80 px-3 py-3">
            <div className="mb-2 flex items-center gap-2">
              <Leaf aria-hidden className="size-4 text-lime-800" />
              <h3 className="text-sm font-semibold text-slate-950">
                Mida see Metsatarga jaoks tähendab?
              </h3>
            </div>
            <ul className="space-y-2 text-sm leading-6 text-slate-700">
              {nationalForestInsights.map((item) => (
                <li className="flex gap-2" key={item}>
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-lime-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-4 rounded-lg border border-slate-200 bg-white/88 px-3 py-3">
            <h3 className="text-sm font-semibold text-slate-950">Allikad</h3>
            <div className="mt-2 grid gap-2">
              {nationalForestStatSources.map((source) => (
                <a
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50"
                  href={source.url}
                  key={source.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="flex items-center gap-2 font-semibold text-slate-950">
                    {source.label}
                    <ExternalLink aria-hidden className="size-3.5" />
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                    {source.note}
                  </span>
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
