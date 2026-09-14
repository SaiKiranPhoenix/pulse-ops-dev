import type { Request, Response } from "express";
import type { MonitorRule, MonitorRuleType, MonitorSeverity, MonitorState } from "@pulseops/shared";
import type { MonitorRepository } from "../repositories/monitor.repository.js";
import type { NotificationChannelRepository } from "../repositories/notification-channel.repository.js";
import type { SilenceWindowRepository } from "../repositories/silence-window.repository.js";
import type { MonitorEvaluatorService } from "../services/monitor-evaluator.service.js";
import type { NotificationDispatcherService } from "../services/notification-dispatcher.service.js";

export class MonitorController {
  constructor(
    private readonly monitorRepo: MonitorRepository,
    private readonly silenceRepo: SilenceWindowRepository,
    private readonly channelRepo: NotificationChannelRepository,
    private readonly evaluator: MonitorEvaluatorService,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {}

  private getProjectId(req: Request): string {
    const raw = (req.query.projectId as string) || (req.headers["x-project-id"] as string);
    return typeof raw === "string" ? raw : "";
  }

  list = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const ruleType = (req.query.ruleType as MonitorRuleType) || undefined;
    const state = (req.query.state as MonitorState) || undefined;
    const enabled =
      req.query.enabled === "true" ? true : req.query.enabled === "false" ? false : undefined;

    const monitors = await this.monitorRepo.list(projectId, { ruleType, state, enabled });
    res.status(200).json({ data: { monitors } });
  };

  detail = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const monitorId = String(req.params.monitorId || "");
    const monitor = await this.monitorRepo.findById(projectId, monitorId);
    if (!monitor) {
      res.status(404).json({ error: { message: "Monitor not found", code: "NOT_FOUND" } });
      return;
    }
    res.status(200).json({ data: { monitor } });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const monitor = await this.monitorRepo.create({
      ...req.body,
      projectId,
      tags: req.body.tags ?? [],
    });
    res.status(201).json({ data: { monitor } });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const monitorId = String(req.params.monitorId || "");
    const updated = await this.monitorRepo.update(projectId, monitorId, req.body);
    if (!updated) {
      res.status(404).json({ error: { message: "Monitor not found", code: "NOT_FOUND" } });
      return;
    }
    res.status(200).json({ data: { monitor: updated } });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const monitorId = String(req.params.monitorId || "");
    const deleted = await this.monitorRepo.delete(projectId, monitorId);
    if (!deleted) {
      res.status(404).json({ error: { message: "Monitor not found", code: "NOT_FOUND" } });
      return;
    }
    res.status(200).json({ data: { success: true } });
  };

  evaluateManual = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const monitorId = String(req.params.monitorId || "");
    const monitor = await this.monitorRepo.findById(projectId, monitorId);
    if (!monitor) {
      res.status(404).json({ error: { message: "Monitor not found", code: "NOT_FOUND" } });
      return;
    }

    const evaluation = await this.evaluator.evaluateMonitor(monitor);
    res.status(200).json({ data: { evaluation } });
  };

  exportMonitors = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const [monitors, channels, routingRules] = await Promise.all([
      this.monitorRepo.list(projectId),
      this.channelRepo.listChannels(projectId),
      this.channelRepo.listRoutingRules(projectId),
    ]);

    res.status(200).json({
      data: {
        bundle: {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          projectId,
          monitors,
          channels,
          routingRules,
        },
      },
    });
  };

  importMonitors = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req) || String(req.body.projectId || "");
    const { monitors = [], channels = [], routingRules = [] } = req.body;

    const importedMonitors = [];
    for (const m of monitors) {
      const created = await this.monitorRepo.create({
        ...m,
        projectId,
        tags: m.tags ?? [],
      });
      importedMonitors.push(created);
    }

    const importedChannels = [];
    for (const c of channels) {
      const created = await this.channelRepo.createChannel({
        ...c,
        projectId,
      });
      importedChannels.push(created);
    }

    const importedRules = [];
    for (const r of routingRules) {
      const created = await this.channelRepo.createRoutingRule({
        ...r,
        projectId,
      });
      importedRules.push(created);
    }

    res.status(200).json({
      data: {
        importedCount: {
          monitors: importedMonitors.length,
          channels: importedChannels.length,
          routingRules: importedRules.length,
        },
      },
    });
  };

  // Silence & Maintenance Windows
  listSilenceWindows = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const windows = await this.silenceRepo.listSilence(projectId);
    res.status(200).json({ data: { windows } });
  };

  createSilenceWindow = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const window = await this.silenceRepo.createSilence({ ...req.body, projectId });
    res.status(201).json({ data: { window } });
  };

  deleteSilenceWindow = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    await this.silenceRepo.deleteSilence(projectId, id);
    res.status(200).json({ data: { success: true } });
  };

  listMaintenanceWindows = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const windows = await this.silenceRepo.listMaintenance(projectId);
    res.status(200).json({ data: { windows } });
  };

  createMaintenanceWindow = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const window = await this.silenceRepo.createMaintenance({ ...req.body, projectId });
    res.status(201).json({ data: { window } });
  };

  deleteMaintenanceWindow = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    await this.silenceRepo.deleteMaintenance(projectId, id);
    res.status(200).json({ data: { success: true } });
  };

  // Channels & Routing
  listChannels = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const channels = await this.channelRepo.listChannels(projectId);
    res.status(200).json({ data: { channels } });
  };

  createChannel = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const channel = await this.channelRepo.createChannel({ ...req.body, projectId });
    res.status(201).json({ data: { channel } });
  };

  updateChannel = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    const channel = await this.channelRepo.updateChannel(projectId, id, req.body);
    if (!channel) {
      res.status(404).json({ error: { message: "Channel not found", code: "NOT_FOUND" } });
      return;
    }
    res.status(200).json({ data: { channel } });
  };

  deleteChannel = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    await this.channelRepo.deleteChannel(projectId, id);
    res.status(200).json({ data: { success: true } });
  };

  testChannel = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    const channel = await this.channelRepo.findChannelById(projectId, id);
    if (!channel) {
      res.status(404).json({ error: { message: "Channel not found", code: "NOT_FOUND" } });
      return;
    }

    try {
      await this.notificationDispatcher.sendToChannel(channel, {
        monitorId: "test_monitor_1",
        monitorName: "Test Notification Monitor",
        projectId,
        state: "alert",
        severity: (req.body.severity as MonitorSeverity) || "high",
        ruleType: "metric_threshold",
        value: 99.4,
        threshold: 95.0,
        message: "This is a test notification from PulseOps Monitor Manager.",
        timestamp: new Date().toISOString(),
        serviceName: "checkout-api",
        environment: "production",
      });
      await this.channelRepo.updateDispatchStatus(channel.id, "success");
      res
        .status(200)
        .json({ data: { success: true, message: "Test notification dispatched successfully" } });
    } catch (err) {
      await this.channelRepo.updateDispatchStatus(channel.id, "failed");
      res.status(500).json({
        error: {
          message: err instanceof Error ? err.message : "Failed to dispatch test notification",
          code: "DISPATCH_FAILED",
        },
      });
    }
  };

  listRoutingRules = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const rules = await this.channelRepo.listRoutingRules(projectId);
    res.status(200).json({ data: { rules } });
  };

  createRoutingRule = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const rule = await this.channelRepo.createRoutingRule({ ...req.body, projectId });
    res.status(201).json({ data: { rule } });
  };

  deleteRoutingRule = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    await this.channelRepo.deleteRoutingRule(projectId, id);
    res.status(200).json({ data: { success: true } });
  };
}
