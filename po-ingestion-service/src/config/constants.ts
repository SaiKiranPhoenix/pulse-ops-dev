export const SERVICE_NAME = "po-ingestion-service";

export const INGESTION_LIMITS = {
  messageMaxLength: 4_000,
  nameMaxLength: 160,
  stackMaxLength: 20_000,
  metadataMaxKeys: 50,
  bodyLimit: "512kb",
} as const;
