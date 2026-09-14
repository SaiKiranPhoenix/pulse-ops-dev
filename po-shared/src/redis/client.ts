import { createClient } from "redis";

export type PulseRedisClient = ReturnType<typeof createClient>;

export function createRedisClient(url: string): PulseRedisClient {
  return createClient({ url });
}

export async function connectRedisClient(client: PulseRedisClient): Promise<PulseRedisClient> {
  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

export async function closeRedisClient(client: PulseRedisClient): Promise<void> {
  if (client.isOpen) {
    await client.quit();
  }
}
