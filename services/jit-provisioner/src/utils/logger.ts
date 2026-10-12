/**
 * Structured enterprise JSON logger
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  private minLevel: number;

  constructor(level: string = "info") {
    const normalized = (level.toLowerCase() as LogLevel) || "info";
    this.minLevel = LEVEL_SEVERITY[normalized] ?? LEVEL_SEVERITY.info;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_SEVERITY[level] < this.minLevel) return;

    const payload = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service: "llumen-jit-provisioner",
      message,
      ...(context ? { context } : {}),
    };

    const serialized = JSON.stringify(payload);
    if (level === "error") {
      console.error(serialized);
    } else if (level === "warn") {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }
}
