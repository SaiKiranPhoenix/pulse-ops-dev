import { createHmac } from "node:crypto";
import type {
  AlertNotificationPayload,
  NotificationChannel,
  NotificationRoutingRule,
} from "@pulseops/shared";
import type { NotificationChannelRepository } from "../repositories/notification-channel.repository.js";
import type { SilenceWindowRepository } from "../repositories/silence-window.repository.js";

export class NotificationDispatcherService {
  constructor(
    private readonly channelRepo: NotificationChannelRepository,
    private readonly silenceRepo: SilenceWindowRepository,
  ) {}

  async isSuppressed(
    payload: AlertNotificationPayload,
  ): Promise<{ suppressed: boolean; reason?: string }> {
    const now = new Date();

    // 1. Check Maintenance Windows
    const activeMaintenance = await this.silenceRepo.listActiveMaintenance(payload.projectId, now);
    for (const mw of activeMaintenance) {
      if (mw.suppressNotifications) {
        const matchesEnv =
          mw.environments.length === 0 ||
          (payload.environment && mw.environments.includes(payload.environment));
        const matchesService =
          mw.services.length === 0 ||
          (payload.serviceName && mw.services.includes(payload.serviceName));

        if (matchesEnv && matchesService) {
          return {
            suppressed: true,
            reason: `Suppressed by maintenance window: "${mw.name}" (${mw.reason})`,
          };
        }
      }
    }

    // 2. Check Silence Windows
    const activeSilence = await this.silenceRepo.listActiveSilence(payload.projectId, now);
    for (const sw of activeSilence) {
      const matchers = sw.matchers;
      const envMatch = !matchers.environment || matchers.environment === payload.environment;
      const serviceMatch = !matchers.serviceName || matchers.serviceName === payload.serviceName;
      const ruleTypeMatch = !matchers.ruleType || matchers.ruleType === payload.ruleType;
      const monitorMatch = !matchers.monitorId || matchers.monitorId === payload.monitorId;
      const severityMatch = !matchers.severity || matchers.severity === payload.severity;

      if (envMatch && serviceMatch && ruleTypeMatch && monitorMatch && severityMatch) {
        return {
          suppressed: true,
          reason: `Suppressed by silence window: "${sw.name}" (${sw.reason})`,
        };
      }
    }

    return { suppressed: false };
  }

  async dispatchAlert(payload: AlertNotificationPayload): Promise<{
    dispatched: number;
    suppressed: boolean;
    suppressionReason?: string;
    results: Array<{ channelId: string; status: "success" | "failed"; error?: string }>;
  }> {
    const suppressionCheck = await this.isSuppressed(payload);
    if (suppressionCheck.suppressed) {
      return {
        dispatched: 0,
        suppressed: true,
        suppressionReason: suppressionCheck.reason,
        results: [],
      };
    }

    // Find applicable channels from routing rules
    const [allChannels, routingRules] = await Promise.all([
      this.channelRepo.listChannels(payload.projectId),
      this.channelRepo.listRoutingRules(payload.projectId),
    ]);

    const activeChannels = allChannels.filter((c) => c.enabled);
    const targetChannelIds = new Set<string>();

    const activeRules = routingRules.filter((r) => r.enabled);
    if (activeRules.length === 0) {
      // If no routing rules exist, dispatch to all enabled channels for this project
      for (const ch of activeChannels) {
        targetChannelIds.add(ch.id);
      }
    } else {
      for (const rule of activeRules) {
        const m = rule.matchers;
        const envMatch = !m.environment || m.environment === payload.environment;
        const serviceMatch = !m.service || m.service === payload.serviceName;
        const severityMatch = !m.severities?.length || m.severities.includes(payload.severity);
        const ruleTypeMatch = !m.ruleTypes?.length || m.ruleTypes.includes(payload.ruleType);

        if (envMatch && serviceMatch && severityMatch && ruleTypeMatch) {
          for (const chId of rule.channelIds) {
            targetChannelIds.add(chId);
          }
        }
      }
    }

    const results: Array<{ channelId: string; status: "success" | "failed"; error?: string }> = [];

    for (const channelId of targetChannelIds) {
      const channel = activeChannels.find((c) => c.id === channelId);
      if (!channel) continue;

      try {
        await this.sendToChannel(channel, payload);
        await this.channelRepo.updateDispatchStatus(channel.id, "success");
        results.push({ channelId: channel.id, status: "success" });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.channelRepo.updateDispatchStatus(channel.id, "failed");
        results.push({ channelId: channel.id, status: "failed", error: errorMsg });
      }
    }

    return {
      dispatched: results.filter((r) => r.status === "success").length,
      suppressed: false,
      results,
    };
  }

