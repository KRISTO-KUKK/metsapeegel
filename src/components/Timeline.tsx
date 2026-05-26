import clsx from "clsx";
import type { TimelineEvent } from "@/lib/types/forestry";

const dotClass = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500"
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li className="flex gap-3" key={event.id}>
          <div className="flex flex-col items-center">
            <span
              className={clsx("mt-1 size-2.5 rounded-full", dotClass[event.tone])}
            />
            <span className="mt-1 h-full w-px bg-slate-200" />
          </div>
          <div className="min-w-0 pb-1">
            <div className="text-sm font-semibold text-slate-900">
              {event.year ? `${event.year} · ` : ""}
              {event.label}
            </div>
            <p className="mt-0.5 text-sm leading-5 text-slate-600">
              {event.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
