import type {
  PolicySimulationInput,
  PolicySimulationResult,
  VaultPolicy,
  VaultPolicyRule,
} from "@pulseops/shared/types";
import { PolicyEvaluationEngine } from "./policy-evaluation.engine.js";

export class VaultPolicyService {
  private readonly engine: PolicyEvaluationEngine;
  private readonly inMemoryPolicies: Map<string, VaultPolicy[]> = new Map();

  public constructor(engine = new PolicyEvaluationEngine()) {
    this.engine = engine;
    this.seedDefaultPolicies("default");
    this.seedDefaultPolicies("project_1");
  }

  private seedDefaultPolicies(projectId: string): void {
    const defaults: VaultPolicy[] = [
      {
        id: `pol_admin_${projectId}`,
        projectId,
        name: "admin-root-policy",
        description: "Full administrative and sudo permissions across all secret engines and sys paths.",
        rules: [
          { path: "secret/*", capabilities: ["create", "read", "update", "delete", "list", "sudo"] },
          { path: "sys/*", capabilities: ["create", "read", "update", "delete", "list", "sudo"] },
          { path: "transit/*", capabilities: ["create", "read", "update", "delete", "list", "sudo"] },
          { path: "database/*", capabilities: ["create", "read", "update", "delete", "list", "sudo"] },
        ],
        version: 1,
        isDefault: true,
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `pol_dev_${projectId}`,
        projectId,
        name: "developer-read-policy",
        description: "Read & list permissions for development and staging environments.",
        rules: [
          { path: "secret/data/development/*", capabilities: ["read", "list", "create", "update"] },
          { path: "secret/data/staging/*", capabilities: ["read", "list"] },
          { path: "secret/data/production/*", capabilities: ["deny"], description: "Production secrets strictly blocked" },
          { path: "transit/encrypt/*", capabilities: ["update"] },
        ],
        version: 1,
        isDefault: true,
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `pol_ci_${projectId}`,
        projectId,
        name: "ci-deployer-policy",
        description: "Automated deployment token permissions for staging and production runtime variables.",
        rules: [
          { path: "secret/data/staging/*", capabilities: ["read", "list"] },
          { path: "secret/data/production/*", capabilities: ["read"], description: "Read-only for runtime configs" },
          { path: "database/creds/*", capabilities: ["read"] },
        ],
        version: 1,
        isDefault: false,
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    this.inMemoryPolicies.set(projectId, defaults);
  }

  public async listPolicies(projectId: string): Promise<VaultPolicy[]> {
    if (!this.inMemoryPolicies.has(projectId)) {
      this.seedDefaultPolicies(projectId);
    }
    return this.inMemoryPolicies.get(projectId) || [];
  }

  public async getPolicy(projectId: string, id: string): Promise<VaultPolicy | null> {
    const list = await this.listPolicies(projectId);
    return list.find((p) => p.id === id || p.name === id) || null;
  }

  public async createPolicy(
    projectId: string,
    input: { name: string; description?: string; rules: VaultPolicyRule[]; isDefault?: boolean },
    actorId = "admin",
  ): Promise<VaultPolicy> {
    const list = await this.listPolicies(projectId);
    const existing = list.find((p) => p.name.toLowerCase() === input.name.trim().toLowerCase());
    if (existing) {
      throw new Error(`Policy with name '${input.name}' already exists.`);
    }

    const newPolicy: VaultPolicy = {
      id: `pol_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      projectId,
      name: input.name.trim(),
      description: input.description?.trim() || "",
      rules: input.rules,
      version: 1,
      isDefault: Boolean(input.isDefault),
      history: [
        {
          version: 1,
          rules: input.rules,
          modifiedBy: actorId,
          modifiedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    list.push(newPolicy);
    this.inMemoryPolicies.set(projectId, list);
    return newPolicy;
  }

  public async updatePolicy(
    projectId: string,
    id: string,
    input: { name?: string; description?: string; rules?: VaultPolicyRule[]; isDefault?: boolean },
    actorId = "admin",
  ): Promise<VaultPolicy | null> {
    const list = await this.listPolicies(projectId);
    const index = list.findIndex((p) => p.id === id || p.name === id);
    if (index === -1) return null;

    const current = list[index];
    if (!current) return null;

    const nextVersion = current.version + 1;
    const nextRules = input.rules || current.rules;

    const updated: VaultPolicy = {
      ...current,
      name: input.name ? input.name.trim() : current.name,
      description: input.description !== undefined ? input.description.trim() : (current.description ?? ""),
      rules: nextRules,
      isDefault: input.isDefault !== undefined ? input.isDefault : current.isDefault,
      version: nextVersion,
      history: [
        ...(current.history || []),
        {
          version: nextVersion,
          rules: nextRules,
          modifiedBy: actorId,
          modifiedAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.inMemoryPolicies.set(projectId, list);
    return updated;
  }

  public async deletePolicy(projectId: string, id: string): Promise<boolean> {
    const list = await this.listPolicies(projectId);
    const filtered = list.filter((p) => p.id !== id && p.name !== id);
    if (filtered.length === list.length) return false;
    this.inMemoryPolicies.set(projectId, filtered);
    return true;
  }

  public async simulate(input: PolicySimulationInput): Promise<PolicySimulationResult> {
    const policies = await this.listPolicies(input.projectId);
    return this.engine.simulate(input, policies);
  }
}
