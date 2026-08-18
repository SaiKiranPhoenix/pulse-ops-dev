import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import type { RegisterUserBody } from "../validators/auth.validator.js";
import type { UserRegistrationService } from "../services/user-registration.service.js";

export class AuthController {
  constructor(private readonly userRegistration: UserRegistrationService) {}

  register = async (_request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as RegisterUserBody;
    const user = await this.userRegistration.register(body);

    response.status(201).json(
      successResponse(
        {
          user,
        },
        String(response.locals.requestId),
      ),
    );
  };
}
