import type { NextFunction, Request, RequestHandler, Response } from "express";
import { forbidden } from "@pulseops/shared";
import { getAuthContext } from "./auth.middleware.js";
import type { ProjectAuthorizationRepository } from "../repositories/project-authorization.repository.js";

export function createProjectAccessMiddleware(
  projects: ProjectAuthorizationRepository,
): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    void (async () => {
      const projectId = getProjectId(request);

      if (projectId === null) {
        next();
        return;
      }

      const auth = getAuthContext(response);

      if (!(await projects.canAccessProject(projectId, auth.userId))) {
        throw forbidden("Project access denied");
      }

      next();
    })().catch(next);
  };
}

function getProjectId(request: Request): string | null {
  const queryProjectId = singleStringValue(request.query.projectId);

  if (queryProjectId !== null) {
    return queryProjectId;
  }

  if (hasBodyProjectId(request.body)) {
    return request.body.projectId.trim();
  }

  return null;
}

function singleStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function hasBodyProjectId(value: unknown): value is { readonly projectId: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "projectId" in value &&
    typeof (value as { readonly projectId?: unknown }).projectId === "string" &&
    (value as { readonly projectId: string }).projectId.trim().length > 0
  );
}
