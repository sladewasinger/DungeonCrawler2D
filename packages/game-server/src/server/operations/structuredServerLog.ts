import type {
  OperationalEventDropNotice,
  OperationalEventLogger,
  OperationalEventWriteFailure,
} from "./boundedOperationalEventSink.js";

export interface StructuredServerError {
  readonly level: "error";
  readonly eventType: "server_error";
  readonly source: string;
  readonly errorName: string;
  readonly message: string;
  readonly stack?: string;
}

/** JSON lines are intentionally easy to filter in CloudWatch Logs Insights. */
export class JsonOperationalLogger implements OperationalEventLogger {
  error(event: OperationalEventWriteFailure): void {
    console.error(JSON.stringify({ level: "error", ...event }));
  }

  warn(event: OperationalEventDropNotice): void {
    console.warn(JSON.stringify({ level: "warn", ...event }));
  }
}

export function logServerError(source: string, error: unknown): void {
  console.error(JSON.stringify(serverErrorRecord(source, error)));
}

export function serverErrorRecord(source: string, error: unknown): StructuredServerError {
  return {
    level: "error",
    eventType: "server_error",
    source: safeLogValue(source, 80),
    errorName: error instanceof Error ? safeLogValue(error.name, 80) : "unknown",
    message: error instanceof Error ? safeErrorMessage(error.message) : "non_error_rejection",
    ...(error instanceof Error && error.stack ? { stack: stackFrames(error.stack) } : {}),
  };
}

function safeErrorMessage(message: string): string {
  return resemblesSensitivePayload(message) ? "redacted_error_message" : safeLogValue(message, 512);
}

function resemblesSensitivePayload(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes("token") || normalized.includes("sessionkey") ||
    (normalized.includes("\"type\"") && normalized.includes("\"text\""));
}

function safeLogValue(value: string, maxLength: number): string {
  return value
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
    .replaceAll("\t", " ")
    .slice(0, maxLength);
}

function stackFrames(stack: string): string {
  return stack
    .split("\n")
    .slice(1, 13)
    .map((frame) => safeLogValue(frame, 256))
    .join("\n");
}
