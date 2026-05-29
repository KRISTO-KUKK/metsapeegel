import {
  FileText,
  Leaf,
  RadioTower,
  Satellite,
  ShieldCheck,
  Trees
} from "lucide-react";
import clsx from "clsx";
import type { EvidenceItem, EvidenceKind } from "@/lib/types/forestry";

const iconByKind: Record<EvidenceKind, typeof Trees> = {
  cadastre: Trees,
  ecosystem: Leaf,
  registry: FileText,
  remote_sensing: RadioTower,
  protection: ShieldCheck,
  satellite: Satellite
};

const toneClass = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-800",
  info: "border-sky-200 bg-sky-50 text-sky-800"
};

export function EvidenceList({ evidence }: { evidence: EvidenceItem[] }) {
  return (
    <div className="space-y-2">
      {evidence.map((item) => {
        const Icon = iconByKind[item.kind];

        return (
          <article
            className={clsx(
              "rounded-lg border p-3",
              toneClass[item.tone]
            )}
            key={item.id}
          >
            <div className="flex items-start gap-3">
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold">{item.title}</h4>
                  {item.year ? (
                    <span className="text-xs opacity-75">{item.year}</span>
                  ) : null}
                  {item.confidence ? (
                    <span className="text-xs opacity-75">
                      kindlus {Math.round(item.confidence * 100)}%
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-5 opacity-90">
                  {item.description}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
