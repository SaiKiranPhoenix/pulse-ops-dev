import type { Request, Response } from "express";
import type { DynamicSecretService } from "../services/dynamic-secret.service.js";
import type { TransitEngineService } from "../services/transit-engine.service.js";
import { VaultSecretModel } from "../models/vault-secret.model.js";

export class VaultEngineController {
  private readonly dynamicSecretService: DynamicSecretService;
  private readonly transitEngineService: TransitEngineService;

  public constructor(
    dynamicSecretService: DynamicSecretService,
    transitEngineService: TransitEngineService,
  ) {
    this.dynamicSecretService = dynamicSecretService;
    this.transitEngineService = transitEngineService;
  }

  // Dynamic Database Credentials
  public generateDynamicDb = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const { engine, role, ttlSeconds } = req.body;
    const cred = await this.dynamicSecretService.generateDbCredential(
      projectId,
      engine,
      role,
      ttlSeconds ? Number(ttlSeconds) : 3600,
    );
    res.status(201).json({ status: "success", data: { credential: cred } });
  };

  public listDynamicDb = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const leases = await this.dynamicSecretService.listLeases(projectId);
    res.status(200).json({ status: "success", data: { leases } });
  };

  public renewDynamicDb = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const leaseId = typeof req.params.leaseId === "string" ? req.params.leaseId : "";
    const { incrementSeconds } = req.body;
    if (!leaseId) {
      res.status(400).json({ status: "error", message: "Lease ID is required" });
      return;
    }
    const renewed = await this.dynamicSecretService.renewLease(
      projectId,
      leaseId,
      incrementSeconds,
    );
    if (!renewed) {
      res.status(404).json({ status: "error", message: "Active lease not found" });
      return;
    }
    res.status(200).json({ status: "success", data: { lease: renewed } });
  };

  public revokeDynamicDb = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const leaseId = typeof req.params.leaseId === "string" ? req.params.leaseId : "";
    if (!leaseId) {
      res.status(400).json({ status: "error", message: "Lease ID is required" });
      return;
    }
    const revoked = await this.dynamicSecretService.revokeLease(projectId, leaseId);
    res.status(200).json({ status: "success", data: { revoked } });
  };

  // Transit Cryptography
  public transitEncrypt = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const { keyName, plaintext } = req.body;
    const result = await this.transitEngineService.encrypt(projectId, keyName, plaintext);
    res.status(200).json({ status: "success", data: result });
  };

  public transitDecrypt = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const { keyName, ciphertext } = req.body;
    const result = await this.transitEngineService.decrypt(projectId, keyName, ciphertext);
    res.status(200).json({ status: "success", data: result });
  };

  public transitRotate = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const keyName = typeof req.params.keyName === "string" ? req.params.keyName : "";
    if (!keyName) {
      res.status(400).json({ status: "error", message: "Key name is required" });
      return;
    }
    const result = await this.transitEngineService.rotateKey(projectId, keyName);
    res.status(200).json({ status: "success", data: result });
  };

  // KV v2 Version & Metadata Operations
  public updateSecretMetadata = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const environment = typeof req.params.environment === "string" ? req.params.environment : "";
    const key = typeof req.params.key === "string" ? req.params.key : "";
    const metadata = req.body;

    const secret = await VaultSecretModel.findOne({ projectId, environment, key });
    if (!secret) {
      res.status(404).json({ status: "error", message: "Secret not found" });
      return;
    }

    secret.metadata = {
      ...(secret.metadata || {}),
      ...metadata,
    };
    await secret.save();

    res.status(200).json({ status: "success", data: { metadata: secret.metadata } });
  };

  public softDeleteVersion = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const environment = typeof req.params.environment === "string" ? req.params.environment : "";
    const key = typeof req.params.key === "string" ? req.params.key : "";
    const version = typeof req.params.version === "string" ? req.params.version : "";
    const verNum = Number(version);

    const secret = await VaultSecretModel.findOne({ projectId, environment, key }).select(
      "+versions",
    );
    if (!secret) {
      res.status(404).json({ status: "error", message: "Secret not found" });
      return;
    }

    const targetVer = secret.versions.find((v) => v.version === verNum);
    if (!targetVer) {
      res.status(404).json({ status: "error", message: `Version ${version} not found` });
      return;
    }

    targetVer.isDeleted = true;
    targetVer.status = "deleted";
    secret.markModified("versions");
    await secret.save();

    res.status(200).json({ status: "success", data: { version: targetVer } });
  };

  public undeleteVersion = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const environment = typeof req.params.environment === "string" ? req.params.environment : "";
    const key = typeof req.params.key === "string" ? req.params.key : "";
    const version = typeof req.params.version === "string" ? req.params.version : "";
    const verNum = Number(version);

    const secret = await VaultSecretModel.findOne({ projectId, environment, key }).select(
      "+versions",
    );
    if (!secret) {
      res.status(404).json({ status: "error", message: "Secret not found" });
      return;
    }

    const targetVer = secret.versions.find((v) => v.version === verNum);
    if (!targetVer) {
      res.status(404).json({ status: "error", message: `Version ${version} not found` });
      return;
    }

    targetVer.isDeleted = false;
    targetVer.status = "rotated";
    secret.markModified("versions");
    await secret.save();

    res.status(200).json({ status: "success", data: { version: targetVer } });
  };

  public destroyVersion = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const environment = typeof req.params.environment === "string" ? req.params.environment : "";
    const key = typeof req.params.key === "string" ? req.params.key : "";
    const version = typeof req.params.version === "string" ? req.params.version : "";
    const verNum = Number(version);

    const secret = await VaultSecretModel.findOne({ projectId, environment, key }).select(
      "+versions",
    );
    if (!secret) {
      res.status(404).json({ status: "error", message: "Secret not found" });
      return;
    }

    const targetVer = secret.versions.find((v) => v.version === verNum);
    if (!targetVer) {
      res.status(404).json({ status: "error", message: `Version ${version} not found` });
      return;
    }

    targetVer.destroyedAt = new Date();
    targetVer.status = "destroyed";
    secret.markModified("versions");
    await secret.save();

    res.status(200).json({ status: "success", data: { version: targetVer } });
  };
}
