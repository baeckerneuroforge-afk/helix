// Structured logging — one JSON object per line, with secret masking.
//
// Rules:
//   - NEVER log contents (documents, questions, answers) — only ids, counts,
//     actions. The audit_log is the business trail; this is the OPS trail.
//   - Secrets are masked defensively: values of keys that look secret-ish
//     (token/secret/key/password/authorization) and values that MATCH known
//     secret shapes (Slack xox…, Svix whsec_…) are replaced with '[redacted]'.
//   - setErrorReporter() is the attachment point for an error tracker
//     (Sentry & Co.): logError() forwards there after logging. Default: none.

type LogFields = Record<string, unknown>;

const SECRETISH_KEY = /(token|secret|key|password|authorization|cookie)/i;
const SECRETISH_VALUE = /^(xox[a-z]-|whsec_|sk_live_|sk_test_|Bearer\s)/i;

export function maskSecrets(value: unknown, keyHint = ''): unknown {
  if (typeof value === 'string') {
    if (SECRETISH_KEY.test(keyHint) || SECRETISH_VALUE.test(value)) return '[redacted]';
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => maskSecrets(v));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, maskSecrets(v, k)]),
    );
  }
  return value;
}

function emit(level: 'info' | 'warn' | 'error', msg: string, fields: LogFields): void {
  const line = JSON.stringify({
    level,
    msg,
    time: new Date().toISOString(),
    ...(maskSecrets(fields) as LogFields),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function logInfo(msg: string, fields: LogFields = {}): void {
  emit('info', msg, fields);
}

export function logWarn(msg: string, fields: LogFields = {}): void {
  emit('warn', msg, fields);
}

export type ErrorReporter = (err: unknown, context: LogFields) => void;

let reporter: ErrorReporter | null = null;

/** Attach an error tracker (e.g. Sentry.captureException). Wire it once at
 * startup (src/instrumentation.ts is the natural place). Pass null to detach. */
export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}

export function logError(msg: string, err: unknown, fields: LogFields = {}): void {
  emit('error', msg, {
    ...fields,
    error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
  });
  try {
    reporter?.(err, fields);
  } catch {
    // A broken reporter must never break the caller.
  }
}
