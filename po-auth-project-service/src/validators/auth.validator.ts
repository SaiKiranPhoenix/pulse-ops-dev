import { z } from "zod";
import { USER_LIMITS } from "../config/constants.js";

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
