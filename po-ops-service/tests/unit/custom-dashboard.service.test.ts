import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryExplorerService } from "../../src/services/query-explorer.service.js";
import { CustomDashboardController } from "../../src/controllers/custom-dashboard.controller.js";
import type { CustomDashboardRepository } from "../../src/repositories/custom-dashboard.repository.js";

describe("Custom Dashboards & Query Explorer", () => {
  describe("QueryExplorerService", () => {
    const explorerService = new QueryExplorerService();

    it("generates structured timeseries and log records for logs query", async () => {
      const result = await explorerService.executeQuery("proj_test_123", {
        queryType: "logs",
        serviceName: "po-api-gateway",
        environment: "production",
        timeRangeMinutes: 30,
        limit: 10,
      });

      expect(result.timeseries.length).toBeGreaterThan(0);
      expect(result.records.length).toBe(10);
      expect(result.records[0]).toHaveProperty("level");
      expect(result.records[0]).toHaveProperty("message");
      expect(result.records[0]?.service).toBe("po-api-gateway");
      expect(result.totalCount).toBeGreaterThan(0);
    });

    it("generates metric timeseries for metrics query", async () => {
      const result = await explorerService.executeQuery("proj_test_123", {
        queryType: "metrics",
        timeRangeMinutes: 60,
        limit: 5,
      });

      expect(result.records.length).toBe(5);
      expect(result.records[0]).toHaveProperty("metricName");
      expect(result.records[0]).toHaveProperty("value");
    });

    it("generates error records with fingerprint for errors query", async () => {
      const result = await explorerService.executeQuery("proj_test_123", {
        queryType: "errors",
        timeRangeMinutes: 15,
        limit: 5,
      });

      expect(result.records.length).toBe(5);
      expect(result.records[0]).toHaveProperty("fingerprint");
      expect(result.records[0]).toHaveProperty("severity");
    });
  });

  describe("CustomDashboardController", () => {
    let mockRepo: Partial<CustomDashboardRepository>;
    let mockExplorer: Partial<QueryExplorerService>;
    let controller: CustomDashboardController;

    beforeEach(() => {
      mockRepo = {
        list: vi.fn().mockResolvedValue([]),
        findById: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((_pid, input) =>
          Promise.resolve({
            id: "dash_new_1",
            projectId: "proj_test_123",
            name: input.name,
            widgets: input.widgets || [],
            tags: input.tags || [],
            refreshIntervalSeconds: 30,
            isDefault: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        ),
        clone: vi.fn().mockResolvedValue({
          id: "dash_cloned_1",
          projectId: "proj_test_123",
          name: "Original (Copy)",
          widgets: [],
          tags: [],
          refreshIntervalSeconds: 30,
          isDefault: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      };

      mockExplorer = {
        executeQuery: vi.fn().mockResolvedValue({
          totalCount: 10,
          timeseries: [],
          records: [],
          queriedAt: new Date().toISOString(),
        }),
      };

      controller = new CustomDashboardController(
        mockRepo as CustomDashboardRepository,
        mockExplorer as QueryExplorerService,
      );
    });

    it("seeds production dashboard templates for a project", async () => {
      const mockReq = {
        query: { projectId: "proj_test_123" },
        headers: {},
      } as any;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      await controller.seedTemplates(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRepo.create).toHaveBeenCalledTimes(3);
    });

    it("clones existing custom dashboard", async () => {
      const mockReq = {
        query: { projectId: "proj_test_123" },
        headers: {},
        params: { dashboardId: "dash_orig_1" },
        body: { name: "Cloned Board" },
      } as any;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      await controller.clone(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRepo.clone).toHaveBeenCalledWith("proj_test_123", "dash_orig_1", "Cloned Board");
    });
  });
});
