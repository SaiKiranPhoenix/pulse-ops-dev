import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import { getAuthContext } from "../middlewares/auth.middleware.js";
import type {
  LoginUserBody,
  OAuthCallbackQuery,
  OAuthProviderParams,
  RegisterUserBody,
} from "../validators/auth.validator.js";
import type { OAuthService } from "../services/oauth.service.js";
import type { SessionService } from "../services/session.service.js";
import type { UserRegistrationService } from "../services/user-registration.service.js";

export class AuthController {
  constructor(
    private readonly userRegistration: UserRegistrationService,
    private readonly sessions: SessionService,
    private readonly oauth: OAuthService,
  ) {}

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

  login = async (_request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as LoginUserBody;
    const session = await this.sessions.login(body);

    response.status(200).json(successResponse(session, String(response.locals.requestId)));
  };

  currentUser = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const user = await this.sessions.getCurrentUser(auth.userId);

    response.status(200).json(
      successResponse(
        {
          user,
        },
        String(response.locals.requestId),
      ),
    );
  };

  oauthStart = async (_request: Request, response: Response): Promise<void> => {
    const { provider } = response.locals.validatedParams as OAuthProviderParams;
    response.redirect(302, this.oauth.createProviderRedirectUrl(provider));
  };

  oauthCallback = async (_request: Request, response: Response): Promise<void> => {
    const { provider } = response.locals.validatedParams as OAuthProviderParams;
    const query = response.locals.validatedQuery as OAuthCallbackQuery;

    try {
      const session = await this.oauth.completeCallback({
        provider,
        code: query.code,
        state: query.state,
      });

      response.redirect(302, this.oauth.createSuccessRedirectUrl(session));
    } catch {
      response.redirect(302, this.oauth.createFailureRedirectUrl());
    }
  };
}
