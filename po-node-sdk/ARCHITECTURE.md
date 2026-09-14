# @pulseops/node-sdk Architecture

Official Node.js SDK and instrumentation toolkit for the PulseOps observability platform.

## Key Capabilities

1. **High-Throughput Asynchronous Batching**:
   - In-memory event buffer (`QueuedIngestItem[]`) with configurable flush interval and batch size threshold.
   - Non-blocking telemetry dispatch ensuring zero request latency overhead on application threads.

2. **Client-Side Redaction Engine (`Redactor`)**:
   - Recursively scrubs passwords, auth tokens, bearer tokens, API keys, JWTs, and credit card numbers before payloads leave the host boundary.

3. **Resilient HTTP Ingestion Transport**:
   - Exponential backoff with retry tracking for 429 and 5xx responses.
   - Process hook integration (`beforeExit`, `SIGTERM`, `SIGINT`) guaranteeing clean event buffer flush on server shutdown.

4. **Framework & Runtime Helpers**:
   - `createPulseOpsMiddleware`: Drop-in Express middleware tracking request durations, status distributions, and correlation headers.
   - `createPulseOpsErrorHandler`: Express error middleware capturing unhandled exceptions with full stack traces and routing metadata.
   - `instrumentJob`: Background queue / cron job wrapper calculating execution latency and reporting failed job states.
