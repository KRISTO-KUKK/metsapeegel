import { AsyncLocalStorage } from "async_hooks";
import type { SourceDiagnostic } from "@/lib/types/forestry";
import { appLogger } from "@/lib/logging/appLogger";

const diagnosticsStorage = new AsyncLocalStorage<SourceDiagnostic[]>();

export function withSourceDiagnostics<T>(callback: () => Promise<T>) {
  return diagnosticsStorage.run([], callback);
}

export function currentSourceDiagnostics() {
  return diagnosticsStorage.getStore() ?? [];
}

export function recordSourceDiagnostic(diagnostic: SourceDiagnostic) {
  const store = diagnosticsStorage.getStore();
  if (store) {
    store.push(diagnostic);
  }

  appLogger.info("source_diagnostic", diagnostic);
}

export async function traceSource<T>({
  sourceId,
  sourceName,
  operation,
  url,
  cadastralId,
  cache,
  run,
  summarize
}: {
  sourceId: string;
  sourceName: string;
  operation: string;
  url?: string;
  cadastralId?: string;
  cache?: SourceDiagnostic["cache"];
  run: () => Promise<T>;
  summarize?: (value: T) => Partial<SourceDiagnostic>;
}): Promise<T> {
  const startedAt = new Date();

  try {
    const value = await run();
    const finishedAt = new Date();
    const summary = summarize?.(value) ?? {};
    recordSourceDiagnostic({
      sourceId,
      sourceName,
      operation,
      status: "loaded",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      url,
      cadastralId,
      cache,
      ...summary
    });
    return value;
  } catch (cause) {
    const finishedAt = new Date();
    recordSourceDiagnostic({
      sourceId,
      sourceName,
      operation,
      status: cause instanceof DOMException && cause.name === "AbortError"
        ? "timeout"
        : "error",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      url,
      cadastralId,
      cache,
      upstreamStatus:
        typeof cause === "object" &&
        cause !== null &&
        "upstreamStatus" in cause &&
        typeof cause.upstreamStatus === "number"
          ? cause.upstreamStatus
          : undefined,
      message: cause instanceof Error ? cause.message : String(cause)
    });
    throw cause;
  }
}
