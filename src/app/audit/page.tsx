"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Loader2, RefreshCw } from "lucide-react";
import clsx from "clsx";

type AuditRow = {
  id: string;
  name: string;
  county?: string;
  ownershipForm?: string;
  areaHa: number;
  riskLevel: string;
  riskScore: number;
  recommendation: string;
  status: string;
  confidenceScore: number;
  stands: number;
  notices: number;
  changes: number;
  protectedAreas: number;
  topReasons: string[];
};

type AuditSample = {
  sampledAt: string;
  total: number;
  counts: {
    riskLevels: Record<string, number>;
    recommendations: Record<string, number>;
    statuses: Record<string, number>;
  };
  rows: AuditRow[];
  failures: Array<{ sample: string; reason: string }>;
};

const riskClass: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-900",
  high: "bg-red-100 text-red-800"
};

function CountCard({
  label,
  value,
  className
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={clsx("rounded-lg border border-slate-200 bg-white p-4", className)}>
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{label}</div>
    </div>
  );
}

export default function AuditPage() {
  const [sample, setSample] = useState<AuditSample | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSample() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/audit-sample?perCounty=1&maxSamples=12");
      if (!response.ok) {
        throw new Error("Andmeanalüsaatori päring ebaõnnestus.");
      }
      setSample((await response.json()) as AuditSample);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Andmeanalüsaatori päring ebaõnnestus."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSample();
  }, []);

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-5 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <Link
            className="inline-grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            href="/"
          >
            <ArrowLeft aria-hidden className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xl font-semibold">
              <BarChart3 aria-hidden className="size-5 text-[var(--forest-700)]" />
              Andmeanalüsaator
            </div>
            <div className="text-sm text-slate-600">
              Päris ETAK metsaalade valim läbi sama reeglimootori.
            </div>
          </div>
          <button
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[var(--forest-700)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--forest-800)] disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isLoading}
            onClick={() => void loadSample()}
            type="button"
          >
            {isLoading ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <RefreshCw aria-hidden className="size-4" />
            )}
            Uuenda
          </button>
        </header>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {isLoading && !sample ? (
          <div className="flex min-h-64 items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-600">
            <Loader2 aria-hidden className="size-5 animate-spin" />
            Analüüsin pärisandmete valimit...
          </div>
        ) : null}

        {sample ? (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              <CountCard label="analüüsitud ala" value={sample.total} />
              <CountCard
                className="bg-emerald-50"
                label="madal risk"
                value={sample.counts.riskLevels.low ?? 0}
              />
              <CountCard
                className="bg-amber-50"
                label="vajab konteksti"
                value={sample.counts.riskLevels.medium ?? 0}
              />
              <CountCard
                className="bg-red-50"
                label="tundlik kooslus"
                value={sample.counts.riskLevels.high ?? 0}
              />
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">
                Valimi read
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Ala</th>
                      <th className="px-4 py-3">Risk</th>
                      <th className="px-4 py-3">Teatised</th>
                      <th className="px-4 py-3">Kaitse</th>
                      <th className="px-4 py-3">Eraldised</th>
                      <th className="px-4 py-3">Põhjused</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sample.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-950">
                            {row.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {[row.county, row.ownershipForm, `${row.areaHa} ha`]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={clsx(
                              "rounded-full px-2.5 py-1 text-xs font-semibold",
                              riskClass[row.riskLevel] ?? "bg-slate-100 text-slate-700"
                            )}
                          >
                            {row.riskLevel} · {row.riskScore}
                          </span>
                        </td>
                        <td className="px-4 py-3">{row.notices}</td>
                        <td className="px-4 py-3">{row.protectedAreas}</td>
                        <td className="px-4 py-3">{row.stands}</td>
                        <td className="px-4 py-3 text-xs leading-5 text-slate-600">
                          {row.topReasons.length > 0
                            ? row.topReasons.join(" ")
                            : "Tugevat riskitegurit ei paista."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {sample.failures.length > 0 ? (
              <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <div className="font-semibold">Andmelüngad</div>
                {sample.failures.slice(0, 6).map((failure) => (
                  <div key={`${failure.sample}-${failure.reason}`}>
                    {failure.sample}: {failure.reason}
                  </div>
                ))}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
