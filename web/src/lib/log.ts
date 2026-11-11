import { AsyncLocalStorage } from 'node:async_hooks';
import pino, { type Logger } from 'pino';
import pretty from 'pino-pretty';
import { uuidv7 } from './uuid7';

export type { Logger } from 'pino';

/** Never let credentials or tokens reach a log line, whatever object gets logged. */
const REDACT = [
  'password',
  'passwordConfirm',
  'token',
  'turnstile',
  '*.password',
  '*.passwordConfirm',
  '*.token',
  '*.turnstile',
  'headers.cookie',
  'headers.authorization',
  'req.headers.cookie',
  'req.headers.authorization',
];

function settings(): { level: string; pretty: boolean } {
  // Read straight from the environment: logging must work even when configuration itself is invalid.
  const test = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
  return {
    level: process.env.LOG_LEVEL || (test ? 'silent' : 'info'),
    pretty:
      process.env.LOG_PRETTY === 'true' ||
      (!test && process.env.NODE_ENV !== 'production' && process.env.LOG_PRETTY !== 'false'),
  };
}

let root: Logger | undefined;

/** Builds a logger. `destination` lets tests capture the JSON lines. */
export function buildLogger(destination?: { write(chunk: string): void }): Logger {
  const { level, pretty: usePretty } = settings();
  const options = {
    level,
    base: { service: 'web' },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: { err: pino.stdSerializers.err },
    redact: { paths: REDACT, censor: '[redacted]' },
  };
  if (destination) return pino({ ...options, level: 'trace' }, destination);
  return usePretty
    ? pino(
        options,
        pretty({
          colorize: true, // docker logs are not a TTY; keep the colours anyway
          sync: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname,service,traceId',
          messageFormat: '{if traceId}\u001b[90m{traceId}\u001b[39m {end}{msg}',
        }),
      )
    : pino(options);
}

/** The process-wide logger: coloured pino-pretty in dev, JSON lines in production. */
export function rootLogger(): Logger {
  root ??= buildLogger();
  return root;
}

export interface RequestContext {
  traceId: string;
  log: Logger;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithContext = <T>(ctx: RequestContext, fn: () => T): T => storage.run(ctx, fn);

/** Trace id of the request being handled (a fresh one outside any request, e.g. scripts). */
export const currentTraceId = (): string => storage.getStore()?.traceId ?? uuidv7();

/** Logger bound to the current request's traceId; the root logger outside a request. */
export const getLog = (): Logger => storage.getStore()?.log ?? rootLogger();

/** "alice@example.com" → "a***@example.com": enough to recognise in logs, not enough to harvest. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}
