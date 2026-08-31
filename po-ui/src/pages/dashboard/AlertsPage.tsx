import {
  AlertTriangle,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Flame,
  Globe,
  History,
  Layers,
  Loader2,
  Mail,
  MessageSquare,
  Play,
  Plus,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Server,
  ShieldAlert,
  Trash2,
  Upload,
  UserCheck,
  Users,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  acknowledgeIncident,
  listIncidents,
  reopenIncident,
  resolveIncident,
  type Incident,
} from "@/features/alerts/api";
import type { RealtimeIncidentUpdate } from "@/features/dashboards/api";
import {
  createMaintenanceWindow,
  createMonitor,
  createNotificationChannel,
  createSilenceWindow,
  deleteMaintenanceWindow,
  deleteMonitor,
  deleteNotificationChannel,
  deleteSilenceWindow,
  evaluateMonitor,
  exportMonitors,
  importMonitors,
  listMaintenanceWindows,
  listMonitors,
  listNotificationChannels,
  listSilenceWindows,
  testNotificationChannel,
  updateMonitor,
  type MaintenanceWindow,
  type MonitorComparator,
  type MonitorRule,
  type MonitorRuleType,
  type MonitorSeverity,
  type NotificationChannel,
  type NotificationChannelType,
  type SilenceWindow,
} from "@/features/monitors/api";
import {
  addIncidentComment,
  createEscalationPolicy,
  createOnCallSchedule,
  exportIncidentSummary,
  listEscalationPolicies,
  listOnCallSchedules,
  savePostmortem,
  triageIncident,
  type EscalationPolicy,
  type OnCallSchedule,
  type PostmortemReport,
} from "@/features/on-call/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
import { formatRelativeTime } from "./dashboard-utils";
import { useDashboardContext } from "./DashboardLayout";

type TabMode = "incidents" | "monitors" | "silence" | "channels" | "oncall";

