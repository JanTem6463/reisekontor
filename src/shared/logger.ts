import pino, { type Logger } from "pino";

export function createLogger(opts?: { level?: string; pretty?: boolean }): Logger {
  const isPretty = opts?.pretty ?? process.env.NODE_ENV !== "production";
  return pino({
    level: opts?.level ?? process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: [
        "password",
        "passwordHash",
        "cookie",
        "headers.cookie",
        "headers.authorization",
        "*.password",
        "*.passwordHash",
      ],
      remove: true,
    },
    ...(isPretty
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "HH:MM:ss" },
          },
        }
      : {}),
  });
}

export const logger = createLogger();
