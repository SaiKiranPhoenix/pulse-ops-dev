import { z } from "zod";
import { OAUTH_LIMITS, USER_LIMITS } from "../config/constants.js";

export const registerUserBodySchema = z.object({
  email: z.email().trim().toLowerCase().max(320),
  password: z
    .string()
    .min(USER_LIMITS.passwordMinLength)
    .max(USER_LIMITS.passwordMaxLength)
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number")
    .regex(/[^A-Za-z0-9]/, "Password must include a symbol"),
  name: z.string().trim().min(1).max(USER_LIMITS.nameMaxLength).optional(),
});

export type RegisterUserBody = z.infer<typeof registerUserBodySchema>;

export const loginUserBodySchema = z.object({
  email: z.email().trim().toLowerCase().max(320),
  password: z.string().min(1).max(USER_LIMITS.passwordMaxLength),
});

export type LoginUserBody = z.infer<typeof loginUserBodySchema>;

export const updateCurrentUserBodySchema = z.object({
  name: z.string().trim().min(1).max(USER_LIMITS.nameMaxLength).nullable(),
});

export type UpdateCurrentUserBody = z.infer<typeof updateCurrentUserBodySchema>;

export const oauthProviderParamsSchema = z.object({
  provider: z.enum(OAUTH_LIMITS.providers),
});

export type OAuthProviderParams = z.infer<typeof oauthProviderParamsSchema>;

export const oauthCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).max(4096),
  state: z.string().trim().min(16).max(2048),
});

export type OAuthCallbackQuery = z.infer<typeof oauthCallbackQuerySchema>;
