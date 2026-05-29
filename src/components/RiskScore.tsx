import clsx from "clsx";
import type { PublicRiskLevel } from "@/lib/types/forestry";

const riskTone: Record<
  PublicRiskLevel,
  {
    label: string;
    ring: string;
    text: string;
    fill: string;
  }
> = {
  low: {
    label: "Madal risk",
    ring: "ring-emerald-200",
    text: "text-emerald-700",
    fill: "var(--forest-600)"
  },
  medium: {
    label: "Vajab selgitust",
    ring: "ring-amber-200",
    text: "text-amber-700",
    fill: "var(--amber)"
  },
  high: {
    label: "Tundlik kooslus",
    ring: "ring-red-200",
    text: "text-red-700",
    fill: "var(--warning)"
  }
};

export function RiskScore({
  score,
  level
}: {
  score: number;
  level: PublicRiskLevel;
}) {
  const tone = riskTone[level];

  return (
    <div className="flex items-center gap-4">
      <div
        aria-label={`Avaliku vaate risk ${score} sajast`}
        className={clsx("grid size-24 place-items-center rounded-full ring-1", tone.ring)}
        style={{
          background: `conic-gradient(${tone.fill} ${score * 3.6}deg, #e2e8f0 0deg)`
        }}
      >
        <div className="grid size-20 place-items-center rounded-full bg-white">
          <div className={clsx("text-2xl font-semibold", tone.text)}>
            {score}
          </div>
          <div className="-mt-3 text-xs text-slate-500">/100</div>
        </div>
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-950">{tone.label}</h3>
        <p className="mt-1 text-sm leading-5 text-slate-600">
          See hindab, kui kergesti võib avalik kasutaja andmeid valesti tõlgendada
          või liiga konkreetse järelduse teha.
        </p>
      </div>
    </div>
  );
}
