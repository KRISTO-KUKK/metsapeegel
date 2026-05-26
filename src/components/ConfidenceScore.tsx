import clsx from "clsx";

function scoreTone(score: number) {
  if (score >= 75) return "text-emerald-700";
  if (score >= 50) return "text-amber-700";
  return "text-red-700";
}

export function ConfidenceScore({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid size-24 place-items-center rounded-full"
        style={{
          background: `conic-gradient(var(--forest-600) ${score * 3.6}deg, #e2e8f0 0deg)`
        }}
        aria-label={`Usaldusskoor ${score} sajast`}
      >
        <div className="grid size-20 place-items-center rounded-full bg-white">
          <div className={clsx("text-2xl font-semibold", scoreTone(score))}>
            {score}
          </div>
          <div className="-mt-3 text-xs text-slate-500">/100</div>
        </div>
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-950">Usaldusskoor</h3>
        <p className="mt-1 text-sm leading-5 text-slate-600">
          See on Metsapeegli arvutuslik usaldusskoor, mitte ametlik otsus.
        </p>
      </div>
    </div>
  );
}
