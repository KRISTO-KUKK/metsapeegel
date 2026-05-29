"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Loader2,
  Send,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import type {
  AnalysisResult,
  AreaQuestionAnswer,
  NormalizedEvidenceItem,
  SourceStatus
} from "@/lib/types/forestry";

type AskResponse = {
  answer: AreaQuestionAnswer;
};

type ChatTurn = {
  id: string;
  question: string;
  answer?: AreaQuestionAnswer;
  status: "pending" | "done" | "error";
  error?: string;
};

const statusLabel: Record<SourceStatus, string> = {
  loaded: "laetud",
  missing: "andmed puuduvad",
  error: "viga",
  not_public: "mitteavalik",
  not_connected: "ühendamata"
};

const sourceShortLabels: Record<string, string> = {
  "maaamet-etak-forest": "ETAK",
  "maaamet-cadastre": "Kataster",
  metsaregister: "Metsaregister",
  eelis: "EELIS",
  elme: "ELME",
  "forest-changes": "Metsamuutused/LiDAR",
  kaia: "KAIA",
  "smi-kese": "SMI/KESE"
};

const suggestionChips = [
  "Naita kaitsekattuvuseta alasid",
  "Naita kaitsekattuvusega alasid",
  "Naita 2024 inventuuriga alasid",
  "Naita riigiomandis alasid",
  "Naita metsateatisega alasid",
  "Naita puidutooraine kattuvusega alasid",
  "Võta kokku, mis siin tõenäoliselt toimunud on",
  "Palju on puidutooraine kattuvusi?",
  "Kas siin on raie kohta tõendeid?",
  "Kas see ala on kaitse all?",
  "Mis andmed on puudu?",
  "Selgita seda ilma metsandusterminiteta"
];

function evidenceChipLabel(item: NormalizedEvidenceItem) {
  const source = sourceShortLabels[item.sourceId] ?? item.sourceId;
  if (item.status !== "loaded") {
    return `${source}: ${statusLabel[item.status]}`;
  }
  if (item.id === "registry-active-notices") {
    const count = item.summary.match(/\d+/)?.[0] ?? "0";
    return `${source}: ${count} aktiivset teatist`;
  }
  if (item.id === "registry-archived-notices") {
    const count = item.summary.match(/\d+/)?.[0] ?? "0";
    return `${source}: ${count} arhiveeritud teatist`;
  }
  if (item.id === "protection-summary") {
    const count = item.summary.match(/\d+/)?.[0];
    return count ? `${source}: ${count} kattuvust` : `${source}: kattuvused`;
  }
  if (item.id === "elme-context") {
    const woodCount = item.summary.match(/Puidutooraine kattuvusi:\s*(\d+)/)?.[1];
    return woodCount ? `${source}: ${woodCount} puidutooraine` : `${source}: looduse hüved`;
  }
  return `${source}: ${item.label}`;
}

function EvidenceChips({
  answer,
  analysis
}: {
  answer: AreaQuestionAnswer;
  analysis: AnalysisResult;
}) {
  const evidenceById = new Map(
    analysis.normalizedEvidence.evidenceItems.map((item) => [item.id, item])
  );
  const evidence = answer.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is NormalizedEvidenceItem => Boolean(item));

  function selectEvidence(item: NormalizedEvidenceItem) {
    window.dispatchEvent(
      new CustomEvent("metsapeegel:evidence-link", {
        detail: {
          evidenceId: item.id,
          sourceId: item.sourceId,
          targetId: item.targetId
        }
      })
    );
    window.dispatchEvent(
      new CustomEvent("metsapeegel:evidence-source", {
        detail: { sourceId: item.sourceId }
      })
    );
  }

  if (evidence.length === 0) {
    return (
      <div className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
        Tõendiviidet ei ole selle vastuse jaoks andmepakis.
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {evidence.slice(0, 6).map((item) => (
        <button
          className={clsx(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition hover:bg-white",
            item.tone === "limit"
              ? "bg-rose-50 text-rose-800 ring-rose-200"
              : item.tone === "attention"
                ? "bg-amber-50 text-amber-900 ring-amber-200"
                : item.tone === "positive"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : "bg-slate-50 text-slate-700 ring-slate-200"
          )}
          key={item.id}
          onClick={() => selectEvidence(item)}
          title={item.summary}
          type="button"
        >
          {evidenceChipLabel(item)}
        </button>
      ))}
    </div>
  );
}