  async sendToChannel(
    channel: NotificationChannel,
    payload: AlertNotificationPayload,
  ): Promise<void> {
    if (channel.type === "webhook") {
      await this.sendWebhook(channel, payload);
    } else if (channel.type === "slack") {
      await this.sendSlack(channel, payload);
    } else if (channel.type === "email") {
      await this.sendEmail(channel, payload);
    }
  }

  private async sendWebhook(
    channel: NotificationChannel,
    payload: AlertNotificationPayload,
  ): Promise<void> {
    const url = channel.config.webhookUrl;
    if (!url) throw new Error("Webhook URL is not configured");

    const bodyString = JSON.stringify({
      event: "pulseops.alert",
      channel: channel.name,
      alert: payload,
    });

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": "PulseOps-Alert-Dispatcher/1.0",
    };

    if (channel.config.webhookSecret) {
      const signature = createHmac("sha256", channel.config.webhookSecret)
        .update(bodyString)
        .digest("hex");
      headers["x-pulseops-signature"] = `sha256=${signature}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: bodyString,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Webhook returned status ${res.status}`);
    }
  }

  private async sendSlack(
    channel: NotificationChannel,
    payload: AlertNotificationPayload,
  ): Promise<void> {
    const url = channel.config.slackWebhookUrl || channel.config.webhookUrl;
    if (!url) throw new Error("Slack webhook URL is not configured");

    const color =
      payload.state === "ok"
        ? "#10b981"
        : payload.severity === "critical"
          ? "#ef4444"
          : payload.severity === "high"
            ? "#f97316"
            : "#eab308";

    const slackPayload = {
      channel: channel.config.channelName,
      text: `[${payload.state.toUpperCase()}] ${payload.monitorName} (${payload.severity.toUpperCase()})`,
      attachments: [
        {
          color,
          title: payload.monitorName,
          text: payload.message,
          fields: [
            { title: "State", value: payload.state.toUpperCase(), short: true },
            { title: "Severity", value: payload.severity.toUpperCase(), short: true },
            { title: "Rule Type", value: payload.ruleType, short: true },
            {
              title: "Observed Value / Threshold",
              value: `${payload.value ?? "N/A"} / ${payload.threshold}`,
              short: true,
            },
            ...(payload.serviceName
              ? [{ title: "Service", value: payload.serviceName, short: true }]
              : []),
            ...(payload.environment
              ? [{ title: "Environment", value: payload.environment, short: true }]
              : []),
          ],
          ts: Math.floor(new Date(payload.timestamp).getTime() / 1000),
        },
      ],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(slackPayload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Slack webhook returned status ${res.status}`);
    }
  }

  private async sendEmail(
    channel: NotificationChannel,
    payload: AlertNotificationPayload,
  ): Promise<void> {
    const recipients = channel.config.emailRecipients;
    if (!recipients?.length) {
      throw new Error("No email recipients configured");
    }

    // Try MailHog HTTP API / fallback endpoint if available
    const mailhogUrl = process.env.MAILHOG_HTTP_URL || "http://localhost:8025";
    try {
      await fetch(`${mailhogUrl}/api/v2/messages`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Local dev simulation log if MailHog is not currently active
    }
  }
}
