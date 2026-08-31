import { describe, expect, it } from "vitest";
import type { LogPipelineRule } from "@pulseops/shared";
import { LogPipelineProcessorEngine } from "../../src/services/log-pipeline.processor.js";
import { SensitiveDataScanner } from "../../src/services/sensitive-scanner.js";

describe("Log Pipeline & Sensitive Data Scanner", () => {
  describe("SensitiveDataScanner", () => {
    it("redacts JWT tokens and Bearer authorizations", () => {
      const jwtHeader = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      const jwtPayload = "eyJzdWIiOiIxMjM0NTY3ODkwIn0";
      const input = `User token is ${jwtHeader}.${jwtPayload}.doNotLeakThisSignature and Bearer ${jwtHeader}.sampleSignatureKey12345`;
      const result = SensitiveDataScanner.scanAndRedact(input);

      expect(result.foundSecretsCount).toBeGreaterThan(0);
      expect(result.redactedText).not.toContain("doNotLeakThisSignature");
      expect(result.secretTypes).toContain("jwt_token");
    });

    it("redacts AWS access keys and credit cards", () => {
      const awsAccessKey = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
      const input = `Deploying to AWS using ${awsAccessKey} and payment card 4532-1234-5678-9012`;
      const result = SensitiveDataScanner.scanAndRedact(input);

      expect(result.redactedText).toContain("[REDACTED_AWS_KEY]");
      expect(result.redactedText).toContain("[REDACTED_CARD]");
      expect(result.secretTypes).toContain("aws_access_key");
      expect(result.secretTypes).toContain("credit_card");
    });

    it("redacts sensitive fields in nested JSON objects", () => {
      const payload = {
        user: "phoenix",
        password: ["Super", "Secret", "Password", "123!"].join(""),
        meta: {
          apiKey: ["secret", "live", "key", "998877"].join("_"),
          status: "active",
        },
      };

      const result = SensitiveDataScanner.scanObject(payload);
      expect(result.redactedObj.password).toBe("[REDACTED_FIELD]");
      expect((result.redactedObj.meta as Record<string, unknown>).apiKey).toBe("[REDACTED_FIELD]");
      expect((result.redactedObj.meta as Record<string, unknown>).status).toBe("active");
    });
  });

  describe("LogPipelineProcessorEngine", () => {
    const engine = new LogPipelineProcessorEngine();

    it("parses structured JSON logs into message and attributes", () => {
      const rule: LogPipelineRule = {
        id: "r1",
        projectId: "proj_1",
        name: "JSON Unpacker",
        order: 1,
        enabled: true,
        processors: [
          {
            id: "p1",
            type: "parse_json",
            name: "Unpack JSON",
            enabled: true,
            config: {},
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const rawJson = JSON.stringify({
        msg: "Worker queue processed item",
        lvl: "info",
        queueName: "telemetry_ingest",
        durationMs: 4.2,
      });

      const res = engine.processLogEvent(
        { projectId: "proj_1", message: rawJson, level: "unknown" },
        [rule],
      );

      expect(res.dropped).toBe(false);
      expect(res.message).toBe("Worker queue processed item");
      expect(res.level).toBe("info");
      expect(res.attributes.queueName).toBe("telemetry_ingest");
      expect(res.attributes.durationMs).toBe(4.2);
    });

    it("applies remap_fields processor", () => {
      const rule: LogPipelineRule = {
        id: "r2",
        projectId: "proj_1",
        name: "Remap Legacy Fields",
        order: 1,
        enabled: true,
        processors: [
          {
            id: "p2",
            type: "remap_fields",
            name: "Standardize client IP",
            enabled: true,
            config: {
              fieldMappings: {
                remote_addr: "client_ip",
                http_status: "statusCode",
              },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = engine.processLogEvent(
        {
          projectId: "proj_1",
          message: "Incoming request",
          attributes: { remote_addr: "192.168.1.1", http_status: 200 },
        },
        [rule],
      );

      expect(res.attributes.client_ip).toBe("192.168.1.1");
      expect(res.attributes.statusCode).toBe(200);
      expect(res.attributes.remote_addr).toBeUndefined();
    });

    it("drops noisy events when drop_filter rule matches", () => {
      const rule: LogPipelineRule = {
        id: "r3",
        projectId: "proj_1",
        name: "Drop Health Probes",
        order: 1,
        enabled: true,
        processors: [
          {
            id: "p3",
            type: "drop_filter",
            name: "Drop k8s probe",
            enabled: true,
            config: {
              dropFilter: "GET /healthz",
            },
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = engine.processLogEvent(
        { projectId: "proj_1", message: "HTTP 200 GET /healthz (kube-probe/1.28)" },
        [rule],
      );

      expect(res.dropped).toBe(true);
    });

    it("enriches logs with custom dimension tags", () => {
      const rule: LogPipelineRule = {
        id: "r4",
        projectId: "proj_1",
        name: "Tag Enrichment",
        order: 1,
        enabled: true,
        processors: [
          {
            id: "p4",
            type: "add_tags",
            name: "Add Cluster Tag",
            enabled: true,
            config: {
              tags: {
                cluster: "us-east-prod-1",
                region: "us-east-1",
              },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = engine.processLogEvent({ projectId: "proj_1", message: "User authenticated" }, [
        rule,
      ]);

      expect(res.attributes.cluster).toBe("us-east-prod-1");
      expect(res.attributes.region).toBe("us-east-1");
    });
  });
});
