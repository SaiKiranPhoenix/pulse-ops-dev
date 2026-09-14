export type SliType = "availability" | "latency" | "error_rate" | "custom_metric";

export type SloWindow = "7d" | "30d" | "90d" | "calendar_month";

export type SloStatus = "compliant" | "at_risk" | "breached";

export interface SliDefinition {
  readonly type: SliType;
  readonly serviceName?: string | undefined;
  readonly environment?: string | undefined;
  readonly thresholdMs?: number | undefined;
  readonly metricName?: string | undefined;
  readonly goodEventFilter?: string | undefined;
  readonly totalEventFilter?: string | undefined;
}

export interface SloTarget {
  readonly targetPercent: number;
  readonly warningPercent?: number | undefined;
  readonly rollingWindowDays: number;
}

export interface SloCalculation {
  readonly currentSliPercent: number;
  readonly errorBudgetTotalPercent: number;
  readonly errorBudgetRemainingPercent: number;
  readonly errorBudgetConsumedPercent: number;
  readonly burnRate1h: number;
  readonly burnRate6h: number;
  readonly burnRate24h: number;
  readonly estimatedHoursToDepletion: number | null;
  readonly status: SloStatus;
  readonly totalEventsCount: number;
  readonly goodEventsCount: number;
  readonly badEventsCount: number;
  readonly evaluatedAt: string;
}

export interface SloHistoryPoint {
  readonly timestamp: string;
  readonly sliPercent: number;
  readonly remainingBudgetPercent: number;
  readonly burnRate1h: number;
  readonly status: SloStatus;
}

export interface SloDocumentData {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly sli: SliDefinition;
  readonly target: SloTarget;
  readonly tags: string[];
  readonly enabled: boolean;
  readonly calculation?: SloCalculation | null | undefined;
  readonly history?: SloHistoryPoint[] | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ReliabilityReport {
  readonly projectId: string;
  readonly overallReliabilityScore: number;
  readonly totalSlos: number;
  readonly compliantCount: number;
  readonly atRiskCount: number;
  readonly breachedCount: number;
  readonly averageRemainingBudgetPercent: number;
  readonly generatedAt: string;
}
