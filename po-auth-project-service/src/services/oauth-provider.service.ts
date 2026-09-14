import { badRequest, dependencyUnavailable, unauthorized } from "@pulseops/shared";
import type { OAuthProvider } from "../models/user.model.js";

const googleAuthorizationUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenUrl = "https://oauth2.googleapis.com/token";
const googleUserInfoUrl = "https://openidconnect.googleapis.com/v1/userinfo";
const githubAuthorizationUrl = "https://github.com/login/oauth/authorize";
const githubTokenUrl = "https://github.com/login/oauth/access_token";
const githubUserUrl = "https://api.github.com/user";
const githubEmailUrl = "https://api.github.com/user/emails";

export type OAuthProviderCredentials = {
  readonly clientId?: string | undefined;
  readonly clientSecret?: string | undefined;
};

type ConfiguredOAuthProviderCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export type OAuthProviderConfig = Record<OAuthProvider, OAuthProviderCredentials>;

export type OAuthProfile = {
  readonly provider: OAuthProvider;
  readonly providerUserId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string | null;
};

export interface OAuthProviderClient {
  createAuthorizationUrl(input: {
    readonly provider: OAuthProvider;
    readonly redirectUri: string;
    readonly state: string;
  }): URL;
  exchangeCodeForProfile(input: {
    readonly provider: OAuthProvider;
    readonly code: string;
    readonly redirectUri: string;
  }): Promise<OAuthProfile>;
}

export class FetchOAuthProviderClient implements OAuthProviderClient {
  constructor(private readonly config: OAuthProviderConfig) {}

  createAuthorizationUrl(input: {
    readonly provider: OAuthProvider;
    readonly redirectUri: string;
    readonly state: string;
  }): URL {
    const credentials = this.getConfiguredCredentials(input.provider);

    if (input.provider === "google") {
      const url = new URL(googleAuthorizationUrl);
      url.searchParams.set("client_id", credentials.clientId);
      url.searchParams.set("redirect_uri", input.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", input.state);
      url.searchParams.set("access_type", "online");
      url.searchParams.set("prompt", "select_account");
      return url;
    }

    const url = new URL(githubAuthorizationUrl);
    url.searchParams.set("client_id", credentials.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", input.state);
    return url;
  }

  async exchangeCodeForProfile(input: {
    readonly provider: OAuthProvider;
    readonly code: string;
    readonly redirectUri: string;
  }): Promise<OAuthProfile> {
    const credentials = this.getConfiguredCredentials(input.provider);

    if (input.provider === "google") {
      return this.exchangeGoogleCode(input.code, input.redirectUri, credentials);
    }

    return this.exchangeGithubCode(input.code, input.redirectUri, credentials);
  }

  private async exchangeGoogleCode(
    code: string,
    redirectUri: string,
    credentials: ConfiguredOAuthProviderCredentials,
  ): Promise<OAuthProfile> {
    const tokenResponse = await fetchJson(googleTokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const accessToken = readAccessToken(tokenResponse);
    const userInfo = await fetchJson(googleUserInfoUrl, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const profile = parseGoogleProfile(userInfo);

    if (!profile.emailVerified) {
      throw unauthorized("Verified email is required for OAuth sign-in");
    }

    return profile;
  }

  private async exchangeGithubCode(
    code: string,
    redirectUri: string,
    credentials: ConfiguredOAuthProviderCredentials,
  ): Promise<OAuthProfile> {
    const tokenResponse = await fetchJson(githubTokenUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const accessToken = readAccessToken(tokenResponse);
    const user = await fetchJson(githubUserUrl, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${accessToken}`,
      },
    });
    const emails = await fetchJson(githubEmailUrl, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${accessToken}`,
      },
    });

    return parseGithubProfile(user, emails);
  }

  private getConfiguredCredentials(provider: OAuthProvider): ConfiguredOAuthProviderCredentials {
    const credentials = this.config[provider];

    if (credentials.clientId === undefined || credentials.clientSecret === undefined) {
      throw badRequest("OAuth provider is not configured");
    }

    return {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
    };
  }
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  let response: globalThis.Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    throw dependencyUnavailable("OAuth provider unavailable", {
      cause: error instanceof Error ? error.message : "unknown",
    });
  }

  if (!response.ok) {
    throw unauthorized("OAuth provider authentication failed");
  }

  try {
    return await response.json();
  } catch {
    throw unauthorized("OAuth provider authentication failed");
  }
}

function readAccessToken(value: unknown): string {
  if (!isRecord(value) || typeof value.access_token !== "string") {
    throw unauthorized("OAuth provider authentication failed");
  }

  return value.access_token;
}

function parseGoogleProfile(value: unknown): OAuthProfile {
  if (
    !isRecord(value) ||
    typeof value.sub !== "string" ||
    typeof value.email !== "string" ||
    typeof value.email_verified !== "boolean"
  ) {
    throw unauthorized("OAuth provider authentication failed");
  }

  return {
    provider: "google",
    providerUserId: value.sub,
    email: value.email,
    emailVerified: value.email_verified,
    name: readOptionalName(value.name),
  };
}

function parseGithubProfile(user: unknown, emails: unknown): OAuthProfile {
  if (!isRecord(user) || (typeof user.id !== "number" && typeof user.id !== "string")) {
    throw unauthorized("OAuth provider authentication failed");
  }

  if (!Array.isArray(emails)) {
    throw unauthorized("OAuth provider authentication failed");
  }

  const verifiedEmail =
    emails.find(isPrimaryVerifiedGithubEmail) ?? emails.find(isVerifiedGithubEmail);

  if (verifiedEmail === undefined) {
    throw unauthorized("Verified email is required for OAuth sign-in");
  }

  return {
    provider: "github",
    providerUserId: String(user.id),
    email: verifiedEmail.email,
    emailVerified: true,
    name: readOptionalName(user.name) ?? readOptionalName(user.login),
  };
}

function isVerifiedGithubEmail(value: unknown): value is {
  readonly email: string;
  readonly verified: boolean;
  readonly primary?: boolean;
} {
  return isRecord(value) && typeof value.email === "string" && value.verified === true;
}

function isPrimaryVerifiedGithubEmail(value: unknown): value is {
  readonly email: string;
  readonly verified: boolean;
  readonly primary: boolean;
} {
  return isVerifiedGithubEmail(value) && value.primary === true;
}

function readOptionalName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
