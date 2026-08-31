export interface ScanResult {
  readonly redactedText: string;
  readonly foundSecretsCount: number;
  readonly secretTypes: string[];
}

export class SensitiveDataScanner {
  // Common sensitive patterns
  private static readonly PATTERNS: Array<{ type: string; regex: RegExp; replacement: string }> = [
    // JWT / Bearer tokens
    {
      type: "jwt_token",
      regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
      replacement: "[REDACTED_JWT]",
    },
    {
      type: "bearer_token",
      regex: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,
      replacement: "Bearer [REDACTED_TOKEN]",
    },
    // AWS Access Key ID
    {
      type: "aws_access_key",
      regex: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g,
      replacement: "[REDACTED_AWS_KEY]",
    },
    // Private RSA/OpenSSH Keys
    {
      type: "private_key",
      regex: /-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----[a-zA-Z0-9\s+/=]+-----END[ A-Z0-9_-]+PRIVATE KEY-----/g,
      replacement: "[REDACTED_PRIVATE_KEY]",
    },
    // Credit Card Numbers (13-19 digits with dashes/spaces)
    {
      type: "credit_card",
      regex: /\b(?:\d{4}[ -]?){3}\d{4}\b|\b\d{4}[ -]?\d{6}[ -]?\d{5}\b/g,
      replacement: "[REDACTED_CARD]",
    },
    // Password in JSON or key-value structures
    {
      type: "password_field",
      regex: /(["']?(?:password|passwd|secret|apiKey|api_key|access_token|auth_token|client_secret)["']?\s*[:=]\s*["'])([^"'\s]+)(["'])/gi,
      replacement: "$1[REDACTED_SECRET]$3",
    },
  ];

  static scanAndRedact(
    text: string,
    customRegexList?: string[] | undefined,
    defaultReplacement = "[REDACTED_DATA]",
  ): ScanResult {
    let result = text;
    let foundCount = 0;
    const detectedTypes = new Set<string>();

    for (const pattern of this.PATTERNS) {
      if (pattern.regex.test(result)) {
        detectedTypes.add(pattern.type);
        const matches = result.match(pattern.regex);
        if (matches) {
          foundCount += matches.length;
        }
        result = result.replace(pattern.regex, pattern.replacement);
      }
    }

    if (customRegexList && customRegexList.length > 0) {
      for (const customStr of customRegexList) {
        try {
          const customRegex = new RegExp(customStr, "g");
          if (customRegex.test(result)) {
            detectedTypes.add("custom_pattern");
            const matches = result.match(customRegex);
            if (matches) {
              foundCount += matches.length;
            }
            result = result.replace(customRegex, defaultReplacement);
          }
        } catch {
          // Ignore invalid custom regex
        }
      }
    }

    return {
      redactedText: result,
      foundSecretsCount: foundCount,
      secretTypes: Array.from(detectedTypes),
    };
  }

  static scanObject(
    obj: Record<string, unknown>,
    customRegexList?: string[] | undefined,
  ): { redactedObj: Record<string, unknown>; foundSecretsCount: number; secretTypes: string[] } {
    let totalFound = 0;
    const allTypes = new Set<string>();

    const traverseAndRedact = (val: unknown): unknown => {
      if (typeof val === "string") {
        const scan = this.scanAndRedact(val, customRegexList);
        totalFound += scan.foundSecretsCount;
        scan.secretTypes.forEach((t) => allTypes.add(t));
        return scan.redactedText;
      }
      if (Array.isArray(val)) {
        return val.map((item) => traverseAndRedact(item));
      }
      if (val !== null && typeof val === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          if (/(password|secret|token|apiKey|auth)/i.test(k) && typeof v === "string") {
            totalFound++;
            allTypes.add("sensitive_key");
            out[k] = "[REDACTED_FIELD]";
          } else {
            out[k] = traverseAndRedact(v);
          }
        }
        return out;
      }
      return val;
    };

    const redactedObj = traverseAndRedact(obj) as Record<string, unknown>;
    return {
      redactedObj,
      foundSecretsCount: totalFound,
      secretTypes: Array.from(allTypes),
    };
  }
}
