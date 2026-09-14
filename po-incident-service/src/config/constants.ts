export const SERVICE_NAME = "po-incident-service";

export const INCIDENT_LIMITS = {
  titleMaxLength: 180,
  summaryMaxLength: 1_000,
  bodyLimit: "256kb",
} as const;
