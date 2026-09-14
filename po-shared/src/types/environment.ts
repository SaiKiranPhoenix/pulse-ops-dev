export const environments = ["development", "staging", "production"] as const;

export type PulseOpsEnvironment = (typeof environments)[number];
