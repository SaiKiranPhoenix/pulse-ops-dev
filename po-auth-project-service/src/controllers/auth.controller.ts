import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import { getAuthContext } from "../middlewares/auth.middleware.js";
import type {
  LoginUserBody,
  OAuthCallbackQuery,
  OAuthProviderParams,
  RegisterUserBody,
  UpdateCurrentUserBody,
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
    const session = this.sessions.issueSessionForRegisteredUser(user);

    response.status(201).json(successResponse(session, String(response.locals.requestId)));
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

  updateCurrentUser = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const body = response.locals.validatedBody as UpdateCurrentUserBody;
    const user = await this.sessions.updateCurrentUser(auth.userId, {
      name: body.name,
    });

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

    try {
      response.redirect(302, this.oauth.createProviderRedirectUrl(provider));
    } catch (error) {
      response.redirect(
        302,
        this.oauth.createFailureRedirectUrl(toOAuthStartFailureMessage(error)),
      );
    }
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

function toOAuthStartFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message === "OAuth provider is not configured") {
    return error.message;
  }

  return "OAuth sign-in failed";
}
