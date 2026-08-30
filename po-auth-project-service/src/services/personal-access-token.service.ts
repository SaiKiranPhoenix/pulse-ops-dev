import { createHash, createHmac, randomBytes } from "node:crypto";
import { notFound } from "@pulseops/shared";
import type {
  PersonalAccessTokenRepository,
  SafePersonalAccessTokenRecord,
} from "../repositories/personal-access-token.repository.js";
import type { AuthEventLogger } from "./auth-event-logger.service.js";
import type { OrganizationService } from "./organization.service.js";

const personalAccessTokenPrefix = "po_pat";
const tokenBytes = 32;
const tokenPrefixLength = 10;
const defaultScopes = ["projects:read", "telemetry:read", "vault:read"] as const;

export type PersonalAccessTokenDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly tokenPrefix: string;
  readonly scopes: string[];
  readonly status: SafePersonalAccessTokenRecord["status"];
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreatedPersonalAccessTokenDto = {
  readonly token: PersonalAccessTokenDto;
  readonly rawToken: string;
};

export class PersonalAccessTokenService {
  constructor(
    private readonly tokens: PersonalAccessTokenRepository,
    private readonly organizations: OrganizationService,
    private readonly pepper: string,
    private readonly authEvents?: AuthEventLogger,
  ) {}

  async create(input: {
    readonly userId: string;
    readonly organizationId: string;
    readonly name: string;
    readonly scopes?: string[] | undefined;
    readonly expiresAt?: Date | null | undefined;
  }): Promise<CreatedPersonalAccessTokenDto> {
    await this.organizations.requireManager(input.userId, input.organizationId);
    const generated = this.generate();
    const token = await this.tokens.create({
      userId: input.userId,
      organizationId: input.organizationId,
      name: input.name.trim(),
      tokenPrefix: generated.tokenPrefix,
      tokenHash: generated.tokenHash,
      scopes: normalizeScopes(input.scopes),
      expiresAt: input.expiresAt ?? null,
    });
    this.authEvents?.record({
      action: "personal_access_token.create",
      status: "success",
      userId: input.userId,
      metadata: { organizationId: input.organizationId },
    });

    return {
      token: toPersonalAccessTokenDto(token),
      rawToken: generated.rawToken,
    };
  }

  async list(userId: string, organizationId: string): Promise<PersonalAccessTokenDto[]> {
    await this.organizations.requireManager(userId, organizationId);
    const tokens = await this.tokens.findByUserOrganization(userId, organizationId);
    return tokens.map(toPersonalAccessTokenDto);
  }

  async revoke(
    tokenId: string,
    userId: string,
    organizationId: string,
  ): Promise<PersonalAccessTokenDto> {
    await this.organizations.requireManager(userId, organizationId);
    const token = await this.tokens.revoke(tokenId, userId, organizationId);

    if (token === null) {
      throw notFound("Personal access token not found");
    }

    this.authEvents?.record({
      action: "personal_access_token.revoke",
      status: "success",
      userId,
      metadata: { organizationId },
    });
    return toPersonalAccessTokenDto(token);
  }

  private generate(): {
    readonly rawToken: string;
    readonly tokenPrefix: string;
    readonly tokenHash: string;
  } {
    const rawToken = `${personalAccessTokenPrefix}_${randomBytes(tokenBytes).toString("base64url")}`;
    const digest = createHash("sha256").update(rawToken).digest("base64url");
    return {
      rawToken,
      tokenPrefix: `${personalAccessTokenPrefix}_${digest.slice(0, tokenPrefixLength)}`,
      tokenHash: createHmac("sha256", this.pepper).update(rawToken).digest("base64url"),
    };
  }
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  const selectedScopes = scopes === undefined || scopes.length === 0 ? defaultScopes : scopes;
  return [...new Set(selectedScopes)].sort();
}

function toPersonalAccessTokenDto(token: SafePersonalAccessTokenRecord): PersonalAccessTokenDto {
  return {
    id: token.id,
    organizationId: token.organizationId,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    scopes: [...token.scopes],
    status: token.status,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    expiresAt: token.expiresAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString(),
    updatedAt: token.updatedAt.toISOString(),
  };
}
