import { describe, expect, it } from "vitest";
import {
  MetricsRollupEngine,
  type RawMetricSample,
} from "../../src/services/metrics-rollup.engine.js";

describe("MetricsRollupEngine", () => {
  describe("Percentile & Quantile Math", () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    it("calculates exact median (P50)", () => {
      const p50 = MetricsRollupEngine.calculatePercentile(values, 50);
      expect(p50).toBe(55);
    });

    it("calculates P95 and P99 tail percentiles accurately", () => {
      const p95 = MetricsRollupEngine.calculatePercentile(values, 95);
      const p99 = MetricsRollupEngine.calculatePercentile(values, 99);

      expect(p95).toBe(95.5);
      expect(p99).toBe(99.1);
    });

    it("handles edge percentiles P0 and P100", () => {
      expect(MetricsRollupEngine.calculatePercentile(values, 0)).toBe(10);
      expect(MetricsRollupEngine.calculatePercentile(values, 100)).toBe(100);
    });

    it("handles empty and single-element arrays gracefully", () => {
      expect(MetricsRollupEngine.calculatePercentile([], 50)).toBe(0);
      expect(MetricsRollupEngine.calculatePercentile([42], 95)).toBe(42);
    });
  });

  describe("Aggregations", () => {
    const sampleVals = [10, 20, 30, 40, 50];

    it("computes count, sum, min, max, avg", () => {
      expect(MetricsRollupEngine.aggregateValues(sampleVals, "count")).toBe(5);
      expect(MetricsRollupEngine.aggregateValues(sampleVals, "sum")).toBe(150);
      expect(MetricsRollupEngine.aggregateValues(sampleVals, "min")).toBe(10);
      expect(MetricsRollupEngine.aggregateValues(sampleVals, "max")).toBe(50);
      expect(MetricsRollupEngine.aggregateValues(sampleVals, "avg")).toBe(30);
    });
  });

  describe("Time-Bucket Continuous Rollup Windowing", () => {
    it("buckets raw samples into time-aligned continuous points", () => {
      const base = 1700000000000;
      const samples: RawMetricSample[] = [
        { timestamp: base + 5000, value: 100, tags: { service: "api" } },
        { timestamp: base + 15000, value: 200, tags: { service: "api" } },
        { timestamp: base + 65000, value: 300, tags: { service: "api" } },
      ];

      const rolled = MetricsRollupEngine.rollupSamples(
        samples,
        "avg",
        "1m",
        base,
        base + 120000,
      );

      expect(rolled.length).toBeGreaterThanOrEqual(2);
      // First 1-minute bucket (0 to 60s): avg(100, 200) = 150
      expect(rolled[0]!.value).toBe(150);
      // Second 1-minute bucket (60s to 120s): avg(300) = 300
      expect(rolled[1]!.value).toBe(300);
    });
  });

  describe("Cardinality Guardrails", () => {
    it("detects high-cardinality violations when distinct tag values exceed limit", () => {
      const samples: RawMetricSample[] = [];
      for (let i = 0; i < 25; i++) {
        samples.push({
          timestamp: Date.now(),
          value: 1,
          tags: { user_id: `usr_${i}` },
        });
      }

      const underLimit = MetricsRollupEngine.checkCardinality(samples, "user_id", 50);
      expect(underLimit.distinctCount).toBe(25);
      expect(underLimit.isExceeded).toBe(false);

      const overLimit = MetricsRollupEngine.checkCardinality(samples, "user_id", 10);
      expect(overLimit.distinctCount).toBe(25);
      expect(overLimit.isExceeded).toBe(true);
    });
  });
});
