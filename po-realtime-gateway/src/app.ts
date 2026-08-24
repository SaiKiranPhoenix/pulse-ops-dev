import { createServer, type Server as HttpServer } from "node:http";
import express, { type Express } from "express";
import { Server as SocketIoServer, type Socket } from "socket.io";
import { z } from "zod";
import { toProjectRoom } from "@pulseops/shared";
import { SOCKET_EVENTS } from "./config/constants.js";
import type { ProjectAuthorizationRepository } from "./repositories/project-authorization.repository.js";
import { AccessTokenService } from "./services/access-token.service.js";
import { RealtimeEventService } from "./services/realtime-event.service.js";

const projectRoomPayloadSchema = z.object({
  projectId: z.string().trim().min(1).max(128),
});

export type SocketAck = (response: { readonly ok: boolean; readonly error?: string }) => void;

export type CreateRealtimeGatewayOptions = {
  readonly jwtSecret: string;
  readonly allowedOrigins: readonly string[];
  readonly projectAuthorization: ProjectAuthorizationRepository;
};

export type RealtimeGateway = {
  readonly app: Express;
  readonly httpServer: HttpServer;
  readonly io: SocketIoServer;
  readonly realtimeEvents: RealtimeEventService;
  close(): Promise<void>;
};

export function createRealtimeGateway(options: CreateRealtimeGatewayOptions): RealtimeGateway {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIoServer(httpServer, {
    cors: {
      origin: [...options.allowedOrigins],
      credentials: true,
    },
  });
  const accessTokens = new AccessTokenService(options.jwtSecret);

  app.disable("x-powered-by");
  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  io.use((socket, next) => {
    try {
      const token = extractSocketToken(socket);
      const claims = accessTokens.verify(token);
      socket.data.userId = claims.sub;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on(SOCKET_EVENTS.joinProject, (payload: unknown, acknowledge?: SocketAck) => {
      void handleProjectJoin(socket, payload, options.projectAuthorization, acknowledge);
    });

    socket.on(SOCKET_EVENTS.leaveProject, (payload: unknown, acknowledge?: SocketAck) => {
      handleProjectLeave(socket, payload, acknowledge);
    });
  });

  return {
    app,
    httpServer,
    io,
    realtimeEvents: new RealtimeEventService(io),
    async close(): Promise<void> {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

async function handleProjectJoin(
  socket: Socket,
  payload: unknown,
  projectAuthorization: ProjectAuthorizationRepository,
  acknowledge?: SocketAck,
): Promise<void> {
  const parsedPayload = projectRoomPayloadSchema.safeParse(payload);

  if (!parsedPayload.success) {
    acknowledge?.({ ok: false, error: "Invalid project room" });
    return;
  }

  const userId = getSocketUserId(socket);
  const canAccessProject = await projectAuthorization.canAccessProject(
    parsedPayload.data.projectId,
    userId,
  );

  if (!canAccessProject) {
    acknowledge?.({ ok: false, error: "Project access denied" });
    return;
  }

  const room = toProjectRoom(parsedPayload.data.projectId);
  await socket.join(room);
  socket.emit(SOCKET_EVENTS.joinedProject, { projectId: parsedPayload.data.projectId });
  acknowledge?.({ ok: true });
}

function handleProjectLeave(socket: Socket, payload: unknown, acknowledge?: SocketAck): void {
  const parsedPayload = projectRoomPayloadSchema.safeParse(payload);

  if (!parsedPayload.success) {
    acknowledge?.({ ok: false, error: "Invalid project room" });
    return;
  }

  socket.leave(toProjectRoom(parsedPayload.data.projectId));
  socket.emit(SOCKET_EVENTS.leftProject, { projectId: parsedPayload.data.projectId });
  acknowledge?.({ ok: true });
}

function extractSocketToken(socket: Socket): string {
  const authToken = socket.handshake.auth.token;

  if (typeof authToken === "string" && authToken.length > 0) {
    return authToken;
  }

  const authorizationHeader = socket.handshake.headers.authorization;

  if (typeof authorizationHeader === "string") {
    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme === "Bearer" && token !== undefined && token.length > 0) {
      return token;
    }
  }

  throw new Error("Authentication required");
}

function getSocketUserId(socket: Socket): string {
  const userId = socket.data.userId;

  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("Socket is not authenticated");
  }

  return userId;
}
