export const SERVICE_NAME = "po-realtime-gateway";

export const TOKEN_SETTINGS = {
  issuer: "pulseops.auth-project-service",
  audience: "pulseops.dashboard",
} as const;

export const SOCKET_EVENTS = {
  joinProject: "project:join",
  leaveProject: "project:leave",
  joinedProject: "project:joined",
  leftProject: "project:left",
} as const;
