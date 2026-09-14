import { Router } from "express";
import { ProjectController } from "../controllers/project.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody, validateParams } from "../middlewares/validate.middleware.js";
import type { TokenService } from "../services/token.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  apiKeyParamsSchema,
  createApiKeyBodySchema,
  createOrganizationBodySchema,
  createPersonalAccessTokenBodySchema,
  createProjectBodySchema,
  inviteMemberBodySchema,
  organizationMemberEnvironmentParamsSchema,
  organizationMemberParamsSchema,
  organizationMemberProjectParamsSchema,
  organizationParamsSchema,
  personalAccessTokenParamsSchema,
  projectParamsSchema,
  setEnvironmentPermissionBodySchema,
  setProjectRoleBodySchema,
  updateMemberRoleBodySchema,
} from "../validators/project.validator.js";

export function createProjectRouter(
  controller: ProjectController,
  tokenService: TokenService,
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(tokenService);

  router.use(requireAuth);
  router.post("/", validateBody(createProjectBodySchema), asyncHandler(controller.create));
  router.get("/", asyncHandler(controller.list));
  router.get("/:projectId", validateParams(projectParamsSchema), asyncHandler(controller.detail));
  router.post(
    "/:projectId/archive",
    validateParams(projectParamsSchema),
    asyncHandler(controller.archive),
  );
  router.post(
    "/:projectId/restore",
    validateParams(projectParamsSchema),
    asyncHandler(controller.restore),
  );
  router.post(
    "/:projectId/api-keys",
    validateParams(projectParamsSchema),
    validateBody(createApiKeyBodySchema),
    asyncHandler(controller.createApiKey),
  );
  router.get(
    "/:projectId/api-keys",
    validateParams(projectParamsSchema),
    asyncHandler(controller.listApiKeys),
  );
  router.post(
    "/:projectId/api-keys/:apiKeyId/rotate",
    validateParams(apiKeyParamsSchema),
    asyncHandler(controller.rotateApiKey),
  );
  router.post(
    "/:projectId/api-keys/:apiKeyId/disable",
    validateParams(apiKeyParamsSchema),
    asyncHandler(controller.disableApiKey),
  );

  return router;
}

export function createOrganizationRouter(
  controller: ProjectController,
  tokenService: TokenService,
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(tokenService);

  router.use(requireAuth);
  router.post(
    "/",
    validateBody(createOrganizationBodySchema),
    asyncHandler(controller.createOrganization),
  );
  router.get("/", asyncHandler(controller.listOrganizations));
  router.get(
    "/:organizationId/members",
    validateParams(organizationParamsSchema),
    asyncHandler(controller.listOrganizationMembers),
  );
  router.post(
    "/:organizationId/invitations",
    validateParams(organizationParamsSchema),
    validateBody(inviteMemberBodySchema),
    asyncHandler(controller.inviteOrganizationMember),
  );
  router.patch(
    "/:organizationId/members/:memberId/role",
    validateParams(organizationMemberParamsSchema),
    validateBody(updateMemberRoleBodySchema),
    asyncHandler(controller.updateOrganizationMemberRole),
  );
  router.put(
    "/:organizationId/members/:memberId/project-roles/:projectId",
    validateParams(organizationMemberProjectParamsSchema),
    validateBody(setProjectRoleBodySchema),
    asyncHandler(controller.setOrganizationMemberProjectRole),
  );
  router.put(
    "/:organizationId/members/:memberId/environment-permissions/:environment",
    validateParams(organizationMemberEnvironmentParamsSchema),
    validateBody(setEnvironmentPermissionBodySchema),
    asyncHandler(controller.setOrganizationMemberEnvironmentPermission),
  );
  router.delete(
    "/:organizationId/members/:memberId",
    validateParams(organizationMemberParamsSchema),
    asyncHandler(controller.removeOrganizationMember),
  );
  router.post(
    "/:organizationId/personal-access-tokens",
    validateParams(organizationParamsSchema),
    validateBody(createPersonalAccessTokenBodySchema),
    asyncHandler(controller.createPersonalAccessToken),
  );
  router.get(
    "/:organizationId/personal-access-tokens",
    validateParams(organizationParamsSchema),
    asyncHandler(controller.listPersonalAccessTokens),
  );
  router.post(
    "/:organizationId/personal-access-tokens/:tokenId/revoke",
    validateParams(personalAccessTokenParamsSchema),
    asyncHandler(controller.revokePersonalAccessToken),
  );

  return router;
}
