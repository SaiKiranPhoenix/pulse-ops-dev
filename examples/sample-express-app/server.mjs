import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import express from "express";
import {
  initPulseOps,
  createPulseOpsMiddleware,
  createPulseOpsErrorHandler,
  instrumentJob,
} from "@pulseops/node-sdk";

const app = express();
const port = Number(process.env.PORT || 3005);

// 1. Initialize PulseOps SDK with configuration
const pulseOps = initPulseOps({
  apiKey: process.env.PULSEOPS_API_KEY || "demo_ingestion_key",
  endpoint: process.env.PULSEOPS_ENDPOINT || "http://localhost:4000",
  serviceName: process.env.SERVICE_NAME || "sample-express-app",
  environment: process.env.NODE_ENV || "production",
  batchSize: 10,
  flushIntervalMs: 1500,
});

app.use(express.json());

// 2. Attach PulseOps request logging & latency metrics middleware
app.use(
  createPulseOpsMiddleware(pulseOps, {
    ignorePath: (path) => path === "/health",
  }),
);

// Health Check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "sample-express-app", uptime: process.uptime() });
});

// Sample Resource Endpoint
app.get("/api/orders", (_req, res) => {
  const orders = [
    { id: "ord_101", customer: "Alice", total: 49.99, status: "completed" },
    { id: "ord_102", customer: "Bob", total: 120.0, status: "pending" },
  ];

  pulseOps.info("Fetched active orders list", { count: orders.length });
  res.json({ orders });
});

// Checkout with Custom Business Metric Tracking
app.post("/api/checkout", (req, res) => {
  const { items = 1, amount = 99.0, customerEmail = "test@example.com" } = req.body || {};

  pulseOps.info("Processing customer checkout", {
    items,
    amount,
    customerEmail, // Automatically redacted if sensitive
  });

  // Track business metrics
  pulseOps.increment("orders_placed_total", 1, { payment_type: "credit_card" });
  pulseOps.gauge("last_order_amount_dollars", Number(amount));

  res.status(201).json({
    orderId: `ord_${Date.now()}`,
    status: "confirmed",
    items,
    amount,
  });
});

// Simulated Background Job
app.post("/api/background-job", async (_req, res) => {
  try {
    const result = await instrumentJob(
      pulseOps,
      "generate_monthly_invoices",
      async () => {
        // Simulate async processing
        await delay(150);
        return { generatedCount: 42, processedAt: new Date().toISOString() };
      },
      { queueName: "billing-invoices" },
    );

    res.json({ success: true, result });
  } catch {
    res.status(500).json({ error: "Background job execution failed" });
  }
});

// Intentional Exception for Error Tracking
app.get("/api/error", (_req, _res, next) => {
  const err = new Error("Simulated payment gateway timeout error in sample app");
  err.name = "PaymentGatewayTimeoutError";
  next(err);
});

// 3. Attach PulseOps Error Handler to capture unhandled exceptions
app.use(createPulseOpsErrorHandler(pulseOps));

// Fallback Generic Error Handler
app.use((err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    error: {
      message: err.message || "Internal Server Error",
      name: err.name || "Error",
    },
  });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[Sample App] Running on http://localhost:${port}`);
    // eslint-disable-next-line no-console
    console.log(`[Sample App] Instrumented with PulseOps SDK -> ${pulseOps.endpoint}`);
  });
}

export default app;
