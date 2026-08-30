const DEFAULT_SENSITIVE_KEYS = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "api_key",
  "api-key",
  "authorization",
  "auth",
  "bearer",
  "cookie",
  "session",
  "privatekey",
  "private_key",
  "creditcard",
  "credit_card",
  "cardnumber",
  "card_number",
  "cvv",
  "cvc",
  "ssn",
  "pin",
]);

const MASK = "[REDACTED]";

const JWT_PATTERN = /eyJ[a-zA-Z0-9-_]+\.eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/g;
const BEARER_PATTERN = /bearer\s+[a-zA-Z0-9._~+/-]+=*/gi;
const CREDIT_CARD_PATTERN = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;

export class Redactor {
  private readonly sensitiveKeys: Set<string>;
  private readonly customPatterns: RegExp[];

  constructor(customKeys?: string[], customPatterns?: RegExp[]) {
    this.sensitiveKeys = new Set([
      ...DEFAULT_SENSITIVE_KEYS,
      ...(customKeys ?? []).map((k) => k.toLowerCase()),
    ]);
    this.customPatterns = customPatterns ?? [];
  }

  redactString(val: string): string {
    if (!val || typeof val !== "string") return val;

    let result = val
      .replace(JWT_PATTERN, "[REDACTED_JWT]")
      .replace(BEARER_PATTERN, "Bearer [REDACTED]")
      .replace(CREDIT_CARD_PATTERN, "[REDACTED_CARD]");

    for (const pattern of this.customPatterns) {
      result = result.replace(pattern, MASK);
    }

    return result;
  }

  redactObject<T>(input: T, seen = new WeakSet<object>()): T {
    if (input === null || typeof input !== "object") {
      if (typeof input === "string") {
        return this.redactString(input) as unknown as T;
      }
      return input;
    }

    if (input instanceof Date || input instanceof RegExp) {
      return input;
    }

    if (input instanceof Error) {
      return {
        name: input.name,
        message: this.redactString(input.message),
        stack: input.stack ? this.redactString(input.stack) : undefined,
      } as unknown as T;
    }

    if (seen.has(input)) {
      return "[CIRCULAR]" as unknown as T;
    }

    seen.add(input);

    if (Array.isArray(input)) {
      return input.map((item) => this.redactObject(item, seen)) as unknown as T;
    }

    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
      let isSensitive = false;

      for (const sensitive of this.sensitiveKeys) {
        if (normalizedKey.includes(sensitive.replace(/[-_]/g, ""))) {
          isSensitive = true;
          break;
        }
      }

      if (isSensitive) {
        output[key] = MASK;
      } else {
        output[key] = this.redactObject(value, seen);
      }
    }

    return output as T;
  }
}
