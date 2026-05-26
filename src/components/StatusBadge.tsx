import clsx from "clsx";
import type { AnalysisStatus } from "@/lib/types/forestry";

const statusContent: Record<
  AnalysisStatus,
  { label: string; className: string }
> = {
  documented_harvest: {
    label: "Andmed klapivad",
    className: "bg-emerald-100 text-emerald-800 ring-emerald-200"
  },
  unexplained_change: {
    label: "Selgitamist vajav",
    className: "bg-amber-100 text-amber-900 ring-amber-200"
  },
  planned_activity: {
    label: "Planeeritud tegevus",
    className: "bg-sky-100 text-sky-800 ring-sky-200"
  },
  outdated_data: {
    label: "Aegunud andmed",
    className: "bg-amber-100 text-amber-900 ring-amber-200"
  },
  protected_context: {
    label: "Kaitsekontekst",
    className: "bg-blue-100 text-blue-800 ring-blue-200"
  },
  no_major_change: {
    label: "Suur muutus puudub",
    className: "bg-emerald-100 text-emerald-800 ring-emerald-200"
  },
  insufficient_data: {
    label: "Andmeid napib",
    className: "bg-slate-100 text-slate-700 ring-slate-200"
  }
};

export function StatusBadge({ status }: { status: AnalysisStatus }) {
  const content = statusContent[status];

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        content.className
      )}
    >
      {content.label}
    </span>
  );
}
