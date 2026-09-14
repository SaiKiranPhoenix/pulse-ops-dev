import type {
  MetricRollupAggregation,
  MetricTimeBucket,
  MetricTimeSeriesPoint,
} from "@pulseops/shared";

export interface RawMetricSample {
  timestamp: number; // unix epoch ms
  value: number;
  tags: Record<string, string>;
}

export class MetricsRollupEngine {
  static getBucketDurationMs(bucket: MetricTimeBucket): number {
    switch (bucket) {
      case "10s":
        return 10 * 1000;
      case "1m":
        return 60 * 1000;
      case "5m":
        return 5 * 60 * 1000;
      case "15m":
        return 15 * 60 * 1000;
      case "1h":
        return 60 * 60 * 1000;
      case "1d":
        return 24 * 60 * 60 * 1000;
      default:
        return 60 * 1000;
    }
  }

  static calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    if (percentile <= 0) return sorted[0]!;
    if (percentile >= 100) return sorted[sorted.length - 1]!;

    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sorted[lower]!;
    }
    return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
  }

  static aggregateValues(values: number[], aggregation: MetricRollupAggregation): number {
    if (values.length === 0) return 0;

    switch (aggregation) {
      case "count":
        return values.length;
      case "sum":
        return values.reduce((acc, v) => acc + v, 0);
      case "min":
        return Math.min(...values);
      case "max":
        return Math.max(...values);
      case "avg": {
        const sum = values.reduce((acc, v) => acc + v, 0);
        return Number((sum / values.length).toFixed(4));
      }
      case "p50":
        return Number(this.calculatePercentile(values, 50).toFixed(4));
      case "p95":
        return Number(this.calculatePercentile(values, 95).toFixed(4));
      case "p99":
        return Number(this.calculatePercentile(values, 99).toFixed(4));
      default:
        return Number((values.reduce((acc, v) => acc + v, 0) / values.length).toFixed(4));
    }
  }

  static rollupSamples(
    samples: RawMetricSample[],
    aggregation: MetricRollupAggregation,
    timeBucket: MetricTimeBucket,
    startTimeMs?: number,
    endTimeMs?: number,
  ): MetricTimeSeriesPoint[] {
    const bucketMs = this.getBucketDurationMs(timeBucket);
    const buckets = new Map<number, number[]>();

    const start =
      startTimeMs ??
      (samples.length > 0 ? Math.min(...samples.map((s) => s.timestamp)) : Date.now() - 3600000);
    const end = endTimeMs ?? Date.now();

    // Initialize all intermediate buckets to produce a clean continuous series
    const alignedStart = Math.floor(start / bucketMs) * bucketMs;
    const alignedEnd = Math.floor(end / bucketMs) * bucketMs;

    for (let t = alignedStart; t <= alignedEnd; t += bucketMs) {
      buckets.set(t, []);
    }

    for (const sample of samples) {
      if (sample.timestamp < alignedStart || sample.timestamp > alignedEnd + bucketMs) {
        continue;
      }
      const bucketKey = Math.floor(sample.timestamp / bucketMs) * bucketMs;
      const list = buckets.get(bucketKey);
      if (list) {
        list.push(sample.value);
      }
    }

    const points: MetricTimeSeriesPoint[] = [];
    const sortedBucketKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

    for (const key of sortedBucketKeys) {
      const vals = buckets.get(key) || [];
      const aggValue = vals.length > 0 ? this.aggregateValues(vals, aggregation) : 0;
      points.push({
        timestamp: new Date(key).toISOString(),
        value: aggValue,
      });
    }

    return points;
  }

  static checkCardinality(
    samples: RawMetricSample[],
    tagKey: string,
    limit: number,
  ): { distinctCount: number; isExceeded: boolean } {
    const distinct = new Set<string>();
    for (const s of samples) {
      const val = s.tags[tagKey];
      if (val) distinct.add(val);
    }
    return {
      distinctCount: distinct.size,
      isExceeded: distinct.size > limit,
    };
  }
}
