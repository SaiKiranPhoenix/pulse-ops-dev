import { randomUUID } from "node:crypto";
import type { CorrelationId, RequestId } from "../types/index.js";

export function createRequestId(): RequestId {
  return `req_${randomUUID()}` as RequestId;
}

export function createCorrelationId(): CorrelationId {
  return `corr_${randomUUID()}` as CorrelationId;
}
