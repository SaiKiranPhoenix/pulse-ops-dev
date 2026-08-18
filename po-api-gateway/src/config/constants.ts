export const SERVICE_NAME = "po-api-gateway";

export const GATEWAY_LIMITS = {
  bodyLimit: "256kb",
  dashboardLimit: 100,
} as const;

export const TOKEN_SETTINGS = {
  issuer: "pulseops.auth-project-service",
  audience: "pulseops.dashboard",
} as const;
