import { AuthController } from "../../src/controllers/auth.controller.js";
import { ProjectController } from "../../src/controllers/project.controller.js";
import type {
  ApiKeyRepository,
  CreateApiKeyRecordInput,
  SafeApiKeyRecord,
} from "../../src/repositories/api-key.repository.js";
import type {
  CreateProjectRecordInput,
  ProjectRepository,
  SafeProjectRecord,
} from "../../src/repositories/project.repository.js";
import type {
  CreateUserRecordInput,
  SafeUserRecord,
  UserRepository,
  UserWithPasswordHashRecord,
} from "../../src/repositories/user.repository.js";
import { HmacApiKeyHasher } from "../../src/services/api-key-hasher.service.js";
import { ApiKeyService } from "../../src/services/api-key.service.js";
import type { PasswordHasher } from "../../src/services/password-hasher.service.js";
import { ProjectService } from "../../src/services/project.service.js";
import { SessionService } from "../../src/services/session.service.js";
import { HmacJwtTokenService } from "../../src/services/token.service.js";
import { UserRegistrationService } from "../../src/services/user-registration.service.js";
import type { AuthProjectServiceDependencies } from "../../src/services/dependencies.js";

const fixedDate = new Date("2026-08-18T00:00:00.000Z");

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserWithPasswordHashRecord>();
  readonly createdInputs: CreateUserRecordInput[] = [];

  seed(user: UserWithPasswordHashRecord): void {
    this.users.set(user.email, user);
  }

  async findById(id: string): Promise<SafeUserRecord | null> {
    const user = [...this.users.values()].find((candidate) => candidate.id === id);
    return user === undefined ? null : toSafeUser(user);
  }

  async findByEmail(email: string): Promise<SafeUserRecord | null> {
    const user = this.users.get(email);
    return user === undefined ? null : toSafeUser(user);
  }

  async findByEmailWithPasswordHash(email: string): Promise<UserWithPasswordHashRecord | null> {
    return this.users.get(email) ?? null;
  }

  async create(input: CreateUserRecordInput): Promise<SafeUserRecord> {
    this.createdInputs.push(input);

    const user: UserWithPasswordHashRecord = {
      id: createObjectId(this.users.size + 1),
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      status: "active",
      createdAt: fixedDate,
      updatedAt: fixedDate,
    };

    this.users.set(input.email, user);
    return toSafeUser(user);
  }
}

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, SafeProjectRecord>();

  async create(input: CreateProjectRecordInput): Promise<SafeProjectRecord> {
    const project: SafeProjectRecord = {
      id: createObjectId(this.projects.size + 20),
      ownerId: input.ownerId,
      name: input.name,
      slug: input.slug,
      status: "active",
      createdAt: fixedDate,
      updatedAt: fixedDate,
    };

    this.projects.set(project.id, project);
    return project;
  }

  async findByIdForOwner(projectId: string, ownerId: string): Promise<SafeProjectRecord | null> {
    const project = this.projects.get(projectId);
    return project?.ownerId === ownerId ? project : null;
  }

  async findByOwner(ownerId: string): Promise<SafeProjectRecord[]> {
    return [...this.projects.values()].filter((project) => project.ownerId === ownerId);
  }

  async findBySlugForOwner(slug: string, ownerId: string): Promise<SafeProjectRecord | null> {
    return (
      [...this.projects.values()].find(
        (project) => project.slug === slug && project.ownerId === ownerId,
      ) ?? null
    );
  }
}

export class InMemoryApiKeyRepository implements ApiKeyRepository {
  private readonly keys = new Map<string, SafeApiKeyRecord>();

  async create(input: CreateApiKeyRecordInput): Promise<SafeApiKeyRecord> {
    const apiKey: SafeApiKeyRecord = {
      id: createObjectId(this.keys.size + 40),
      ownerId: input.ownerId,
      projectId: input.projectId,
      name: input.name,
      keyPrefix: input.keyPrefix,
      scopes: [...input.scopes],
      status: "active",
      lastUsedAt: null,
      expiresAt: input.expiresAt,
      createdAt: fixedDate,
      updatedAt: fixedDate,
    };

    this.keys.set(apiKey.id, apiKey);
    return apiKey;
  }

  async findByIdForProject(apiKeyId: string, projectId: string): Promise<SafeApiKeyRecord | null> {
    const apiKey = this.keys.get(apiKeyId);
    return apiKey?.projectId === projectId ? apiKey : null;
  }

  async findByProject(projectId: string): Promise<SafeApiKeyRecord[]> {
    return [...this.keys.values()].filter((apiKey) => apiKey.projectId === projectId);
  }

  async disable(apiKeyId: string, projectId: string): Promise<SafeApiKeyRecord | null> {
    const apiKey = await this.findByIdForProject(apiKeyId, projectId);

    if (apiKey === null) {
      return null;
    }

    const disabledApiKey = { ...apiKey, status: "disabled" as const, updatedAt: fixedDate };
    this.keys.set(apiKey.id, disabledApiKey);
    return disabledApiKey;
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    return storedHash === `hashed:${password}`;
  }
}

export type TestDependencyHarness = {
  readonly dependencies: AuthProjectServiceDependencies;
  readonly users: InMemoryUserRepository;
  readonly projects: InMemoryProjectRepository;
  readonly keys: InMemoryApiKeyRepository;
};

export function createTestDependencies(): TestDependencyHarness {
  const users = new InMemoryUserRepository();
  const projects = new InMemoryProjectRepository();
  const keys = new InMemoryApiKeyRepository();
  const passwordHasher = new FakePasswordHasher();
  const tokenService = new HmacJwtTokenService(validJwtSecret(), 3600);
  const userRegistrationService = new UserRegistrationService(users, passwordHasher);
  const sessionService = new SessionService(users, passwordHasher, tokenService);
  const projectService = new ProjectService(projects);
  const apiKeyService = new ApiKeyService(
    projects,
    keys,
    new HmacApiKeyHasher(validApiKeyPepper()),
  );

  return {
    dependencies: {
      authController: new AuthController(userRegistrationService, sessionService),
      projectController: new ProjectController(projectService, apiKeyService),
      userRegistrationService,
      sessionService,
      projectService,
      apiKeyService,
      tokenService,
    },
    users,
    projects,
    keys,
  };
}

export function validTestCredential(): string {
  return ["Secure", "Pass", "123", "!"].join("");
}

export function registeredUser(overrides: Partial<UserWithPasswordHashRecord> = {}) {
  const password = validTestCredential();

  return {
    id: createObjectId(1),
    email: "existing@example.com",
    name: null,
    passwordHash: `hashed:${password}`,
    status: "active" as const,
    createdAt: fixedDate,
    updatedAt: fixedDate,
    ...overrides,
  };
}

export function createObjectId(seed: number): string {
  return seed.toString(16).padStart(24, "0").slice(0, 24);
}

function toSafeUser(user: UserWithPasswordHashRecord): SafeUserRecord {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function validJwtSecret(): string {
  return ["local", "test", "jwt", "signing", "value", "minimum", "length"].join("-");
}

function validApiKeyPepper(): string {
  return ["local", "test", "api", "key", "pepper", "minimum", "length"].join("-");
}