export function AlertsPage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const { notify } = useToast();

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabMode>("incidents");

  // --- INCIDENTS STATE ---
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(true);
  const [resolutionNote, setResolutionNote] = useState("");

  // --- MONITORS STATE ---
  const [monitors, setMonitors] = useState<MonitorRule[]>([]);
  const [monitorRuleTypeFilter, setMonitorRuleTypeFilter] = useState<string>("all");
  const [monitorStateFilter, setMonitorStateFilter] = useState<string>("all");
  const [isCreatingMonitor, setIsCreatingMonitor] = useState(false);
  const [evaluatingMonitorId, setEvaluatingMonitorId] = useState<string | null>(null);

  // Monitor Form
  const [formMonitorName, setFormMonitorName] = useState("");
  const [formMonitorDesc, setFormMonitorDesc] = useState("");
  const [formMonitorRuleType, setFormMonitorRuleType] = useState<MonitorRuleType>("error_rate");
  const [formMonitorSeverity, setFormMonitorSeverity] = useState<MonitorSeverity>("high");
  const [formMonitorComparator, setFormMonitorComparator] = useState<MonitorComparator>(">");
  const [formMonitorThreshold, setFormMonitorThreshold] = useState(5.0);
  const [formMonitorWindowMin, setFormMonitorWindowMin] = useState(5);
  const [formMonitorMetricName] = useState("");
  const [formMonitorLogPattern] = useState("");
  const [formMonitorService] = useState("");
  const [isSubmittingMonitor, setIsSubmittingMonitor] = useState(false);

  // --- SILENCE & MAINTENANCE STATE ---
  const [silenceWindows, setSilenceWindows] = useState<SilenceWindow[]>([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState<MaintenanceWindow[]>([]);
  const [isCreatingSilence, setIsCreatingSilence] = useState(false);
  const [isCreatingMaintenance, setIsCreatingMaintenance] = useState(false);
  const [silenceReason, setSilenceReason] = useState("Investigating active incident");
  const [silenceDurationHours, setSilenceDurationHours] = useState(2);
  const [maintReason, setMaintReason] = useState("Scheduled cluster update");
  const [maintDurationHours, setMaintDurationHours] = useState(1);

  // --- NOTIFICATION CHANNELS STATE ---
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState("Core Team Webhook");
  const [channelType, setChannelType] = useState<NotificationChannelType>("webhook");
  const [channelWebhookUrl, setChannelWebhookUrl] = useState("http://localhost:5000/webhook");
  const [channelSecret, setChannelSecret] = useState("webhook_sec_12345");
  const [channelEmailRecipients, setChannelEmailRecipients] = useState("ops@example.com");

  // --- IMPORT / EXPORT STATE ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // --- ON-CALL & ESCALATION STATE ---
  const [schedules, setSchedules] = useState<OnCallSchedule[]>([]);
  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [isCreatingPolicy, setIsCreatingPolicy] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState("Primary SRE Rotation");
  const [newScheduleTimezone, setNewScheduleTimezone] = useState("UTC");
  const [newScheduleUser, setNewScheduleUser] = useState("alice@pulseops.dev");
  const [newPolicyName, setNewPolicyName] = useState("Critical Incident Escalation");

  // --- INCIDENT CONSOLE SUBTABS & TRIAGE ---
  const [incidentConsoleTab, setIncidentConsoleTab] = useState<
    "samples" | "timeline" | "comments" | "postmortem"
  >("samples");
  const [newCommentText, setNewCommentText] = useState("");
  const [postmortemSummary, setPostmortemSummary] = useState("");
  const [postmortemRootCause, setPostmortemRootCause] = useState("");
  const [postmortemTrigger, setPostmortemTrigger] = useState("");
  const [postmortemImpactMin, setPostmortemImpactMin] = useState(30);
  const [postmortemDetectionMin, setPostmortemDetectionMin] = useState(5);
  const [postmortemResolutionMin, setPostmortemResolutionMin] = useState(25);

  // ==========================================
  // LOADERS
  // ==========================================
  const loadIncidents = async () => {
    if (!selectedProject) {
      setIncidents([]);
      setSelectedIncident(null);
      return;
    }
    setIsLoadingIncidents(true);
    try {
      const next = await listIncidents(
        selectedProject.id,
        statusFilter === "all" ? undefined : (statusFilter as Incident["status"]),
      );
      setIncidents(next);
      setSelectedIncident((curr) =>
        curr === null ? (next[0] ?? null) : (next.find((i) => i.id === curr.id) ?? next[0] ?? null),
      );
    } catch {
      // ignore
    } finally {
      setIsLoadingIncidents(false);
    }
  };

  const loadOnCall = async () => {
    if (!selectedProject) return;
    try {
      const [schedList, polList] = await Promise.all([
        listOnCallSchedules(selectedProject.id),
        listEscalationPolicies(selectedProject.id),
      ]);
      setSchedules(schedList);
      setPolicies(polList);
    } catch {
      // ignore
    }
  };

  const loadMonitors = async () => {
    if (!selectedProject) return;
    try {
      const data = await listMonitors(selectedProject.id);
      setMonitors(data);
    } catch {
      // ignore
    }
  };

  const loadSilenceAndMaintenance = async () => {
    if (!selectedProject) return;
    try {
      const [silence, maint] = await Promise.all([
        listSilenceWindows(selectedProject.id),
        listMaintenanceWindows(selectedProject.id),
      ]);
      setSilenceWindows(silence);
      setMaintenanceWindows(maint);
    } catch {
      // ignore
    }
  };

  const loadChannels = async () => {
    if (!selectedProject) return;
    try {
      const chList = await listNotificationChannels(selectedProject.id);
      setChannels(chList);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadIncidents();
    void loadMonitors();
    void loadSilenceAndMaintenance();
    void loadChannels();
    void loadOnCall();
  }, [selectedProject?.id, statusFilter]);

  // Real-time socket events for incidents
  useEffect(() => {
    if (!selectedProject) return;
    const socket = createPulseOpsSocket();
    if (!socket) return;

    socket.on("connect", () => {
      void joinProjectRoom(socket, selectedProject.id, selectedEnvironment);
    });
    socket.on("incident.updated", (update: RealtimeIncidentUpdate) => {
      setIncidents((current) => {
        const index = current.findIndex((i) => i.id === update.incident.id);
        if (index === -1) return [update.incident as Incident, ...current];
        return current.map((item, idx) => (idx === index ? (update.incident as Incident) : item));
      });
      setSelectedIncident((current) =>
        current?.id === update.incident.id ? (update.incident as Incident) : current,
      );
    });
    socket.connect();

    return () => {
      leaveProjectRoom(socket, selectedProject.id, selectedEnvironment);
      socket.disconnect();
    };
  }, [selectedEnvironment, selectedProject]);

  // ==========================================
  // INCIDENT ACTIONS
  // ==========================================
  const handleAcknowledge = async () => {
    if (!selectedProject || !selectedIncident) return;
    try {
      const updated = await acknowledgeIncident(selectedProject.id, selectedIncident.id);
      setSelectedIncident(updated);
      await loadIncidents();
      notify({ variant: "success", title: "Incident Acknowledged", description: updated.title });
    } catch (err) {
      notify({
        variant: "error",
        title: "Action Failed",
        description: getApiErrorMessage(err),
      });
    }
  };

  const handleResolve = async () => {
    if (!selectedProject || !selectedIncident) return;
    try {
      const updated = await resolveIncident(
        selectedProject.id,
        selectedIncident.id,
        resolutionNote.trim() || undefined,
      );
      setSelectedIncident(updated);
      setResolutionNote("");
      await loadIncidents();
      notify({ variant: "success", title: "Incident Resolved", description: updated.title });
    } catch (err) {
      notify({
        variant: "error",
        title: "Action Failed",
        description: getApiErrorMessage(err),
      });
    }
  };

  const handleReopen = async () => {
    if (!selectedProject || !selectedIncident) return;
    try {
      const updated = await reopenIncident(selectedProject.id, selectedIncident.id);
      setSelectedIncident(updated);
      await loadIncidents();
      notify({ variant: "success", title: "Incident Reopened", description: updated.title });
    } catch (err) {
      notify({
        variant: "error",
        title: "Action Failed",
        description: getApiErrorMessage(err),
      });
    }
  };

  const handleTriage = async (updates: {
    severity?: "critical" | "high" | "medium" | "low";
    assignee?: string;
    runbookUrl?: string;
  }) => {
    if (!selectedProject || !selectedIncident) return;
    try {
      const updated = (await triageIncident(
        selectedProject.id,
        selectedIncident.id,
        updates,
      )) as Incident;
      setSelectedIncident(updated);
      await loadIncidents();
      notify({ variant: "success", title: "Incident Triaged", description: "Updated response attributes." });
    } catch (err) {
      notify({ variant: "error", title: "Triage Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !selectedIncident || !newCommentText.trim()) return;
    try {
      const updated = (await addIncidentComment(
        selectedProject.id,
        selectedIncident.id,
        { message: newCommentText.trim() },
      )) as Incident;
      setSelectedIncident(updated);
      setNewCommentText("");
      notify({ variant: "success", title: "Comment Posted", description: "Added to incident timeline." });
    } catch (err) {
      notify({ variant: "error", title: "Comment Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleSavePostmortem = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !selectedIncident) return;
    try {
      const postmortemData: PostmortemReport = {
        incidentId: selectedIncident.id,
        summary: postmortemSummary || selectedIncident.summary || "Incident postmortem",
        rootCause: postmortemRootCause || "Root cause under investigation",
        trigger: postmortemTrigger || selectedIncident.creationReason,
        impactDurationMinutes: Number(postmortemImpactMin),
        detectionTimeMinutes: Number(postmortemDetectionMin),
        resolutionTimeMinutes: Number(postmortemResolutionMin),
        actionItems: [
          {
            id: `act_${Date.now()}`,
            description: "Add automated regression test and monitor guardrail",
            assignee: selectedIncident.assignee || "alice@pulseops.dev",
            completed: false,
          },
        ],
        status: "published",
        updatedAt: new Date().toISOString(),
      };

      const updated = (await savePostmortem(
        selectedProject.id,
        selectedIncident.id,
        postmortemData,
      )) as Incident;
      setSelectedIncident(updated);
      notify({ variant: "success", title: "Postmortem Published", description: "Root cause analysis saved." });
    } catch (err) {
      notify({ variant: "error", title: "Save Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleExportBriefing = async () => {
    if (!selectedProject || !selectedIncident) return;
    try {
      const { markdown } = await exportIncidentSummary(selectedProject.id, selectedIncident.id);
      const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(markdown);
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `incident-${selectedIncident.id}-briefing.md`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      notify({ variant: "success", title: "Briefing Exported", description: "Downloaded incident summary." });
    } catch (err) {
      notify({ variant: "error", title: "Export Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleCreateSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newScheduleName.trim()) return;
    try {
      const created = await createOnCallSchedule(selectedProject.id, {
        name: newScheduleName.trim(),
        timezone: newScheduleTimezone,
        activeOnCallUser: newScheduleUser.trim(),
      });
      setSchedules([...schedules, created]);
      setIsCreatingSchedule(false);
      notify({ variant: "success", title: "Schedule Created", description: `Added ${created.name}` });
    } catch (err) {
      notify({ variant: "error", title: "Schedule Creation Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleCreatePolicy = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newPolicyName.trim()) return;
    try {
      const created = await createEscalationPolicy(selectedProject.id, {
        name: newPolicyName.trim(),
        steps: [
          { stepNumber: 1, delayMinutes: 0, targetType: "schedule", targetId: "sched_primary_sre" },
          { stepNumber: 2, delayMinutes: 5, targetType: "channel", targetId: "chan_slack_critical" },
        ],
      });
      setPolicies([...policies, created]);
      setIsCreatingPolicy(false);
      notify({ variant: "success", title: "Escalation Policy Created", description: `Added ${created.name}` });
    } catch (err) {
      notify({ variant: "error", title: "Policy Creation Failed", description: getApiErrorMessage(err) });
    }
  };

  // ==========================================
  // MONITOR ACTIONS
  // ==========================================
  const handleCreateMonitor = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !formMonitorName.trim()) return;

    setIsSubmittingMonitor(true);
    try {
      const newMonitor = await createMonitor(selectedProject.id, {
        name: formMonitorName.trim(),
        description: formMonitorDesc.trim() || undefined,
        ruleType: formMonitorRuleType,
        severity: formMonitorSeverity,
        condition: {
          comparator: formMonitorComparator,
          threshold: Number(formMonitorThreshold),
          timeWindowMinutes: Number(formMonitorWindowMin),
          metricName: formMonitorMetricName.trim() || undefined,
          logPattern: formMonitorLogPattern.trim() || undefined,
          serviceName: formMonitorService.trim() || undefined,
          environment: selectedEnvironment,
        },
        evaluationIntervalSeconds: 60,
      });

      setMonitors([newMonitor, ...monitors]);
      setIsCreatingMonitor(false);
      setFormMonitorName("");
      setFormMonitorDesc("");
      notify({
        variant: "success",
        title: "Monitor Created",
        description: `Rule "${newMonitor.name}" is now active and evaluating.`,
      });
    } catch (err) {
      notify({
        variant: "error",
        title: "Creation Failed",
        description: getApiErrorMessage(err),
      });
    } finally {
      setIsSubmittingMonitor(false);
    }
  };

  const handleEvaluateMonitor = async (monitorId: string) => {
    if (!selectedProject) return;
    setEvaluatingMonitorId(monitorId);
    try {
      const res = await evaluateMonitor(selectedProject.id, monitorId);
      notify({
        variant: res.nextState === "alert" ? "error" : "success",
        title: `Evaluated: ${res.nextState.toUpperCase()}`,
        description: res.message,
      });
      await loadMonitors();
    } catch (err) {
      notify({
        variant: "error",
        title: "Evaluation Failed",
        description: getApiErrorMessage(err),
      });
    } finally {
      setEvaluatingMonitorId(null);
    }
  };

  const handleDeleteMonitor = async (monitorId: string) => {
    if (!selectedProject) return;
    try {
      await deleteMonitor(selectedProject.id, monitorId);
      setMonitors(monitors.filter((m) => m.id !== monitorId));
      notify({ variant: "success", title: "Monitor Deleted", description: "Rule removed." });
    } catch (err) {
      notify({ variant: "error", title: "Delete Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleToggleMonitor = async (monitor: MonitorRule) => {
    if (!selectedProject) return;
    try {
      const updated = await updateMonitor(selectedProject.id, monitor.id, {
        enabled: !monitor.enabled,
      });
      setMonitors(monitors.map((m) => (m.id === monitor.id ? updated : m)));
      notify({
        variant: "success",
        title: updated.enabled ? "Monitor Enabled" : "Monitor Paused",
        description: `"${monitor.name}" state updated.`,
      });
    } catch (err) {
      notify({ variant: "error", title: "Update Failed", description: getApiErrorMessage(err) });
    }
  };

  // ==========================================
  // SILENCE & MAINTENANCE ACTIONS
  // ==========================================
  const handleCreateSilence = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      const startsAt = new Date().toISOString();
      const endsAt = new Date(Date.now() + silenceDurationHours * 3600 * 1000).toISOString();
      const created = await createSilenceWindow(selectedProject.id, {
        name: `Mute ${silenceDurationHours}h`,
        matchers: { environment: selectedEnvironment },
        startsAt,
        endsAt,
        reason: silenceReason.trim(),
        enabled: true,
      });
      setSilenceWindows([created, ...silenceWindows]);
      setIsCreatingSilence(false);
      notify({
        variant: "success",
        title: "Silence Window Activated",
        description: `Alert notifications muted until ${new Date(endsAt).toLocaleTimeString()}.`,
      });
    } catch (err) {
      notify({ variant: "error", title: "Action Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleDeleteSilence = async (id: string) => {
    if (!selectedProject) return;
    try {
      await deleteSilenceWindow(selectedProject.id, id);
      setSilenceWindows(silenceWindows.filter((w) => w.id !== id));
      notify({ variant: "success", title: "Silence Window Removed", description: "Mute removed." });
    } catch (err) {
      notify({ variant: "error", title: "Action Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleCreateMaintenance = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      const startsAt = new Date().toISOString();
      const endsAt = new Date(Date.now() + maintDurationHours * 3600 * 1000).toISOString();
      const created = await createMaintenanceWindow(selectedProject.id, {
        name: `Maintenance (${maintDurationHours}h)`,
        services: [],
        environments: [selectedEnvironment],
        startsAt,
        endsAt,
        suppressIncidents: true,
        suppressNotifications: true,
        reason: maintReason.trim(),
      });
      setMaintenanceWindows([created, ...maintenanceWindows]);
      setIsCreatingMaintenance(false);
      notify({
        variant: "success",
        title: "Maintenance Window Scheduled",
        description: `Alerts & Incidents suppressed until ${new Date(endsAt).toLocaleTimeString()}.`,
      });
    } catch (err) {
      notify({ variant: "error", title: "Action Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleDeleteMaintenance = async (id: string) => {
    if (!selectedProject) return;
    try {
      await deleteMaintenanceWindow(selectedProject.id, id);
      setMaintenanceWindows(maintenanceWindows.filter((w) => w.id !== id));
      notify({ variant: "success", title: "Maintenance Window Cleared", description: "Active." });
    } catch (err) {
      notify({ variant: "error", title: "Action Failed", description: getApiErrorMessage(err) });
    }
  };

  // ==========================================
  // CHANNEL ACTIONS
  // ==========================================
  const handleCreateChannel = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !channelName.trim()) return;
    try {
      const newChan = await createNotificationChannel(selectedProject.id, {
        name: channelName.trim(),
        type: channelType,
        config: {
          webhookUrl: channelType === "webhook" ? channelWebhookUrl.trim() : undefined,
          webhookSecret: channelType === "webhook" ? channelSecret.trim() : undefined,
          slackWebhookUrl: channelType === "slack" ? channelWebhookUrl.trim() : undefined,
          emailRecipients:
            channelType === "email"
              ? channelEmailRecipients.split(",").map((s) => s.trim())
              : undefined,
        },
        enabled: true,
      });
      setChannels([newChan, ...channels]);
      setIsCreatingChannel(false);
      notify({
        variant: "success",
        title: "Channel Registered",
        description: `Target "${newChan.name}" ready for notifications.`,
      });
    } catch (err) {
      notify({ variant: "error", title: "Action Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleTestChannel = async (id: string) => {
    if (!selectedProject) return;
    setTestingChannelId(id);
    try {
      const msg = await testNotificationChannel(selectedProject.id, id, "high");
      notify({
        variant: "success",
        title: "Test Notification Sent",
        description: msg,
      });
      await loadChannels();
    } catch (err) {
      notify({
        variant: "error",
        title: "Test Dispatch Failed",
        description: getApiErrorMessage(err),
      });
    } finally {
      setTestingChannelId(null);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!selectedProject) return;
    try {
      await deleteNotificationChannel(selectedProject.id, id);
      setChannels(channels.filter((c) => c.id !== id));
      notify({ variant: "success", title: "Channel Deleted", description: "Target removed." });
    } catch (err) {
      notify({ variant: "error", title: "Action Failed", description: getApiErrorMessage(err) });
    }
  };

  // ==========================================
  // EXPORT / IMPORT ACTIONS
  // ==========================================
  const handleExport = async () => {
    if (!selectedProject) return;
    try {
      const bundle = await exportMonitors(selectedProject.id);
      const dataStr =
        "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bundle, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `pulseops-monitors-${selectedProject.id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      notify({
        variant: "success",
        title: "Export Complete",
        description: "Monitors bundle downloaded.",
      });
    } catch (err) {
      notify({ variant: "error", title: "Export Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleImport = async () => {
    if (!selectedProject || !importJsonText.trim()) return;
    setIsImporting(true);
    try {
      const parsed = JSON.parse(importJsonText);
      const res = await importMonitors(selectedProject.id, parsed);
      setIsImportModalOpen(false);
      setImportJsonText("");
      notify({
        variant: "success",
        title: "Import Successful",
        description: `Imported ${res.monitors} monitors, ${res.channels} channels, ${res.routingRules} rules.`,
      });
      await loadMonitors();
      await loadChannels();
    } catch (err) {
      notify({
        variant: "error",
        title: "Import Error",
        description: getApiErrorMessage(err),
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Filtered Incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const matchesSearch =
        search === "" ||
        incident.title.toLowerCase().includes(search.toLowerCase()) ||
        (incident.summary && incident.summary.toLowerCase().includes(search.toLowerCase())) ||
        incident.fingerprint.toLowerCase().includes(search.toLowerCase());

      const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [incidents, search, severityFilter]);

  // Filtered Monitors
  const filteredMonitors = useMemo(() => {
    return monitors.filter((m) => {
      const matchesType = monitorRuleTypeFilter === "all" || m.ruleType === monitorRuleTypeFilter;
      const matchesState = monitorStateFilter === "all" || m.state === monitorStateFilter;
      return matchesType && matchesState;
    });
  }, [monitors, monitorRuleTypeFilter, monitorStateFilter]);

  // Monitor counts
  const monitorStats = useMemo(() => {
    return {
      total: monitors.length,
      ok: monitors.filter((m) => m.state === "ok").length,
      warning: monitors.filter((m) => m.state === "warning").length,
      alert: monitors.filter((m) => m.state === "alert").length,
      noData: monitors.filter((m) => m.state === "no_data").length,
    };
  }, [monitors]);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/10">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                Incidents & Monitors
              </h1>
              <p className="text-sm text-zinc-400">
                Automated rule evaluations, real-time triage, silence windows, and multi-channel
                routing.
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar Tabs */}
        <div className="flex rounded-xl bg-zinc-950 p-1.5 border border-zinc-800 backdrop-blur-md">
          {[
            {
              id: "incidents",
              label: "Active Incidents",
              count: incidents.filter((i) => i.status === "open").length,
              icon: Flame,
            },
            { id: "monitors", label: "Monitors & Rules", count: monitors.length, icon: RadioTower },
            {
              id: "silence",
              label: "Silence & Maintenance",
              count: silenceWindows.length + maintenanceWindows.length,
              icon: VolumeX,
            },
            { id: "channels", label: "Notification Channels", count: channels.length, icon: Bell },
            { id: "oncall", label: "On-Call & Escalations", count: schedules.length, icon: Calendar },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabMode)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-850"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INCIDENTS & TRIAGE */}
      {/* ========================================================================= */}
      {activeTab === "incidents" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search incidents by title or fingerprint..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center rounded-lg bg-zinc-950/80 border border-zinc-800 p-0.5">
                {["all", "open", "acknowledged", "resolved"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      statusFilter === st
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                ))}
              </div>

              {/* Severity Filter */}
              <div className="flex items-center rounded-lg bg-zinc-950/80 border border-zinc-800 p-0.5">
                {["all", "critical", "high", "medium", "low"].map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      severityFilter === sev
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              onClick={loadIncidents}
              disabled={isLoadingIncidents}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs h-8 px-3"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${isLoadingIncidents ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          {/* Incidents Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Incident List */}
            <div className="space-y-3">
              {filteredIncidents.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-500 text-xs">
                  No matching incidents found.
                </div>
              ) : (
                filteredIncidents.map((incident) => {
                  const isSelected = selectedIncident?.id === incident.id;
                  return (
                    <div
                      key={incident.id}
                      onClick={() => setSelectedIncident(incident)}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        isSelected
                          ? "border-rose-500/50 bg-gradient-to-r from-rose-950/30 to-zinc-900/80 shadow-lg shadow-rose-950/20"
                          : "border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                incident.severity === "critical"
                                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                  : incident.severity === "high"
                                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              }`}
                            >
                              {incident.severity}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[120px]">
                              {incident.fingerprint.slice(0, 12)}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-white line-clamp-1">
                            {incident.title}
                          </h3>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            incident.status === "open"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : incident.status === "acknowledged"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {incident.status}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-800/60">
                        <span>{incident.eventCount} events</span>
                        <span>{formatRelativeTime(incident.lastSeenAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right: Incident Detail & Triage Console */}
            <div className="lg:col-span-2">
              {selectedIncident ? (
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 shadow-xl backdrop-blur-md space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                            selectedIncident.severity === "critical"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                          }`}
                        >
                          {selectedIncident.severity}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          ID: {selectedIncident.id}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-white mt-1">
                        {selectedIncident.title}
                      </h2>
                    </div>

                    {/* Triage Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={handleExportBriefing}
                        variant="outline"
                        className="text-xs h-8 px-2.5 border-zinc-700 text-zinc-300"
                        title="Download Markdown Incident Briefing"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Briefing
                      </Button>

                      {selectedIncident.status === "open" && (
                        <Button
                          type="button"
                          onClick={handleAcknowledge}
                          className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs h-8 px-3"
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                      {selectedIncident.status !== "resolved" && (
                        <Button
                          type="button"
                          onClick={handleResolve}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8 px-3"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Resolve
                        </Button>
                      )}
                      {selectedIncident.status === "resolved" && (
                        <Button
                          type="button"
                          onClick={handleReopen}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs h-8 px-3"
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Triage Quick Controls (Severity / Assignee / Runbook) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-500">Triage Severity</label>
                      <select
                        value={selectedIncident.severity}
                        onChange={(e) =>
                          void handleTriage({
                            severity: e.target.value as "critical" | "high" | "medium" | "low",
                          })
                        }
                        className="w-full h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white px-2 font-semibold"
                      >
                        <option value="critical">CRITICAL (P1)</option>
                        <option value="high">HIGH (P2)</option>
                        <option value="medium">MEDIUM (P3)</option>
                        <option value="low">LOW (P4)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-500">Assignee</label>
                      <input
                        type="text"
                        defaultValue={selectedIncident.assignee || ""}
                        onBlur={(e) => void handleTriage({ assignee: e.target.value.trim() || undefined })}
                        placeholder="e.g. alice@pulseops.dev"
                        className="w-full h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white px-2.5 placeholder-zinc-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-500 flex items-center justify-between">
                        <span>Runbook URL</span>
                        {selectedIncident.runbookUrl && (
                          <a
                            href={selectedIncident.runbookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline flex items-center gap-0.5"
                          >
                            Open <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </a>
                        )}
                      </label>
                      <input
                        type="url"
                        defaultValue={selectedIncident.runbookUrl || ""}
                        onBlur={(e) => void handleTriage({ runbookUrl: e.target.value.trim() || undefined })}
                        placeholder="https://wiki.domain/runbooks/api"
                        className="w-full h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white px-2.5 font-mono placeholder-zinc-600 truncate"
                      />
                    </div>
                  </div>

                  {/* Incident Summary Stat Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
                      <div className="text-[10px] text-zinc-500 uppercase font-semibold">Status</div>
                      <div className="text-sm font-bold text-white capitalize mt-0.5">{selectedIncident.status}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
                      <div className="text-[10px] text-zinc-500 uppercase font-semibold">Total Events</div>
                      <div className="text-sm font-bold text-cyan-300 mt-0.5">{selectedIncident.eventCount}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
                      <div className="text-[10px] text-zinc-500 uppercase font-semibold">First Seen</div>
                      <div className="text-xs font-semibold text-zinc-300 mt-1">
                        {formatRelativeTime(selectedIncident.firstSeenAt)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
                      <div className="text-[10px] text-zinc-500 uppercase font-semibold">Last Seen</div>
                      <div className="text-xs font-semibold text-zinc-300 mt-1">
                        {formatRelativeTime(selectedIncident.lastSeenAt)}
                      </div>
                    </div>
                  </div>

                  {/* Incident Workspace Subtabs */}
                  <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2">
                    {[
                      { id: "samples", label: `Samples (${selectedIncident.samples?.length ?? 0})`, icon: Layers },
                      { id: "timeline", label: `Timeline (${selectedIncident.timeline?.length ?? 1})`, icon: History },
                      { id: "comments", label: `Comments (${selectedIncident.comments?.length ?? 0})`, icon: MessageSquare },
                      { id: "postmortem", label: "Postmortem RCA", icon: BookOpen },
                    ].map((st) => {
                      const Icon = st.icon;
                      const isSubActive = incidentConsoleTab === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setIncidentConsoleTab(st.id as typeof incidentConsoleTab)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isSubActive
                              ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                              : "text-zinc-400 hover:text-white hover:bg-zinc-850"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{st.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Subtab 1: Event Samples */}
                  {incidentConsoleTab === "samples" && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        Event Samples & Root Cause Logs ({selectedIncident.samples?.length ?? 0})
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(selectedIncident.samples ?? []).map((sample, idx) => (
                          <div
                            key={sample.eventId || idx}
                            className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80 font-mono text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between text-zinc-500 text-[10px]">
                              <span>Source: {sample.source}</span>
                              <span>{new Date(sample.observedAt).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-rose-300">{sample.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subtab 2: Timeline */}
                  {incidentConsoleTab === "timeline" && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        Incident Activity Stream
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto divide-y divide-zinc-850">
                        {(selectedIncident.timeline && selectedIncident.timeline.length > 0
                          ? selectedIncident.timeline
                          : [
                              {
                                id: "tl_init",
                                timestamp: selectedIncident.createdAt,
                                type: "created",
                                actor: "PulseOps Incident Bot",
                                description: `Triggered: ${selectedIncident.creationReason}`,
                              },
                            ]
                        ).map((t) => (
                          <div key={t.id} className="pt-2 flex items-start gap-2.5 text-xs">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                <span className="font-bold text-white">{t.actor}</span>
                                <span className="font-mono text-[10px] text-zinc-500">{t.timestamp}</span>
                              </div>
                              <p className="text-zinc-300 mt-0.5">{t.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subtab 3: Live Comments */}
                  {incidentConsoleTab === "comments" && (
                    <div className="space-y-3">
                      <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-zinc-850">
                        {(!selectedIncident.comments || selectedIncident.comments.length === 0) ? (
                          <p className="text-xs text-zinc-500 italic py-2">No comments posted yet. Add incident notes below.</p>
                        ) : (
                          selectedIncident.comments.map((c) => (
                            <div key={c.id} className="pt-2 text-xs space-y-0.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-indigo-400">{c.userName}</span>
                                <span className="font-mono text-[10px] text-zinc-500">{c.createdAt}</span>
                              </div>
                              <p className="text-zinc-200">{c.message}</p>
                            </div>
                          ))
                        )}
                      </div>

                      <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-zinc-800">
                        <Input
                          placeholder="Write comment or investigation note..."
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          className="bg-zinc-950 border-zinc-800 text-xs text-white flex-1"
                        />
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-3">
                          <Send className="w-3.5 h-3.5 mr-1" /> Post
                        </Button>
                      </form>
                    </div>
                  )}

                  {/* Subtab 4: Postmortem */}
                  {incidentConsoleTab === "postmortem" && (
                    <form onSubmit={handleSavePostmortem} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-300">Executive Summary</label>
                        <Input
                          placeholder="What happened at a high level?"
                          value={postmortemSummary}
                          onChange={(e) => setPostmortemSummary(e.target.value)}
                          className="bg-zinc-950 border-zinc-800 text-xs text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-300">Root Cause Analysis</label>
                        <textarea
                          rows={2}
                          placeholder="Technical explanation of the defect, configuration, or trigger..."
                          value={postmortemRootCause}
                          onChange={(e) => setPostmortemRootCause(e.target.value)}
                          className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-zinc-400">Impact Duration (min)</label>
                          <Input
                            type="number"
                            value={postmortemImpactMin}
                            onChange={(e) => setPostmortemImpactMin(Number(e.target.value))}
                            className="bg-zinc-950 border-zinc-800 text-xs text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-zinc-400">Detection Time (min)</label>
                          <Input
                            type="number"
                            value={postmortemDetectionMin}
                            onChange={(e) => setPostmortemDetectionMin(Number(e.target.value))}
                            className="bg-zinc-950 border-zinc-800 text-xs text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-zinc-400">Resolution Time (min)</label>
                          <Input
                            type="number"
                            value={postmortemResolutionMin}
                            onChange={(e) => setPostmortemResolutionMin(Number(e.target.value))}
                            className="bg-zinc-950 border-zinc-800 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium">
                          Save & Publish Postmortem
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-500 text-xs">
                  Select an incident to view root-cause samples and triage.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONITORS & HEALTH RULES */}
      {/* ========================================================================= */}
      {activeTab === "monitors" && (
        <div className="space-y-6">
          {/* Monitor Health Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="text-xs text-zinc-400 font-medium">Total Rules</div>
              <div className="text-2xl font-bold text-white mt-1">{monitorStats.total}</div>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-4">
              <div className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                State: OK
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{monitorStats.ok}</div>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-4">
              <div className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Warning
              </div>
              <div className="text-2xl font-bold text-amber-400 mt-1">{monitorStats.warning}</div>
            </div>
            <div className="rounded-2xl border border-rose-500/30 bg-rose-950/10 p-4">
              <div className="text-xs text-rose-400 font-medium flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5" />
                Alert Triggered
              </div>
              <div className="text-2xl font-bold text-rose-400 mt-1">{monitorStats.alert}</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="text-xs text-zinc-400 font-medium">No Data</div>
              <div className="text-2xl font-bold text-zinc-400 mt-1">{monitorStats.noData}</div>
            </div>
          </div>

          {/* Toolbar & Filter */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-3">
              {/* Type filter */}
              <select
                value={monitorRuleTypeFilter}
                onChange={(e) => setMonitorRuleTypeFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none"
              >
                <option value="all">All Rule Types</option>
                <option value="error_rate">Error Rate (%)</option>
                <option value="latency_p95">p95 Latency (ms)</option>
                <option value="metric_threshold">Metric Threshold</option>
                <option value="log_match">Log Regex Match</option>
                <option value="queue_backlog">Queue Backlog</option>
                <option value="worker_stale">Worker Stale Heartbeat</option>
                <option value="vault_anomaly">Vault Audit Anomaly</option>
              </select>

              {/* State filter */}
              <select
                value={monitorStateFilter}
                onChange={(e) => setMonitorStateFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none"
              >
                <option value="all">All States</option>
                <option value="ok">OK</option>
                <option value="warning">Warning</option>
                <option value="alert">Alert</option>
                <option value="no_data">No Data</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleExport}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs h-8 px-3"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export JSON
              </Button>
              <Button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs h-8 px-3"
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Import JSON
              </Button>
              <Button
                type="button"
                onClick={() => setIsCreatingMonitor(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-8 px-3"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create Monitor
              </Button>
            </div>
          </div>

          {/* Monitors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMonitors.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-500 text-xs">
                No monitors configured yet. Click &quot;Create Monitor&quot; to build your first
                health rule.
              </div>
            ) : (
              filteredMonitors.map((mon) => (
                <div
                  key={mon.id}
                  className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 shadow-lg backdrop-blur-md space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              mon.state === "ok"
                                ? "bg-emerald-400 shadow-sm shadow-emerald-400"
                                : mon.state === "alert"
                                  ? "bg-rose-500 animate-pulse shadow-sm shadow-rose-500"
                                  : mon.state === "warning"
                                    ? "bg-amber-400"
                                    : "bg-zinc-500"
                            }`}
                          />
                          <span className="text-xs font-bold text-white uppercase">
                            {mon.state}
                          </span>
                          <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 uppercase">
                            {mon.severity}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white mt-1">{mon.name}</h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleMonitor(mon)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                          mon.enabled
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                        }`}
                      >
                        {mon.enabled ? "Active" : "Paused"}
                      </button>
                    </div>

                    {mon.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2">{mon.description}</p>
                    )}

                    {/* Condition Pill */}
                    <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800 font-mono text-xs text-zinc-300 space-y-1">
                      <div className="text-[10px] text-zinc-500 uppercase font-sans font-semibold">
                        Rule Condition ({mon.ruleType})
                      </div>
                      <div className="text-cyan-300">
                        {mon.condition.metricName || mon.ruleType} {mon.condition.comparator}{" "}
                        {mon.condition.threshold}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Window: {mon.condition.timeWindowMinutes} min | Every{" "}
                        {mon.evaluationIntervalSeconds}s
                      </div>
                    </div>

                    {/* Last Evaluation Message */}
                    {mon.lastEvaluationMessage && (
                      <div className="text-[11px] text-zinc-400 line-clamp-2">
                        {mon.lastEvaluationMessage}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
                    <Button
                      type="button"
                      onClick={() => handleEvaluateMonitor(mon.id)}
                      disabled={evaluatingMonitorId === mon.id}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs h-8 px-2.5"
                    >
                      <Play
                        className={`h-3 w-3 mr-1 ${
                          evaluatingMonitorId === mon.id ? "animate-spin text-cyan-400" : ""
                        }`}
                      />
                      Evaluate
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMonitor(mon.id)}
                      className="text-zinc-500 hover:text-rose-400 transition-colors p-1.5"
                      title="Delete Monitor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SILENCE & MAINTENANCE WINDOWS */}
      {/* ========================================================================= */}
      {activeTab === "silence" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
            <div>
              <h2 className="text-base font-bold text-white">Silence & Maintenance Windows</h2>
              <p className="text-xs text-zinc-400">
                Temporarily mute alert dispatches or suppress automatic incident creation during
                upgrades.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setIsCreatingSilence(true)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs h-8 px-3"
              >
                <VolumeX className="h-3.5 w-3.5 mr-1.5" />
                Mute Alerts
              </Button>
              <Button
                type="button"
                onClick={() => setIsCreatingMaintenance(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-8 px-3"
              >
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                Schedule Maintenance
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active Silence Windows */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <VolumeX className="h-4 w-4 text-amber-400" />
                  Active Silence Mutes ({silenceWindows.length})
                </h3>
              </div>

              {silenceWindows.length === 0 ? (
                <div className="rounded-xl bg-zinc-950 p-6 text-center text-zinc-500 text-xs">
                  No active silence windows. All alerts are delivering normally.
                </div>
              ) : (
                <div className="space-y-3">
                  {silenceWindows.map((sw) => (
                    <div
                      key={sw.id}
                      className="rounded-xl bg-zinc-950 p-4 border border-zinc-800 space-y-2 flex items-start justify-between"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-white">{sw.name}</h4>
                        <p className="text-xs text-zinc-400">{sw.reason}</p>
                        <div className="text-[11px] text-amber-300 font-mono mt-1">
                          Ends: {new Date(sw.endsAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSilence(sw.id)}
                        className="text-zinc-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scheduled Maintenance Windows */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Server className="h-4 w-4 text-indigo-400" />
                  Maintenance Windows ({maintenanceWindows.length})
                </h3>
              </div>

              {maintenanceWindows.length === 0 ? (
                <div className="rounded-xl bg-zinc-950 p-6 text-center text-zinc-500 text-xs">
                  No scheduled maintenance windows.
                </div>
              ) : (
                <div className="space-y-3">
                  {maintenanceWindows.map((mw) => (
                    <div
                      key={mw.id}
                      className="rounded-xl bg-zinc-950 p-4 border border-zinc-800 space-y-2 flex items-start justify-between"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-white">{mw.name}</h4>
                        <p className="text-xs text-zinc-400">{mw.reason}</p>
                        <div className="text-[11px] text-indigo-300 font-mono mt-1">
                          Ends: {new Date(mw.endsAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMaintenance(mw.id)}
                        className="text-zinc-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: NOTIFICATION CHANNELS & ROUTING */}
      {/* ========================================================================= */}
      {activeTab === "channels" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
            <div>
              <h2 className="text-base font-bold text-white">
                Notification Channels & Routing Matrix
              </h2>
              <p className="text-xs text-zinc-400">
                Route alert notifications to MailHog email, webhook endpoints with HMAC
                verification, or Slack.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setIsCreatingChannel(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-8 px-3"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Notification Channel
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-500 text-xs">
                No notification channels configured yet. Click &quot;Add Notification Channel&quot;.
              </div>
            ) : (
              channels.map((chan) => (
                <div
                  key={chan.id}
                  className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 shadow-lg backdrop-blur-md space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {chan.type === "email" ? (
                            <Mail className="h-4 w-4" />
                          ) : chan.type === "slack" ? (
                            <MessageSquare className="h-4 w-4" />
                          ) : (
                            <Globe className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{chan.name}</h4>
                          <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                            {chan.type}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          chan.lastDispatchStatus === "success"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : chan.lastDispatchStatus === "failed"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {chan.lastDispatchStatus || "Ready"}
                      </span>
                    </div>

                    <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800 font-mono text-xs text-zinc-400 truncate">
                      {chan.type === "email"
                        ? chan.config.emailRecipients?.join(", ") || "ops@example.com"
                        : chan.config.webhookUrl || chan.config.slackWebhookUrl || "N/A"}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
                    <Button
                      type="button"
                      onClick={() => handleTestChannel(chan.id)}
                      disabled={testingChannelId === chan.id}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs h-8 px-2.5"
                    >
                      <Send
                        className={`h-3 w-3 mr-1 ${
                          testingChannelId === chan.id ? "animate-spin text-cyan-400" : ""
                        }`}
                      />
                      Test Dispatch
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDeleteChannel(chan.id)}
                      className="text-zinc-500 hover:text-rose-400 transition-colors p-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ON-CALL & ESCALATION POLICIES */}
      {/* ========================================================================= */}
      {activeTab === "oncall" && (
        <div className="space-y-6">
          {/* Top Action Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                On-Call Rotations & Tiered Escalation Policies
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Manage automated engineer shifts, paging escalation tiers, and active incident response ownership.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsCreatingSchedule(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-8 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Schedule
              </Button>
              <Button
                onClick={() => setIsCreatingPolicy(true)}
                variant="outline"
                className="text-xs h-8 gap-1.5 border-zinc-700 text-zinc-300"
              >
                <Plus className="w-3.5 h-3.5" />
                New Escalation Tier
              </Button>
            </div>
          </div>

          {/* Schedules Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Active On-Call Schedules ({schedules.length})
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schedules.map((sched) => (
                <div
                  key={sched.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="text-sm font-bold text-white">{sched.name}</h5>
                      <span className="text-[10px] text-zinc-500 font-mono">TZ: {sched.timezone}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ACTIVE
                    </span>
                  </div>

                  <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-850 space-y-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Currently On-Call Responder</span>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-sm font-bold text-white font-mono">{sched.activeOnCallUser}</span>
                    </div>
                  </div>

                  {/* Rotations List */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Rotation Participants</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(sched.rotations?.[0]?.participants || [sched.activeOnCallUser]).map((u, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg text-xs font-mono bg-zinc-950 border border-zinc-800 text-zinc-300"
                        >
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Escalation Policies Section */}
          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Automated Escalation Chains ({policies.length})
            </h4>

            <div className="space-y-3">
              {policies.map((pol) => (
                <div
                  key={pol.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-bold text-white">{pol.name}</h5>
                      {pol.isDefault && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500 font-mono">{pol.steps.length} Tiered Steps</span>
                  </div>

                  {/* Steps Chain */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {pol.steps.map((step, sIdx) => (
                      <div
                        key={sIdx}
                        className="rounded-xl bg-zinc-950 p-3.5 border border-zinc-850 space-y-1 relative"
                      >
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span className="font-bold text-white">Tier {step.stepNumber}</span>
                          <span className="font-mono text-amber-400">+{step.delayMinutes} min</span>
                        </div>
                        <p className="text-xs text-zinc-300 font-mono truncate">
                          Target: {step.targetType.toUpperCase()} ({step.targetId})
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create On-Call Schedule */}
      {isCreatingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                Create On-Call Schedule
              </h3>
              <button onClick={() => setIsCreatingSchedule(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Schedule Name</label>
                <Input
                  value={newScheduleName}
                  onChange={(e) => setNewScheduleName(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs text-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Timezone</label>
                <Input
                  value={newScheduleTimezone}
                  onChange={(e) => setNewScheduleTimezone(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs text-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Primary Responder Email</label>
                <Input
                  value={newScheduleUser}
                  onChange={(e) => setNewScheduleUser(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <Button type="button" onClick={() => setIsCreatingSchedule(false)} className="bg-zinc-800 text-xs">
                  Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
                  Create Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Escalation Policy */}
      {isCreatingPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Create Escalation Policy
              </h3>
              <button onClick={() => setIsCreatingPolicy(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePolicy} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Policy Name</label>
                <Input
                  value={newPolicyName}
                  onChange={(e) => setNewPolicyName(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <Button type="button" onClick={() => setIsCreatingPolicy(false)} className="bg-zinc-800 text-xs">
                  Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
                  Create Policy
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE MONITOR BUILDER */}
      {/* ========================================================================= */}
      {isCreatingMonitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <RadioTower className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Create Monitor Health Rule</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingMonitor(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMonitor} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Rule Name</label>
                <Input
                  value={formMonitorName}
                  onChange={(e) => setFormMonitorName(e.target.value)}
                  placeholder="e.g. High Payment Gateway Latency"
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Rule Type</label>
                  <select
                    value={formMonitorRuleType}
                    onChange={(e) => setFormMonitorRuleType(e.target.value as MonitorRuleType)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="error_rate">Error Rate (%)</option>
                    <option value="latency_p95">p95 Latency (ms)</option>
                    <option value="metric_threshold">Metric Threshold</option>
                    <option value="log_match">Log Regex Match</option>
                    <option value="queue_backlog">Queue Backlog</option>
                    <option value="worker_stale">Worker Stale Heartbeat</option>
                    <option value="vault_anomaly">Vault Audit Anomaly</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Severity</label>
                  <select
                    value={formMonitorSeverity}
                    onChange={(e) => setFormMonitorSeverity(e.target.value as MonitorSeverity)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Condition Details */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Comparator</label>
                  <select
                    value={formMonitorComparator}
                    onChange={(e) => setFormMonitorComparator(e.target.value as MonitorComparator)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value=">">&gt; (Greater than)</option>
                    <option value=">=">&gt;= (Greater or equal)</option>
                    <option value="<">&lt; (Less than)</option>
                    <option value="<=">&lt;= (Less or equal)</option>
                    <option value="==">== (Exact equal)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Threshold</label>
                  <Input
                    type="number"
                    step="any"
                    value={formMonitorThreshold}
                    onChange={(e) => setFormMonitorThreshold(Number(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Time Window (min)</label>
                  <Input
                    type="number"
                    value={formMonitorWindowMin}
                    onChange={(e) => setFormMonitorWindowMin(Number(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  onClick={() => setIsCreatingMonitor(false)}
                  className="bg-zinc-800 text-zinc-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingMonitor}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
                >
                  {isSubmittingMonitor ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : null}
                  Create Rule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: IMPORT MONITORS JSON */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-cyan-400" />
                Import Monitors JSON Bundle
              </h3>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Paste a PulseOps Monitor Bundle JSON with rule definitions, notification channels, and
              routing policies.
            </p>

            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder={`{\n  "version": "1.0",\n  "monitors": [\n    {\n      "name": "High Error Rate",\n      "ruleType": "error_rate",\n      "severity": "critical",\n      "condition": { "comparator": ">", "threshold": 5, "timeWindowMinutes": 5 }\n    }\n  ]\n}`}
              className="w-full h-48 rounded-xl bg-zinc-950 p-3 font-mono text-xs text-zinc-200 border border-zinc-800 focus:outline-none focus:border-cyan-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={isImporting || !importJsonText.trim()}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs"
              >
                {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Execute Import
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREATE NOTIFICATION CHANNEL */}
      {/* ========================================================================= */}
      {isCreatingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-400" />
                Add Notification Target Channel
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingChannel(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Channel Name</label>
                <Input
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="e.g. SRE Team Webhook"
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Channel Type</label>
                <select
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value as NotificationChannelType)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="webhook">HTTP Webhook (with HMAC)</option>
                  <option value="slack">Slack / Teams Incoming Webhook</option>
                  <option value="email">Email / MailHog SMTP</option>
                </select>
              </div>

              {channelType === "email" ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    Recipients (comma separated)
                  </label>
                  <Input
                    value={channelEmailRecipients}
                    onChange={(e) => setChannelEmailRecipients(e.target.value)}
                    placeholder="devops@company.com, oncall@company.com"
                    className="bg-zinc-950 border-zinc-800 text-white text-xs"
                    required
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Webhook URL</label>
                    <Input
                      value={channelWebhookUrl}
                      onChange={(e) => setChannelWebhookUrl(e.target.value)}
                      placeholder="https://hooks.slack.com/... or https://api.mycorp.com/alerts"
                      className="bg-zinc-950 border-zinc-800 text-white text-xs"
                      required
                    />
                  </div>

                  {channelType === "webhook" && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-300">
                        HMAC Secret (optional)
                      </label>
                      <Input
                        value={channelSecret}
                        onChange={(e) => setChannelSecret(e.target.value)}
                        placeholder="secret_key_for_x_pulseops_signature"
                        className="bg-zinc-950 border-zinc-800 text-white text-xs font-mono"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <Button
                  type="button"
                  onClick={() => setIsCreatingChannel(false)}
                  className="bg-zinc-800 text-zinc-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
                >
                  Save Channel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CREATE SILENCE WINDOW */}
      {/* ========================================================================= */}
      {isCreatingSilence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <VolumeX className="h-5 w-5 text-amber-400" />
                Mute Notifications (Silence Window)
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingSilence(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSilence} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Reason</label>
                <Input
                  value={silenceReason}
                  onChange={(e) => setSilenceReason(e.target.value)}
                  placeholder="e.g. Hotfix deployment in progress"
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Duration (Hours)</label>
                <Input
                  type="number"
                  min="1"
                  max="48"
                  value={silenceDurationHours}
                  onChange={(e) => setSilenceDurationHours(Number(e.target.value))}
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <Button
                  type="button"
                  onClick={() => setIsCreatingSilence(false)}
                  className="bg-zinc-800 text-zinc-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs"
                >
                  Activate Mute
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: SCHEDULE MAINTENANCE WINDOW */}
      {/* ========================================================================= */}
      {isCreatingMaintenance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="h-5 w-5 text-indigo-400" />
                Schedule Maintenance Window
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingMaintenance(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMaintenance} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Maintenance Reason</label>
                <Input
                  value={maintReason}
                  onChange={(e) => setMaintReason(e.target.value)}
                  placeholder="e.g. Database engine migration"
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Duration (Hours)</label>
                <Input
                  type="number"
                  min="1"
                  max="72"
                  value={maintDurationHours}
                  onChange={(e) => setMaintDurationHours(Number(e.target.value))}
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <Button
                  type="button"
                  onClick={() => setIsCreatingMaintenance(false)}
                  className="bg-zinc-800 text-zinc-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
                >
                  Schedule Maintenance
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AlertsPage;
