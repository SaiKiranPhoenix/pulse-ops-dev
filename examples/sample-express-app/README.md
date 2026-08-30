# Sample Express App with PulseOps SDK

This is a demonstration service showing how to instrument an Express.js application and background jobs using `@pulseops/node-sdk`.

## Quick Start

### 1. Environment Variables

Create `.env` or pass environment variables:

```bash
PULSEOPS_API_KEY=your_ingestion_api_key_here
PULSEOPS_ENDPOINT=http://localhost:4000
SERVICE_NAME=sample-express-app
PORT=3005
```

### 2. Run the App

```bash
node server.mjs
```

### 3. Test Endpoints

- **Fetch Orders**:
  ```bash
  curl http://localhost:3005/api/orders
  ```
- **Place Checkout (Custom Business Metrics)**:
  ```bash
  curl -X POST http://localhost:3005/api/checkout \
    -H "Content-Type: application/json" \
    -d '{"items": 3, "amount": 149.99, "customerEmail": "customer@example.com"}'
  ```
- **Run Background Job (`instrumentJob`)**:
  ```bash
  curl -X POST http://localhost:3005/api/background-job
  ```
- **Trigger Unhandled Error Capture**:
  ```bash
  curl http://localhost:3005/api/error
  ```

Observe all telemetry appearing automatically in the PulseOps dashboard under **Logs**, **Metrics**, **Errors**, and the **Service Catalog**.
