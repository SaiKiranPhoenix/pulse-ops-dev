const defaultSensitiveKeyPatterns = [
  /authorization/i,
  /cookie/i,
  /password/i,
  /passwd/i,
  /\bpwd\b/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /private[-_]?key/i,
  /jwt/i,
  /database[-_]?url/i,
  /mongodb[-_]?uri/i,
  /redis[-_]?url/i,
  /rabbitmq[-_]?url/i,
];

const defaultSensitiveValuePatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/g,
  /AKIA[0-9A-Z]{16}/g,
  /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  /sk_live_[A-Za-z0-9]{24,}/g,
  /po_(?:live|test)_[A-Za-z0-9_=-]{12,}/g,
  /povt_[A-Za-z0-9_=-]{12,}/g,
  /xox[baprs]-[A-Za-z0-9-]{20,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b(?:mongodb|postgres|mysql|redis|amqp):\/\/[^/\s:@]+:[^@\s]+@/gi,
];

export const redactedValue = "[REDACTED]";

export type RedactionOptions = {
  readonly maxDepth?: number;
};

export function isSensitiveKey(key: string): boolean {
  return defaultSensitiveKeyPatterns.some((pattern) => pattern.test(key));
}

export function redactString(value: string): string {
  return defaultSensitiveValuePatterns.reduce(
    (nextValue, pattern) => nextValue.replace(pattern, redactedValue),
    value,
  );
}

export function redact<TValue>(value: TValue, options: RedactionOptions = {}): TValue {
  return redactValue(value, options.maxDepth ?? 8, new WeakSet()) as TValue;
}

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth < 0) {
    return "[MaxDepth]";
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth - 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key) ? redactedValue : redactValue(nestedValue, depth - 1, seen),
    ]),
  );
}
