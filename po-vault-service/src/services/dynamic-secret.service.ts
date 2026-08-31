import crypto from "node:crypto";
import type { DynamicDatabaseCredential } from "@pulseops/shared/types";

export class DynamicSecretService {
  private readonly leases: Map<string, DynamicDatabaseCredential & { status: "active" | "revoked" | "expired" }> = new Map();

  public async generateDbCredential(
    projectId: string,
    engine: "postgres" | "mysql" | "mongodb",
    role = "readonly",
    ttlSeconds = 3600,
  ): Promise<DynamicDatabaseCredential> {
    const leaseId = `lease_db_${engine}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const username = `v_${engine}_${role}_${crypto.randomBytes(3).toString("hex")}`;
    const password = `p_${crypto.randomBytes(16).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const cred: DynamicDatabaseCredential & { status: "active" | "revoked" | "expired" } = {
      leaseId,
      projectId,
      engine,
      username,
      password,
      ttlSeconds,
      expiresAt,
      renewable: true,
      createdAt: new Date().toISOString(),
      status: "active",
    };

    this.leases.set(leaseId, cred);
    return cred;
  }

  public async listLeases(projectId: string): Promise<DynamicDatabaseCredential[]> {
    return Array.from(this.leases.values())
      .filter((l) => l.projectId === projectId && l.status === "active")
      .map((l) => ({
        leaseId: l.leaseId,
        projectId: l.projectId,
        engine: l.engine,
        username: l.username,
        password: l.password,
        ttlSeconds: l.ttlSeconds,
        expiresAt: l.expiresAt,
        renewable: l.renewable,
        createdAt: l.createdAt,
      }));
  }

  public async renewLease(projectId: string, leaseId: string, incrementSeconds = 3600): Promise<DynamicDatabaseCredential | null> {
    const cred = this.leases.get(leaseId);
    if (!cred || cred.projectId !== projectId || cred.status !== "active") {
      return null;
    }

    const currentExp = new Date(cred.expiresAt).getTime();
    const nextExp = new Date(Math.max(Date.now(), currentExp) + incrementSeconds * 1000).toISOString();
    cred.expiresAt = nextExp;
    this.leases.set(leaseId, cred);
    return cred;
  }

  public async revokeLease(projectId: string, leaseId: string): Promise<boolean> {
    const cred = this.leases.get(leaseId);
    if (!cred || cred.projectId !== projectId) {
      return false;
    }

    cred.status = "revoked";
    this.leases.set(leaseId, cred);
    return true;
  }
}
