"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Database,
  Download,
  FileText,
  Info,
  Layers,
  Loader2,
  MapPinned,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import clsx from "clsx";
import { downloadCadastreSummary } from "@/lib/export/cadastreSummary";
import type {
  AnalysisResult,
  NormalizedEvidenceItem,
  NormalizedEvidenceTone,
  NormalizedInterpretationBlock,
  NormalizedProtectionGroup,
  NormalizedSourceStatus,
  SourceStatus
} from "@/lib/types/forestry";

const sourceStatusLabel: Record<SourceStatus, string> = {
  loaded: "laetud",
  missing: "andmed puuduvad",
  error: "viga",
  not_public: "mitteavalik",
  not_connected: "ühendamata"
};

const sourceStatusClass: Record<SourceStatus, string> = {
  loaded: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  missing: "bg-amber-50 text-amber-900 ring-amber-200",
  error: "bg-red-50 text-red-800 ring-red-200",
  not_public: "bg-slate-100 text-slate-700 ring-slate-200",
  not_connected: "bg-slate-100 text-slate-700 ring-slate-200"
};

const toneClass: Record<NormalizedEvidenceTone, string> = {
  positive: "border-emerald-200 bg-emerald-50/85 text-emerald-950",
  attention: "border-amber-200 bg-amber-50/90 text-amber-950",
  limit: "border-rose-200 bg-rose-50/90 text-rose-950",
  neutral: "border-slate-200 bg-white/88 text-slate-900"
};

function Section({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-slate-200 pt-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: SourceStatus }) {
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
        sourceStatusClass[status]
      )}
    >
      {sourceStatusLabel[status]}
    </span>
  );
}

function FactRow({
  label,
  value,
  tooltip
}: {
  label: string;
  value: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <div className="grid grid-cols-[105px_1fr] gap-3 text-sm leading-5">
      <div className="flex items-center gap-1 text-slate-500">
        <span>{label}</span>
        {tooltip ? (
          <span title={tooltip}>
            <Info aria-hidden className="size-3.5" />
          </span>
        ) : null}
      </div>
      <div className="font-medium text-slate-900">{value}</div>
    </div>
  );
}