function AnswerMessage({
  question,
  answer,
  error,
  analysis
}: {
  question: string;
  answer?: AreaQuestionAnswer;
  error?: string;
  analysis: AnalysisResult;
}) {
  if (!answer) {
    return (
      <article className="space-y-2">
        <div className="ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-[var(--forest-700)] px-3 py-2 text-sm leading-5 text-white shadow-sm">
          {question}
        </div>
        <div
          className={clsx(
            "mr-auto inline-flex items-center gap-2 rounded-2xl rounded-bl-md px-3 py-2 text-sm shadow-sm ring-1",
            error
              ? "bg-red-50 text-red-800 ring-red-200"
              : "bg-white text-slate-600 ring-slate-200"
          )}
        >
          {error ? (
            <AlertTriangle aria-hidden className="size-4" />
          ) : (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          )}
          {error ?? "Mõtlen andmepaki põhjal..."}
        </div>
      </article>
    );
  }

  const isRealAi = answer.mode === "openai";
  const showStructuredDetails = !isRealAi || answer.status === "fallback";

  return (
    <article className="space-y-2">
      <div className="ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-[var(--forest-700)] px-3 py-2 text-sm leading-5 text-white shadow-sm">
        {question}
      </div>

      <div className="mr-auto max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3 py-3 text-sm leading-5 text-slate-800 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--forest-800)]">
            <Bot aria-hidden className="size-3.5" />
            {isRealAi ? "Metsatark AI" : "Metsatark"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            ainult andmepakk
          </span>
        </div>

        <p className="whitespace-pre-line text-slate-900">{answer.shortAnswer}</p>
        {answer.explanation ? (
          <p className="mt-1 whitespace-pre-line text-slate-700">
            {answer.explanation}
          </p>
        ) : null}

        {showStructuredDetails && answer.canSay.length > 0 ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
            <ul className="space-y-1 text-xs leading-5 text-slate-700">
              {answer.canSay.slice(0, 4).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {showStructuredDetails && answer.cannotSay.length > 0 ? (
          <div className="mt-2 rounded-xl bg-amber-50/70 px-3 py-2 ring-1 ring-amber-100">
            <ul className="space-y-1 text-xs leading-5 text-amber-950">
              {answer.cannotSay.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <EvidenceChips analysis={analysis} answer={answer} />

        {answer.note ? (
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            {answer.note}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function AssistantPanel({
  analysis,
  isLoading
}: {
  analysis: AnalysisResult | null;
  isLoading: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaNotice, setAreaNotice] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTurns([]);
    setQuestion("");
    setError(null);
    setAreaNotice(
      analysis ? "Vestlus kasutab nüüd uut valitud metsaala." : null
    );
  }, [analysis?.area.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      block: "end",
      behavior: "smooth"
    });
  }, [turns.length, areaNotice, isLoading, isAsking]);

  const title = useMemo(() => {
    if (!analysis) return "Metsatark AI";
    return analysis.normalizedEvidence.area.title;
  }, [analysis]);

  async function ask(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || !analysis || isAsking) return;

    const turnId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const history = turns
      .filter((turn) => turn.answer)
      .slice(-8)
      .map((turn) => ({
        question: turn.question,
        answer: `${turn.answer?.shortAnswer ?? ""}\n${turn.answer?.explanation ?? ""}`
      }));

    setTurns((current) => [
      ...current,
      { id: turnId, question: trimmed, status: "pending" }
    ]);
    setQuestion("");
    setAreaNotice(null);
    setIsAsking(true);
    setError(null);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          analysis,
          question: trimmed,
          history
        })
      });

      if (!response.ok) {
        throw new Error("Vastuse koostamine ebaõnnestus.");
      }

      const payload = (await response.json()) as AskResponse;
      if (payload.answer.mapAction) {
        window.dispatchEvent(
          new CustomEvent("metsapeegel:area-query", {
            detail: payload.answer.mapAction
          })
        );
      }
      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId
            ? { ...turn, answer: payload.answer, status: "done" }
            : turn
        )
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Vastuse koostamine ebaõnnestus.";
      setError(message);
      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId ? { ...turn, status: "error", error: message } : turn
        )
      );
    } finally {
      setIsAsking(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(question);
    }
  }

  return (
    <aside className="fixed left-3 right-3 top-40 z-20 flex max-h-[27dvh] flex-col overflow-hidden rounded-lg glass-panel shadow-panel sm:bottom-5 sm:left-5 sm:right-auto sm:top-24 sm:z-10 sm:max-h-none sm:w-[420px]">
      <div className="shrink-0 border-b border-white/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot aria-hidden className="size-4 text-[var(--forest-700)]" />
          <h2 className="min-w-0 truncate text-sm font-semibold text-slate-950">
            {title}
          </h2>
          {analysis ? (
            <span className="ml-auto rounded-full bg-white px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">
              ainult valitud andmed
            </span>
          ) : null}
          <button
            aria-label="Puhasta vestlus"
            className="grid size-7 shrink-0 place-items-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={turns.length === 0 && !areaNotice}
            onClick={() => {
              setTurns([]);
              setAreaNotice(null);
            }}
            title="Puhasta vestlus"
            type="button"
          >
            <Trash2 aria-hidden className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {!analysis ? (
          <div className="rounded-2xl bg-white px-3 py-3 text-sm leading-5 text-slate-600 shadow-sm ring-1 ring-slate-200">
            Vali kaardilt metsaala. Siis saad küsida ainult selle ala ametlike
            andmete põhjal.
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Laen valitud ala andmeid...
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-3 text-sm leading-5 text-red-800 ring-1 ring-red-200">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {areaNotice ? (
          <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-medium leading-5 text-emerald-900 ring-1 ring-emerald-100">
            {areaNotice}
          </div>
        ) : null}

        {turns.map((turn) =>
          analysis ? (
            <AnswerMessage
              analysis={analysis}
              answer={turn.answer}
              error={turn.error}
              key={turn.id}
              question={turn.question}
            />
          ) : null
        )}

        {analysis && turns.length === 0 && !isLoading ? (
          <div className="rounded-2xl bg-white px-3 py-3 text-sm leading-5 text-slate-700 shadow-sm ring-1 ring-slate-200">
            Küsi näiteks, kas raie kohta on tõendeid või milliseid järeldusi ei
            tohiks selle andmepaki põhjal teha.
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-white/70 bg-white/72 px-3 py-3 backdrop-blur">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {suggestionChips.map((item) => (
            <button
              className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-[var(--sage-50)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!analysis || isAsking}
              key={item}
              onClick={() => void ask(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <form className="flex items-end gap-2" onSubmit={submit}>
          <textarea
            className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm leading-5 text-slate-950 outline-none placeholder:text-slate-500 focus:border-[var(--forest-600)]"
            disabled={!analysis || isAsking}
            maxLength={900}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder="Küsi valitud ala kohta..."
            rows={2}
            value={question}
          />
          <button
            aria-label="Saada küsimus"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--forest-700)] text-white shadow-sm hover:bg-[var(--forest-800)] disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!analysis || !question.trim() || isAsking}
            type="submit"
          >
            {isAsking ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Send aria-hidden className="size-4" />
            )}
          </button>
        </form>
      </div>
    </aside>
  );
}
