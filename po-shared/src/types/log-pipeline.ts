export type LogProcessorType =
  "parse_json" | "remap_fields" | "redact_regex" | "drop_filter" | "sample_rate" | "add_tags";

export interface LogProcessorConfig {
  readonly sourceField?: string | undefined;
  readonly targetField?: string | undefined;
  readonly fieldMappings?: Record<string, string> | undefined;
  readonly redactionPatterns?: string[] | undefined;
  readonly redactionReplacement?: string | undefined;
  readonly dropFilter?: string | undefined;
  readonly sampleRatePercent?: number | undefined;
  readonly tags?: Record<string, string> | undefined;
}

export interface LogPipelineProcessor {
  readonly id: string;
  readonly type: LogProcessorType;
  readonly name: string;
  readonly enabled: boolean;
  readonly config: LogProcessorConfig;
}

export interface LogPipelineRule {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly order: number;
  readonly enabled: boolean;
  readonly processors: LogPipelineProcessor[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LogRetentionSettings {
  readonly projectId: string;
  readonly retentionDays: number;
  readonly coldArchiveEnabled: boolean;
  readonly coldArchiveBucket?: string | undefined;
  readonly updatedAt: string;
}

export interface SavedLogSearch {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly query: string;
  readonly serviceFilter?: string | undefined;
  readonly levelFilter?: string | undefined;
  readonly environment?: string | undefined;
  readonly timeframe: string;
  readonly createdAt: string;
}

export interface LogContextResponse {
  readonly targetEventId: string;
  readonly before: Array<Record<string, unknown>>;
  readonly target: Record<string, unknown> | null;
  readonly after: Array<Record<string, unknown>>;
}

export interface LogVolumeAnalytics {
  readonly projectId: string;
  readonly totalEventsPerSec: number;
  readonly totalBytesPerSec: number;
  readonly byService: Record<string, number>;
  readonly byLevel: Record<string, number>;
  readonly sampledPercentage: number;
  readonly redactedCount: number;
  readonly timestamp: string;
}
