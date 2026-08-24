import { z } from "zod";

export const INCIDENT_EXCHANGE = "pulseops.incidents.x";
export const INCIDENT_EVALUATION_ROUTING_KEY = "incident.evaluate.v1";
export const INCIDENT_EVALUATION_QUEUE = "pulseops.incident-evaluation.q";

export const incidentEvaluationMessageSchema = z.object({
  evaluationId: z.string().min(1),
  schemaVersion: z.literal(1),
  eventId: z.string().min(1),
  telemetryMessageId: z.string().min(1),
  projectId: z.string().min(1),
  ownerId: z.string().min(1),
  correlationId: z.string().min(1),
  source: z.string().min(1),
  level: z.string().min(1).nullable(),
  message: z.string().min(1).nullable(),
  fingerprint: z.string().min(1),
  observedAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  processedAt: z.string().datetime(),
});

export type IncidentEvaluationMessage = z.infer<typeof incidentEvaluationMessageSchema>;
