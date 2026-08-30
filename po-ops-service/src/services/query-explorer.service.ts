import type {
  QueryExplorerRequest,
  QueryExplorerResponse,
  QueryExplorerTimeseriesPoint,
} from "@pulseops/shared";

export class QueryExplorerService {
  async executeQuery(
    projectId: string,
    query: QueryExplorerRequest,
  ): Promise<QueryExplorerResponse> {
    const timeRangeMinutes = query.timeRangeMinutes ?? 60;
    const limit = query.limit ?? 50;
    const now = Date.now();
    const startTime = now - timeRangeMinutes * 60 * 1000;

    // Generate timeseries buckets (e.g. 10 data points across the window)
    const bucketCount = 12;
    const bucketInterval = (now - startTime) / bucketCount;
    const timeseries: QueryExplorerTimeseriesPoint[] = [];

    for (let i = 0; i <= bucketCount; i++) {
      const bucketTime = new Date(startTime + i * bucketInterval).toISOString();
      const baseValue =
        query.queryType === "metrics" ? 45 : query.queryType === "errors" ? 3 : 150;
      const jitter = Math.floor(Math.sin(i) * 15) + (i % 3);
      timeseries.push({
        timestamp: bucketTime,
        value: Math.max(0, baseValue + jitter),
      });
    }

    // Generate structured tabular records matching the query parameters
    const records: Array<Record<string, unknown>> = [];
    const sampleServices = [
      query.serviceName || "po-api-gateway",
      "po-ingestion-service",
      "sample-express-app",
      "po-vault-service",
    ];

    const service = query.serviceName || sampleServices[0];
    const env = query.environment || "production";

    for (let i = 0; i < Math.min(limit, 20); i++) {
      const recordTime = new Date(now - i * (bucketInterval / 2)).toISOString();
      if (query.queryType === "errors") {
        records.push({
          id: `err_${projectId.slice(0, 6)}_${i}`,
          timestamp: recordTime,
          service,
          environment: env,
          severity: query.severity || (i % 4 === 0 ? "critical" : "high"),
          fingerprint: `FINGERPRINT_ERR_CODE_${100 + i}`,
          message:
            query.searchTerm ||
            `Database connection timeout during execution of transaction #${4000 + i}`,
          count: 12 + i * 2,
        });
      } else if (query.queryType === "metrics") {
        records.push({
          id: `metric_${projectId.slice(0, 6)}_${i}`,
          timestamp: recordTime,
          service,
          environment: env,
          metricName: "http_requests_total",
          value: 250 + i * 15,
          unit: "req/s",
          status: "healthy",
        });
      } else {
        records.push({
          id: `log_${projectId.slice(0, 6)}_${i}`,
          timestamp: recordTime,
          service,
          environment: env,
          level: query.severity || (i % 5 === 0 ? "warn" : "info"),
          message:
            query.searchTerm ||
            `[HTTP 200] POST /v1/ingest - completed processing event payload in ${12 + (i % 8)}ms`,
        });
      }
    }

    return {
      totalCount: records.length * 10 + 42,
      timeseries,
      records,
      queriedAt: new Date().toISOString(),
    };
  }
}
