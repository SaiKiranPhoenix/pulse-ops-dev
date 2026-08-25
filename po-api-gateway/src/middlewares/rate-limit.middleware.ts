import type { NextFunction, Request, Response } from "express";
import { rateLimited } from "@pulseops/shared";

export type GatewayRateLimitOptions = {
  readonly limit: number;
  readonly windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export function createGatewayRateLimitMiddleware(options: GatewayRateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return (request: Request, _response: Response, next: NextFunction): void => {
    const now = Date.now();
    const bucketKey = `${request.ip ?? "unknown"}:${request.path}`;
    const currentBucket = buckets.get(bucketKey);
    const bucket =
      currentBucket === undefined || currentBucket.resetAt <= now
        ? { count: 0, resetAt: now + options.windowMs }
        : currentBucket;

    bucket.count += 1;
    buckets.set(bucketKey, bucket);

    if (bucket.count > options.limit) {
      next(
        rateLimited("Gateway rate limit exceeded", {
          limit: options.limit,
          resetAt: new Date(bucket.resetAt).toISOString(),
        }),
      );
      return;
    }

    next();
  };
}
