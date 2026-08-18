import type { LoginUserResult, SessionService } from "./session.service.js";
import type { OAuthProviderClient } from "./oauth-provider.service.js";
import type { OAuthStateService } from "./oauth-state.service.js";
import type { OAuthProvider } from "../models/user.model.js";

export type OAuthCallbackInput = {
  readonly provider: OAuthProvider;
  readonly code: string;
  readonly state: string;
};

export class OAuthService {
  constructor(
    private readonly callbackBaseUrl: string,
    private readonly successRedirectUrl: string,
    private readonly failureRedirectUrl: string,
    private readonly states: OAuthStateService,
    private readonly providers: OAuthProviderClient,
    private readonly sessions: SessionService,
  ) {}

  createProviderRedirectUrl(provider: OAuthProvider): string {
    const state = this.states.create(provider);
    return this.providers
      .createAuthorizationUrl({
        provider,
        redirectUri: this.createProviderCallbackUrl(provider),
        state,
      })
      .toString();
  }

  async completeCallback(input: OAuthCallbackInput): Promise<LoginUserResult> {
    this.states.verify(input.state, input.provider);
    const profile = await this.providers.exchangeCodeForProfile({
      provider: input.provider,
      code: input.code,
      redirectUri: this.createProviderCallbackUrl(input.provider),
    });

    return this.sessions.loginWithOAuth(profile);
  }

  createSuccessRedirectUrl(session: LoginUserResult): string {
    const redirectUrl = new URL(this.successRedirectUrl);
    redirectUrl.hash = new URLSearchParams({
      access_token: session.accessToken,
      token_type: session.tokenType,
    }).toString();
    return redirectUrl.toString();
  }

  createFailureRedirectUrl(): string {
    const redirectUrl = new URL(this.failureRedirectUrl);
    redirectUrl.searchParams.set("oauth_error", "OAuth sign-in failed");
    return redirectUrl.toString();
  }

  private createProviderCallbackUrl(provider: OAuthProvider): string {
    return new URL(
      `/auth/oauth/${provider}/callback`,
      ensureTrailingSlash(this.callbackBaseUrl),
    ).toString();
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
