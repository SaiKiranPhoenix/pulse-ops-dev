import type { Request, Response } from "express";
import type { GatewayService } from "../services/gateway.service.js";

export class GatewayController {
  constructor(private readonly gateway: GatewayService) {}

  health = async (_request: Request, response: Response): Promise<void> => {
    const health = await this.gateway.health();
    response.status(health.status === "ok" ? 200 : 503).json(health);
  };

  openApi = async (_request: Request, response: Response): Promise<void> => {
    response.status(200).json(this.gateway.openApi());
  };
}
