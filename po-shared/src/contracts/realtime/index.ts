import { z } from "zod";

export const REALTIME_SOCKET_EVENTS = {
  incidentUpdated: "incident.updated",
} as const;

export const PROJECT_ROOM_PREFIX = "project";

export function toProjectRoom(projectId: string): string {
  return `${PROJECT_ROOM_PREFIX}:${projectId}`;
}

export const realtimeIncidentSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  fingerprint: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "resolved"]),
  eventCount: z.number().int().min(1),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RealtimeIncident = z.infer<typeof realtimeIncidentSchema>;

export const realtimeIncidentUpdateActionSchema = z.enum([
  "opened",
  "updated",
  "resolved",
  "reopened",
]);
export type RealtimeIncidentUpdateAction = z.infer<typeof realtimeIncidentUpdateActionSchema>;

export const realtimeIncidentUpdateMessageSchema = z.object({
  messageId: z.string().min(1),
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  action: realtimeIncidentUpdateActionSchema,
  incident: realtimeIncidentSchema,
  occurredAt: z.string().datetime(),
});

export type RealtimeIncidentUpdateMessage = z.infer<
  typeof realtimeIncidentUpdateMessageSchema
>;
