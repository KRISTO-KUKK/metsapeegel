import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";

type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

const logFile = process.env.METSAPEEGEL_LOG_FILE;

function writeLog(level: LogLevel, event: string, payload: LogPayload = {}) {
  const row = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...payload
  });

  if (logFile) {
    try {
      mkdirSync(dirname(logFile), { recursive: true });
      appendFileSync(logFile, `${row}\n`, "utf8");
      return;
    } catch (cause) {
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "error",
          event: "app_log_write_failed",
          message: cause instanceof Error ? cause.message : String(cause)
        })
      );
    }
  }

  if (level === "error") {
    console.error(row);
    return;
  }

  if (level === "warn") {
    console.warn(row);
    return;
  }

  console.log(row);
}

export const appLogger = {
  info(event: string, payload?: LogPayload) {
    writeLog("info", event, payload);
  },
  warn(event: string, payload?: LogPayload) {
    writeLog("warn", event, payload);
  },
  error(event: string, payload?: LogPayload) {
    writeLog("error", event, payload);
  }
};
