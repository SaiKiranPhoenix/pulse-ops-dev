import mongoose from "mongoose";
import { dependencyUnavailable } from "@pulseops/shared";

export async function connectMongo(mongodbUri: string): Promise<typeof mongoose> {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(mongodbUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5_000,
    });

    return mongoose;
  } catch (error) {
    throw dependencyUnavailable("MongoDB connection failed", {
      dependency: "mongodb",
      cause: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
