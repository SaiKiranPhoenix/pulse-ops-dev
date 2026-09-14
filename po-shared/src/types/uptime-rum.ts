export type UptimeCheckStatus = "up" | "down" | "degraded" | "paused";
export type HttpMethod = "GET" | "POST" | "HEAD" | "PUT" | "PATCH" | "DELETE";

export type AssertionType = "status_code" | "response_time" | "body_contains" | "header_matches";
export type AssertionOperator = "equals" | "less_than" | "greater_than" | "contains" | "regex";

export interface SyntheticAssertion {
  readonly type: AssertionType;
  readonly target: string;
  readonly operator: AssertionOperator;
  readonly expectedValue: string | number;
}

export interface UptimeCheck {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly url: string;
  readonly method: HttpMethod;
  readonly headers?: Record<string, string> | undefined;
  readonly body?: string | undefined;
  readonly intervalSeconds: number;
  readonly timeoutMs: number;
  readonly expectedStatusCode: number;
  readonly syntheticAssertions?: SyntheticAssertion[] | undefined;
  readonly status: UptimeCheckStatus;
  readonly uptimePercent24h: number;
  readonly avgResponseTimeMs: number;
  readonly lastCheckedAt?: string | undefined;
  readonly consecutiveFailures: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AssertionEvaluationResult {
  readonly name: string;
  readonly passed: boolean;
  readonly message?: string | undefined;
}

export interface UptimeCheckResult {
  readonly id: string;
  readonly checkId: string;
  readonly timestamp: string;
  readonly status: "up" | "down" | "degraded";
  readonly statusCode?: number | undefined;
  readonly responseTimeMs: number;
  readonly assertionResults: AssertionEvaluationResult[];
  readonly error?: string | undefined;
}

export interface RumEvent {
  readonly id: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly pageUrl: string;
  readonly pageTitle?: string | undefined;
  readonly lcpMs?: number | undefined;
  readonly fidMs?: number | undefined;
  readonly cls?: number | undefined;
  readonly fcpMs?: number | undefined;
  readonly ttfbMs?: number | undefined;
  readonly device: "desktop" | "mobile" | "tablet";
  readonly browser: string;
  readonly os: string;
  readonly country?: string | undefined;
  readonly timestamp: string;
}

export type WebVitalGrade = "good" | "needs_improvement" | "poor";

export interface RumOverview {
  readonly totalPageViews: number;
  readonly avgLcpMs: number;
  readonly avgFidMs: number;
  readonly avgCls: number;
  readonly avgTtfbMs: number;
  readonly lcpGrade: WebVitalGrade;
  readonly fidGrade: WebVitalGrade;
  readonly clsGrade: WebVitalGrade;
  readonly browserBreakdown: Array<{
    readonly browser: string;
    readonly count: number;
    readonly percentage: number;
  }>;
  readonly deviceBreakdown: Array<{
    readonly device: string;
    readonly count: number;
    readonly percentage: number;
  }>;
}

export interface CreateUptimeCheckInput {
  readonly name: string;
  readonly url: string;
  readonly method?: HttpMethod | undefined;
  readonly headers?: Record<string, string> | undefined;
  readonly body?: string | undefined;
  readonly intervalSeconds?: number | undefined;
  readonly timeoutMs?: number | undefined;
  readonly expectedStatusCode?: number | undefined;
  readonly syntheticAssertions?: SyntheticAssertion[] | undefined;
}

export interface UpdateUptimeCheckInput {
  readonly name?: string | undefined;
  readonly url?: string | undefined;
  readonly method?: HttpMethod | undefined;
  readonly headers?: Record<string, string> | undefined;
  readonly body?: string | undefined;
  readonly intervalSeconds?: number | undefined;
  readonly timeoutMs?: number | undefined;
  readonly expectedStatusCode?: number | undefined;
  readonly syntheticAssertions?: SyntheticAssertion[] | undefined;
  readonly status?: UptimeCheckStatus | undefined;
}