function BulletList({
  items,
  markerClassName = "bg-[var(--forest-600)]"
}: {
  items: string[];
  markerClassName?: string;
}) {
  return (
    <ul className="space-y-2 text-sm leading-6 text-slate-700">
      {items.map((item) => (
        <li className="flex gap-2" key={item}>
          <span className={clsx("mt-2 size-1.5 shrink-0 rounded-full", markerClassName)} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function EvidenceCard({
  id,
  title,
  icon: Icon,
  tone,
  highlighted,
  children
}: {
  id: string;
  title: string;
  icon: typeof FileText;
  tone: NormalizedEvidenceTone;
  highlighted: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      className={clsx(
        "scroll-mt-28 rounded-lg border px-3 py-3 transition-shadow",
        toneClass[tone],
        highlighted && "shadow-[0_0_0_3px_rgba(47,107,60,0.22)]"
      )}
      id={id}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon aria-hidden className="size-4 shrink-0" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </article>
  );
}

function MetricPills({ block }: { block: NormalizedInterpretationBlock }) {
  if (!block.metrics?.length) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {block.metrics.slice(0, 5).map((metric) => (
        <span
          className="rounded-full bg-white/75 px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200"
          key={`${block.id}-${metric.label}`}
          title={metric.label}
        >
          <span className="text-slate-500">{metric.label}: </span>
          {metric.value}
        </span>
      ))}
    </div>
  );
}

function InterpretationBlockCard({
  block,
  id,
  highlighted,
  icon
}: {
  block: NormalizedInterpretationBlock;
  id: string;
  highlighted: boolean;
  icon: typeof FileText;
}) {
  return (
    <EvidenceCard
      highlighted={highlighted}
      icon={icon}
      id={id}
      title={block.title}
      tone={block.tone}
    >
      <p className="text-sm leading-6 text-current">{block.summary}</p>
      <MetricPills block={block} />
    </EvidenceCard>
  );
}

function findEvidence(
  analysis: AnalysisResult,
  id: string | null
): NormalizedEvidenceItem | undefined {
  if (!id) return undefined;
  return analysis.normalizedEvidence.evidenceItems.find((item) => item.id === id);
}

function UsedDataRow({
  source,
  highlighted
}: {
  source: NormalizedSourceStatus;
  highlighted: boolean;
}) {
  return (
    <article
      className={clsx(
        "rounded-lg border bg-white/88 px-3 py-3 transition",
        highlighted
          ? "border-[var(--forest-700)] shadow-[0_0_0_3px_rgba(47,107,60,0.16)]"
          : "border-slate-200"
      )}
      data-source-id={source.id}
      id={`source-${source.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-5 text-slate-950">
            {source.name}
          </h4>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">
            {source.summary}
          </p>
          {source.url ? (
            <a
              className="mt-1 inline-flex text-xs font-semibold text-[var(--forest-700)] hover:text-[var(--forest-900)]"
              href={source.url}
              rel="noreferrer"
              target="_blank"
            >
              Ava allikas
            </a>
          ) : null}
        </div>
        <StatusPill status={source.status} />
      </div>
    </article>
  );
}

const sourceToneClass: Record<string, string> = {
  "maaamet-etak-forest": "border-emerald-100 bg-emerald-50/80",
  "maaamet-cadastre": "border-sky-100 bg-sky-50/80",
  metsaregister: "border-lime-100 bg-lime-50/80",
  eelis: "border-indigo-100 bg-indigo-50/80",
  elme: "border-teal-100 bg-teal-50/80",
  "forest-changes": "border-amber-100 bg-amber-50/80",
  gaps: "border-amber-100 bg-amber-50/80"
};

function sourceById(analysis: AnalysisResult, sourceId: string) {
  return analysis.normalizedEvidence.sourceStatus.find(
    (source) => source.id === sourceId
  );
}

function SourceBlock({
  analysis,
  sourceId,
  title,
  subtitle,
  icon: Icon,
  highlighted,
  children
}: {
  analysis: AnalysisResult;
  sourceId: string;
  title: string;
  subtitle: string;
  icon: typeof FileText;
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  const source = sourceById(analysis, sourceId);

  return (
    <section
      className={clsx(
        "scroll-mt-28 rounded-lg border px-3 py-3 transition-shadow",
        sourceToneClass[sourceId] ?? "border-slate-200 bg-white/88",
        highlighted && "shadow-[0_0_0_3px_rgba(47,107,60,0.2)]"
      )}
      id={`source-block-${sourceId}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon aria-hidden className="size-4 shrink-0 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">{subtitle}</p>
          {source?.url ? (
            <a
              className="mt-1 inline-flex text-xs font-semibold text-[var(--forest-700)] hover:text-[var(--forest-900)]"
              href={source.url}
              rel="noreferrer"
              target="_blank"
            >
              Ava allikas
            </a>
          ) : null}
        </div>
        {source ? <StatusPill status={source.status} /> : null}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ProtectionGroups({
  groups
}: {
  groups: NormalizedProtectionGroup[];
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white/88 px-3 py-3 text-sm leading-5 text-slate-600">
        Ühendatud EELIS kihid ei tagastanud selle ala kohta kaitse-, Natura-,
        VEP- ega elupaigakattuvust.
      </p>
    );
  }

  const visible = groups.slice(0, 4);
  const hidden = groups.slice(4);

  function groupText(group: NormalizedProtectionGroup) {
    const overlap =
      group.overlapHa !== undefined
        ? `, kattuvus ligikaudu ${group.overlapHa} ha`
        : "";
    const codes = group.codes?.length ? `: ${group.codes.join(", ")}` : "";
    const count = group.count > 1 && !group.codes?.length ? ` (${group.count} objekti)` : "";
    return `${group.label}${codes}${count}${overlap}`;
  }

  return (
    <div className="space-y-2" id="card-protection">
      {visible.map((group) => (
        <div
          className="rounded-lg border border-sky-100 bg-sky-50/75 px-3 py-2 text-sm leading-5 text-sky-950"
          key={group.id}
        >
          {groupText(group)}
        </div>
      ))}
      <p className="rounded-lg bg-white/80 px-3 py-2 text-xs leading-5 text-slate-600 ring-1 ring-slate-200">
        Kattuvus ei ole lõplik õiguslik otsus, aga see on oluline kontekst.
      </p>
      {hidden.length > 0 ? (
        <details className="group rounded-lg border border-slate-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-slate-800">
            Näita kõiki kattuvusi ({groups.length})
            <ChevronDown
              aria-hidden
              className="size-4 transition group-open:rotate-180"
            />
          </summary>
          <div className="space-y-2 border-t border-slate-200 p-2">
            {hidden.map((group) => (
              <div
                className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700"
                key={group.id}
              >
                {groupText(group)}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function EcosystemDetails({ analysis }: { analysis: AnalysisResult }) {
  const ecosystem = analysis.normalizedEvidence.ecosystemContext;
  const rows = [
    ecosystem.woodRawMaterialCount > 0
      ? `Puidutooraine kattuvusi: ${ecosystem.woodRawMaterialCount}.`
      : undefined,
    ecosystem.carbonStorageCount > 0
      ? `Süsiniku kattuvusi: ${ecosystem.carbonStorageCount}.`
      : undefined,
    ecosystem.woodEurPerHaMin !== undefined &&
    ecosystem.woodEurPerHaMax !== undefined
      ? `Puidutooraine hinnangu vahemik: ${ecosystem.woodEurPerHaMin}-${ecosystem.woodEurPerHaMax} eurot/ha.`
      : undefined,
    ecosystem.woodTotalEur !== undefined
      ? `Leitud puidutooraine hinnangute summa: ${ecosystem.woodTotalEur} eurot.`
      : undefined,
    ecosystem.carbonTonPerHaMin !== undefined &&
    ecosystem.carbonTonPerHaMax !== undefined
      ? `Süsiniku hinnangu vahemik: ${ecosystem.carbonTonPerHaMin}-${ecosystem.carbonTonPerHaMax} t C/ha.`
      : undefined
  ].filter((row): row is string => Boolean(row));

  return (
    <div className="space-y-2" id="card-ecosystem">
      <p className="rounded-lg border border-slate-200 bg-white/88 px-3 py-3 text-sm leading-5 text-slate-700">
        {ecosystem.summary}
      </p>
      {rows.length > 0 ? <BulletList items={rows} /> : null}
    </div>
  );
}

function TechnicalDetails({ analysis }: { analysis: AnalysisResult }) {
  const pkg = analysis.evidencePackage;

  return (
    <details className="group rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-slate-800">
        Tehnilised detailid
        <ChevronDown
          aria-hidden
          className="size-4 transition group-open:rotate-180"
        />
      </summary>
      <div className="space-y-3 border-t border-slate-200 p-3">
        <div className="grid gap-2 text-xs leading-5 text-slate-700">
          <FactRow label="ETAK ID" value={analysis.area.etakId ?? "puudub"} />
          <FactRow label="Geomeetria" value={pkg.selectedArea.geometrySource} />
          <FactRow label="Valikutüüp" value={pkg.selectedArea.selectionType} />
          <FactRow label="ETAK tüüp" value={analysis.area.etakType ?? "puudub"} />
        </div>
        <details className="group/raw rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-slate-700">
            Toorandmete lühivaade
            <ChevronDown
              aria-hidden
              className="size-4 transition group-open/raw:rotate-180"
            />
          </summary>
          <pre className="max-h-72 overflow-auto border-t border-slate-200 p-3 text-xs leading-5 text-slate-700">
            {JSON.stringify(
              {
                area: analysis.area,
                sourceStatus: analysis.normalizedEvidence.sourceStatus,
                registrySummary: analysis.normalizedEvidence.registrySummary,
                protectionSummary: analysis.normalizedEvidence.protectionSummary,
                ecosystemContext: analysis.normalizedEvidence.ecosystemContext,
                rawFacts: analysis.rawFacts
              },
              null,
              2
            )}
          </pre>
        </details>
      </div>
    </details>
  );
}

function SourceBasedAnalysis({
  analysis,
  highlightedSourceId,
  highlightedTargetId
}: {
  analysis: AnalysisResult;
  highlightedSourceId: string | null;
  highlightedTargetId: string | null;
}) {
  const disconnectedSources = analysis.normalizedEvidence.sourceStatus.filter(
    (source) => source.status !== "loaded"
  );

  return (
    <div className="space-y-3">
      <SourceBlock
        analysis={analysis}
        highlighted={highlightedSourceId === "maaamet-etak-forest"}
        icon={MapPinned}
        sourceId="maaamet-etak-forest"
        subtitle="Kaardil klikitav metsaobjekt ja valitud geomeetria."
        title="ETAK metsaala"
      >
        <FactRow
          label="Objekt"
          tooltip="ETAK metsaala on topograafiline metsaobjekt kaardil; see ei kirjelda kogu metsanduslikku seisu."
          value={analysis.area.etakId ? `ETAK ${analysis.area.etakId}` : "ETAK metsaala"}
        />
        <FactRow label="Pindala" value={`${analysis.normalizedEvidence.area.areaHa} ha`} />
        <FactRow label="Tüüp" value={analysis.area.etakType ?? "metsaala"} />
      </SourceBlock>

      <SourceBlock
        analysis={analysis}
        highlighted={highlightedSourceId === "maaamet-cadastre"}
        icon={Database}
        sourceId="maaamet-cadastre"
        subtitle="Katastriüksuse avalik taust: tunnus, omandivorm ja maakasutus."
        title="Kataster"
      >
        <FactRow
          label="Tunnus"
          tooltip="Kataster on maaüksuste register. Katastritunnus seob kaardil oleva ala konkreetse maaüksusega."
          value={analysis.area.cadastralId ?? "andmetes ei leitud"}
        />
        <FactRow label="Omand" value={analysis.area.ownershipForm ?? "andmetes ei leitud"} />
        <FactRow label="Maakasutus" value={analysis.area.landUse ?? "andmetes ei leitud"} />
        {analysis.area.address ? (
          <FactRow label="Aadress" value={analysis.area.address} />
        ) : null}
      </SourceBlock>

      <SourceBlock
        analysis={analysis}
        highlighted={
          highlightedSourceId === "metsaregister" ||
          highlightedTargetId === "card-registry" ||
          highlightedTargetId === "card-attention"
        }
        icon={FileText}
        sourceId="metsaregister"
        subtitle="Eraldised, inventuur ja metsateatised sama valitud ala kohta."
        title="Metsaregister"
      >
        <FactRow
          label="Eraldised"
          value={`${analysis.normalizedEvidence.registrySummary.standsCount} tk`}
        />
        <FactRow
          label="Teatised"
          tooltip="Metsateatis on ametlik teade kavandatud raie või metsakahjustuse kohta; see ei tõenda üksinda, et töö on toimunud."
          value={`${analysis.normalizedEvidence.registrySummary.activeNoticesCount} aktiivset, ${analysis.normalizedEvidence.registrySummary.archivedNoticesCount} arhiveeritud`}
        />
        <FactRow
          label="Inventuur"
          value={analysis.normalizedEvidence.registrySummary.inventorySummary}
        />
        <FactRow
          label="Puuliigid"
          value={
            analysis.normalizedEvidence.registrySummary.dominantSpecies.length
              ? analysis.normalizedEvidence.registrySummary.dominantSpecies.join(", ")
              : "andmetes ei leitud"
          }
        />
        <FactRow
          label="Arenguklass"
          value={
            analysis.normalizedEvidence.registrySummary.developmentClasses.length
              ? analysis.normalizedEvidence.registrySummary.developmentClasses.join(", ")
              : "andmetes ei leitud"
          }
        />
        {analysis.normalizedEvidence.registrySummary.veryOldInventory ? (
          <p className="rounded-md bg-amber-50 px-2 py-2 text-xs font-medium leading-5 text-amber-900 ring-1 ring-amber-200">
            Inventuuriandmed võivad olla väga vanad, seega tänase metsaseisu
            kohta tuleb järeldusi hoida ettevaatlikuna.
          </p>
        ) : null}
      </SourceBlock>

      <SourceBlock
        analysis={analysis}
        highlighted={
          highlightedSourceId === "eelis" ||
          highlightedTargetId === "card-protection"
        }
        icon={ShieldAlert}
        sourceId="eelis"
        subtitle="Kaitse-, Natura-, VEP-, piirangu- ja elupaigakattuvused."
        title="EELIS"
      >
        <ProtectionGroups groups={analysis.normalizedEvidence.protectionSummary} />
      </SourceBlock>

      <SourceBlock
        analysis={analysis}
        highlighted={
          highlightedSourceId === "elme" ||
          highlightedTargetId === "card-ecosystem"
        }
        icon={Layers}
        sourceId="elme"
        subtitle="Looduse hüvede lisakontekst, mitte raie või lubatavuse tõend."
        title="ELME"
      >
        <EcosystemDetails analysis={analysis} />
      </SourceBlock>

      <section
        className={clsx(
          "rounded-lg border px-3 py-3",
          sourceToneClass.gaps,
          highlightedTargetId === "card-cannot-claim" &&
            "shadow-[0_0_0_3px_rgba(47,107,60,0.2)]"
        )}
        id="card-cannot-claim"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle aria-hidden className="size-4 text-amber-800" />
              <h3 className="text-sm font-semibold text-slate-950">
                Puudu või ühendamata
              </h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Need piiravad järeldusi. Neid ei kasutata kindla faktitõendina.
            </p>
          </div>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
            {analysis.normalizedEvidence.dataCompleteness.score}/100
          </span>
        </div>
        <p className="mb-2 text-sm leading-5 text-slate-800">
          {analysis.normalizedEvidence.dataCompleteness.meaning}
        </p>
        <div className="space-y-2">
          {disconnectedSources.length > 0 ? (
            disconnectedSources.map((source) => (
              <UsedDataRow
                highlighted={highlightedSourceId === source.id}
                key={source.id}
                source={source}
              />
            ))
          ) : (
            <p className="rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
              Peamised prototüübi allikad on selle ala kohta laetud.
            </p>
          )}
        </div>
      </section>

      {analysis.normalizedEvidence.timeline.length > 0 ? (
        <details className="group rounded-lg border border-slate-200 bg-white/82">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-slate-900">
            Ajajoon
            <ChevronDown
              aria-hidden
              className="size-4 transition group-open:rotate-180"
            />
          </summary>
          <div className="space-y-2 border-t border-slate-200 p-3">
            {analysis.normalizedEvidence.timeline.map((item) => (
              <div
                className="rounded-lg border border-slate-200 bg-white/88 px-3 py-2 text-sm leading-5 text-slate-700"
                key={item.id}
              >
                <div className="font-semibold text-slate-950">
                  {item.year ? `${item.year}: ` : ""}
                  {item.label}
                </div>
                <div>{item.detail}</div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
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
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(
    null
  );
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(
    null
  );

  useEffect(() => {
    function onEvidenceLink(event: Event) {
      const detail = (event as CustomEvent<{
        evidenceId?: string;
        sourceId?: string;
        targetId?: string;
      }>).detail;

      if (!detail) return;

      const evidence = analysis
        ? findEvidence(analysis, detail.evidenceId ?? null)
        : undefined;
      const targetId = detail.targetId ?? evidence?.targetId ?? null;
      const sourceId = detail.sourceId ?? evidence?.sourceId ?? null;

      if (targetId) {
        setHighlightedTargetId(targetId);
        document
          .getElementById(targetId)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => setHighlightedTargetId(null), 2600);
      }

      if (sourceId) {
        setHighlightedSourceId(sourceId);
        window.setTimeout(() => setHighlightedSourceId(null), 2600);
      }
    }

    function onEvidenceSource(event: Event) {
      const sourceId = (event as CustomEvent<{ sourceId?: string }>).detail
        ?.sourceId;
      if (!sourceId) return;

      setHighlightedSourceId(sourceId);
      document
        .getElementById(`source-${sourceId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => setHighlightedSourceId(null), 2600);
    }

    window.addEventListener("metsapeegel:evidence-link", onEvidenceLink);
    window.addEventListener("metsapeegel:evidence-source", onEvidenceSource);
    return () => {
      window.removeEventListener("metsapeegel:evidence-link", onEvidenceLink);
      window.removeEventListener("metsapeegel:evidence-source", onEvidenceSource);
    };
  }, [analysis]);

  const loadedSourceCount = useMemo(() => {
    if (!analysis) return 0;
    return analysis.normalizedEvidence.sourceStatus.filter(
      (source) => source.status === "loaded"
    ).length;
  }, [analysis]);

  return (
    <aside className="fixed bottom-3 left-3 right-3 z-10 max-h-[42dvh] overflow-y-auto rounded-lg glass-panel p-3 shadow-panel sm:bottom-5 sm:left-auto sm:right-5 sm:top-24 sm:max-h-none sm:w-[510px] sm:p-5">
      {isLoading ? (
        <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-slate-600 sm:min-h-56">
          <Loader2 aria-hidden className="size-5 animate-spin text-[var(--forest-700)]" />
          Laen valitud ala tõendipakki...
        </div>
      ) : error ? (
        <div className="flex min-h-32 items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:min-h-56">
          <AlertTriangle aria-hidden className="size-5 shrink-0" />
          {error}
        </div>
      ) : analysis ? (
        <div className="space-y-5">
          <header>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--sage-100)] px-2.5 py-1 text-xs font-semibold text-[var(--forest-800)]">
                <Sparkles aria-hidden className="size-3.5" />
                AI-tõlgendus ametlike andmete peal
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                {loadedSourceCount}/{analysis.normalizedEvidence.sourceStatus.length} allikat laetud
              </span>
              <button
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-[var(--forest-800)] hover:ring-[var(--forest-200)]"
                onClick={() => downloadCadastreSummary(analysis)}
                type="button"
              >
                <Download aria-hidden className="size-3.5" />
                Laadi kokkuvõte
              </button>
            </div>
            <h2 className="text-xl font-semibold leading-7 text-slate-950">
              {analysis.normalizedEvidence.area.title}
            </h2>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              {analysis.normalizedEvidence.area.subtitle}
            </p>
          </header>

          {true ? (
            <SourceBasedAnalysis
              analysis={analysis}
              highlightedSourceId={highlightedSourceId}
              highlightedTargetId={highlightedTargetId}
            />
          ) : null}
          {/*
          <section
            className="rounded-lg border border-[var(--forest-200)] bg-[var(--sage-50)] px-3 py-3 text-[var(--forest-950)]"
            id="card-basic"
          >
            <div className="mb-2 flex items-center gap-2">
              <Sparkles aria-hidden className="size-4 shrink-0 text-[var(--forest-700)]" />
              <h3 className="text-sm font-semibold">Tõlgenduse tuum</h3>
            </div>
            <p className="text-sm leading-6">
              {analysis.normalizedEvidence.interpretation.primaryTakeaway}
            </p>
          </section>

          <div className="grid gap-3">
            <InterpretationBlockCard
              block={analysis.normalizedEvidence.interpretation.activity}
              highlighted={highlightedTargetId === "card-attention"}
              icon={ShieldAlert}
              id="card-attention"
            />

            <InterpretationBlockCard
              block={analysis.normalizedEvidence.interpretation.standStructure}
              highlighted={highlightedTargetId === "card-registry"}
              icon={MapPinned}
              id="card-registry"
            />

            <InterpretationBlockCard
              block={analysis.normalizedEvidence.interpretation.nature}
              highlighted={
                highlightedTargetId === "card-protection" ||
                highlightedTargetId === "card-ecosystem"
              }
              icon={Layers}
              id="card-context"
            />

            <InterpretationBlockCard
              block={analysis.normalizedEvidence.interpretation.dataGaps}
              highlighted={highlightedTargetId === "card-cannot-claim"}
              icon={AlertTriangle}
              id="card-cannot-claim"
            />
          </div>

          <details className="group rounded-lg border border-slate-200 bg-white/82">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-slate-900">
              <span>
                Andmepaki seis: {analysis.normalizedEvidence.dataCompleteness.score}/100
              </span>
              <ChevronDown
                aria-hidden
                className="size-4 transition group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-slate-200 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {analysis.normalizedEvidence.dataCompleteness.score}/100 ·{" "}
                    {analysis.normalizedEvidence.dataCompleteness.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {analysis.normalizedEvidence.dataCompleteness.meaning}
                  </p>
                </div>
                <Database
                  aria-hidden
                  className="size-5 shrink-0 text-[var(--forest-700)]"
                />
              </div>
              <BulletList
                items={analysis.normalizedEvidence.dataCompleteness.reasons}
                markerClassName="bg-slate-500"
              />
            </div>
          </details>

          <details className="group rounded-lg border border-slate-200 bg-white/82">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-slate-900">
              <span>Kasutatud andmed ja ühendamata allikad</span>
              <ChevronDown
                aria-hidden
                className="size-4 transition group-open:rotate-180"
              />
            </summary>
            <div className="space-y-2 border-t border-slate-200 p-3">
              <p className="text-xs leading-5 text-slate-600">
                Üks rida allika kohta. Ühendamata allikat ei kasutata
                faktitõendina, aga link on alles, kui sellest võiks järgmises
                iteratsioonis kasu olla.
              </p>
              {analysis.normalizedEvidence.sourceStatus.map((source) => (
                <UsedDataRow
                  highlighted={highlightedSourceId === source.id}
                  key={source.id}
                  source={source}
                />
              ))}
            </div>
          </details>

          <Section title="Kaitsekattuvused">
            <ProtectionGroups
              groups={analysis.normalizedEvidence.protectionSummary}
            />
          </Section>

          <details className="group rounded-lg border border-slate-200 bg-white/82">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-slate-900">
              Metsaregistri detailid
              <ChevronDown
                aria-hidden
                className="size-4 transition group-open:rotate-180"
              />
            </summary>
            <div className="space-y-2 border-t border-slate-200 px-3 py-3" id="card-registry-detail">
              <FactRow
                label="Eraldised"
                value={`${analysis.normalizedEvidence.registrySummary.standsCount} tk`}
              />
              <FactRow
                label="Teatised"
                tooltip="Metsateatis on ametlik teade kavandatud raie või metsakahjustuse kohta; see ei tõenda üksinda, et töö on toimunud."
                value={`${analysis.normalizedEvidence.registrySummary.activeNoticesCount} aktiivset, ${analysis.normalizedEvidence.registrySummary.archivedNoticesCount} arhiveeritud`}
              />
              <FactRow
                label="Puuliigid"
                value={
                  analysis.normalizedEvidence.registrySummary.dominantSpecies.length
                    ? analysis.normalizedEvidence.registrySummary.dominantSpecies.join(", ")
                    : "andmetes ei leitud"
                }
              />
              <FactRow
                label="Arenguklass"
                value={
                  analysis.normalizedEvidence.registrySummary.developmentClasses.length
                    ? analysis.normalizedEvidence.registrySummary.developmentClasses.join(", ")
                    : "andmetes ei leitud"
                }
              />
              <FactRow
                label="Inventuur"
                value={analysis.normalizedEvidence.registrySummary.inventorySummary}
              />
              {analysis.normalizedEvidence.registrySummary.veryOldInventory ? (
                <p className="rounded-md bg-amber-50 px-2 py-2 text-xs font-medium leading-5 text-amber-900 ring-1 ring-amber-200">
                  Andmed võivad olla väga vanad. See mõjutab seda, kui julgelt
                  saab praegust metsaseisu kirjeldada.
                </p>
              ) : null}
            </div>
          </details>

          <Section title="Looduse hüved">
            <EcosystemDetails analysis={analysis} />
          </Section>

          {analysis.normalizedEvidence.timeline.length > 0 ? (
            <Section title="Ajajoon">
              <div className="space-y-2">
                {analysis.normalizedEvidence.timeline.map((item) => (
                  <div
                    className="rounded-lg border border-slate-200 bg-white/88 px-3 py-2 text-sm leading-5 text-slate-700"
                    key={item.id}
                  >
                    <div className="font-semibold text-slate-950">
                      {item.year ? `${item.year}: ` : ""}
                      {item.label}
                    </div>
                    <div>{item.detail}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          */}

          <TechnicalDetails analysis={analysis} />
        </div>
      ) : (
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--sage-100)] px-2.5 py-1 text-xs font-semibold text-[var(--forest-800)]">
            <Layers aria-hidden className="size-3.5" />
            Metsatarga tõlgenduskiht
          </div>
          <h2 className="text-lg font-semibold leading-6 text-slate-950">
            Klõpsa metsaalal.
          </h2>
          <p className="mt-2 text-sm leading-5 text-slate-600">
            Siia tekib inimkeelne vastus: mida ametlike andmete põhjal saab
            väita, millised tõendid seda toetavad ja mida ei tohi üle väita.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs leading-5 text-slate-600">
            <FileText aria-hidden className="mt-0.5 size-4 shrink-0" />
            Tehnilised allikad jäävad avatavatesse detailidesse; demo algab
            lihtsast vastusest.
          </div>
        </div>
      )}
    </aside>
  );
}
