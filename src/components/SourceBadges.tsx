import { Database } from "lucide-react";
import type { DataSourceRef } from "@/lib/types/forestry";

export function SourceBadges({ sources }: { sources: DataSourceRef[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
          key={source.id}
          title={source.detail}
        >
          <Database aria-hidden className="size-3" />
          {source.name}
        </span>
      ))}
    </div>
  );
}
