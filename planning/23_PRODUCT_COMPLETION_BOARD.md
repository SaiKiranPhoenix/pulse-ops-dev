# PulseOps Product Completion Board

This board is the working source of truth for turning PulseOps into a practical local-first mix of Datadog-style observability and HashiCorp-Vault-style secret management.

## Status Legend

- `[x]` Complete in the current repository.
- `[ ] Partial` Started, but not complete enough to count as done.
- `[ ] Todo` Not implemented yet.
- `[ ] Verify` Exists or is claimed by code, but needs manual product verification before it can be marked complete.

## Current Honest Product Rating

- Architecture/backend foundation: about 60 percent.
- Browser product experience: about 15 percent.
- End-to-end usable Datadog plus Vault experience: about 30 to 35 percent.

The main gap is not only code volume. It is that the implemented backend pieces are not assembled into a guided, usable product flow.

## North Star Demo

- [x] User opens the app and lands on a useful product entry point, not only a marketing page.
- [x] User registers or signs in.
- [x] User is guided to create the first project when no project exists.
- [x] User creates environments: development, staging, production.
- [x] User creates an ingestion API key and sees the raw key once.
- [x] User sees exact app connection instructions: endpoint, headers, cURL, Node example, and environment variables.
- [x] User sends a test log/error/metric from the UI and sees it arrive.
- [x] User connects an external/deployed app by API key and observes telemetry like Datadog.
- [x] User sees logs, metrics, errors, incidents, workers, queues, and live updates.
- [x] User stores encrypted project secrets like a simplified Vault.
- [x] User reveals a secret only with the vault password.
- [x] External app fetches allowed secrets using a vault integration token.
- [x] User sees vault audit logs without secret values.
- [x] README/demo path proves the full flow in screenshots or GIFs.

## Product Shell And Navigation

- [x] React/Vite UI application exists.
- [x] Landing page exists.
- [x] Login page exists.
- [x] Register page exists.
- [x] OAuth callback page exists.
- [x] Protected route wrapper exists.
- [x] Dashboard routes exist inside a shared app shell.
- [x] Replace dashboard one-off page layouts with a persistent product shell.
- [x] Add sidebar navigation: Overview, Logs, Metrics, Traces, Incidents, Workers, Vault, API Keys, Setup.
- [x] Add top bar with project selector, environment selector, time range selector, realtime connection state, and user menu.
- [x] Add breadcrumb/page title pattern for all product pages.
- [x] Add responsive mobile navigation.
- [x] Add loading skeletons for every product page.
- [x] Add empty states with next best action for every page.
- [x] Add retryable error states for every page.
- [x] Add unauthenticated session expiry handling.
- [x] Add global toast/notification system.
- [x] Add copy-to-clipboard component for keys, tokens, snippets, and IDs.
- [x] Add confirmation dialogs for destructive actions.
- [x] Add accessible focus states and keyboard support.

## Authentication And User Session

- [x] Email registration API exists.
- [x] Email login API exists.
- [x] Current user API exists.
- [x] JWT access token generation exists.
- [x] Password hashing exists.
- [x] Login/register UI exists.
- [x] Google/GitHub OAuth service code exists.
- [x] OAuth start/callback routes exist.
- [x] OAuth requires local provider credentials and has setup-aware UX around setup errors.
- [x] Register should sign the user in or route directly to onboarding.
- [x] Store and restore session robustly across refresh.
- [x] Add logout button and user menu.
- [x] Add expired-token redirect handling.
- [x] Add password reset or explicitly mark as non-goal in UI/docs.
- [x] Add account settings page.
- [x] Add user profile update flow.
- [x] Add audit-safe auth logging.

## Project Management

- [x] Project model exists.
- [x] Project create/list/detail backend APIs exist.
- [x] Project ownership repository exists.
- [x] Project API client functions exist in UI.
- [x] Dashboard pages choose the first active project automatically.
- [x] Build project list page.
- [x] Build create project page/dialog.
- [x] Build first-project onboarding screen after login.
- [x] Add project switcher to product shell.
- [x] Add project details/settings page.
- [x] Add project archive/restore flow.
- [x] Add project slug editing rules or immutable slug policy.
- [x] Add project description field support if product keeps it.
- [x] Add environment management UI.
- [x] Enforce standard environments in UI: development, staging, production.
- [x] Add no-project empty state on every dashboard surface.
- [x] Add owner-only access verification tests across all project APIs.

## API Key And App Connection Management

- [x] API key model exists.
- [x] API key create/list/rotate/disable backend APIs exist.
- [x] API key hashing exists.
- [x] Raw API key is returned once in backend tests.
- [x] Redis cache invalidation for API key changes exists.
- [x] UI API client has create/list/rotate/disable functions.
- [x] Build API keys/settings page.
- [x] Build create API key dialog/form with scopes.
- [x] Show raw API key once with copy action and warning.
- [x] Build API key table with prefix, status, scopes, last used, expiration, created date.
- [x] Build rotate API key flow with raw replacement key shown once.
- [x] Build disable API key confirmation.
- [x] Build app connection wizard after project creation.
- [x] Show ingestion endpoint URLs for Docker/local development.
- [x] Show deployed-app setup examples: cURL, Node fetch, environment variables, Docker env.
- [x] Add "Send test event" button using the selected API key.
- [x] Add "copy Datadog-like agent config" placeholder or MVP equivalent.
- [x] Add last-used update visibility in UI.

## Telemetry Ingestion

- [x] Ingestion service exists.
- [x] Log ingestion endpoint exists.
- [x] Error ingestion endpoint exists.
- [x] Metric ingestion endpoint exists.
- [x] API key validation service exists.
- [x] Redis API key validation cache exists.
- [x] Redis rate limiting exists.
- [x] Idempotency handling exists.
- [x] RabbitMQ confirm publish path exists.
- [x] Ingestion acceptance records exist.
- [x] Integration tests cover ingestion routes.
- [x] Confirm success response means RabbitMQ accepted the message through confirm publish.
- [x] Add UI-driven test log/error/metric sender.
- [x] Add ingestion docs inside the app.
- [x] Add payload schema examples in the app.
- [x] Add validation error examples for users.
- [x] Add source/service naming guidance.
- [x] Add metadata redaction preview and policy.
- [x] Add ingestion health indicator per project.
- [x] Add ingestion rate limit visibility.
- [x] Add endpoint for accepted/rejected ingestion stats.
- [x] Add browser-visible API key troubleshooting guide.

## Event Workers And Processing

- [x] Event worker service exists.
- [x] RabbitMQ consumer runtime exists.
- [x] Worker heartbeat service exists.
- [x] Event persistence repository exists.
- [x] Incident evaluation publisher exists.
- [x] Unit tests exist for event worker behavior.
- [x] Logs, errors, and metrics persist through worker processing from real ingestion messages.
- [x] Worker health is available in a complete Workers page.
- [x] Add worker throughput metrics.
- [x] Add worker error counters.
- [x] Add worker retry counters.
- [x] Add stale worker detection UI.
- [x] Add worker detail drawer.
- [x] Add durable dedupe for worker redeliveries if not complete.
- [x] Add poison message test and visibility.

## Logs Experience

- [x] Backend event model/repository exists.
- [x] Dashboard event API client exists.
- [x] Overview shows a recent events list.
- [x] Replace placeholder Logs page.
- [x] Add live logs table/list.
- [x] Add filters: environment, service, level, search, time range.
- [x] Add pause/resume live stream.
- [x] Add metadata detail drawer.
- [x] Add JSON viewer with redaction.
- [x] Add pagination/cursor support in UI.
- [x] Add copy event ID/request ID actions.
- [x] Add empty state with "send test log" action.
- [x] Add realtime `event.created` handling.
- [x] Add log severity coloring.

## Errors Experience

- [x] Error ingestion endpoint exists.
- [x] Incident service can evaluate repeated errors.
- [x] Incidents page is complemented by an error-group product surface.
- [x] Build Errors page.
- [x] Add error grouping by fingerprint.
- [x] Add error group table: fingerprint, service, message sample, count, first seen, last seen, linked incident.
- [x] Add error detail drawer with stack traces and metadata.
- [x] Add related incidents panel.
- [x] Add filters for service/environment/status.
- [x] Add "send repeated error test" action.
- [x] Add stack trace formatting.
- [x] Add sensitive-data redaction display.

## Metrics Experience

- [x] Metric ingestion endpoint exists.
- [x] Dashboard summary has metric fields in API client.
- [x] Replace placeholder Metrics page.
- [x] Add event throughput chart.
- [x] Add latency average and p95 chart.
- [x] Add error rate chart.
- [x] Add metrics by service.
- [x] Add time range selector integration.
- [x] Add environment selector integration.
- [x] Add metric unit formatting.
- [x] Add "send high latency test" action.
- [x] Add chart library if not already installed.
- [x] Add loading and empty chart states.

## Traces/APM Experience

- [x] Decide MVP scope: build trace correlation from telemetry attributes for MVP.
- [x] Replace placeholder Traces page with an honest MVP surface.
- [x] Add trace ingestion contract through existing log/error/metric attributes: traceId, spanId, parentSpanId, operation, durationMs.
- [x] Add span model and indexes if traces enter MVP; dashboard trace summaries now derive indexed spans from correlated event attributes.
- [x] Add service map if traces enter MVP.
- [x] Add waterfall trace detail if traces enter MVP.
- [x] Add correlation from logs/errors/metrics to trace ID if traces enter MVP.
- [x] Keep Traces navigation because MVP trace correlation is implemented.

## Incidents And Alerting

- [x] Incident service exists.
- [x] Incident model/repository exists.
- [x] Repeated error evaluation exists.
- [x] High latency scripts exist.
- [x] Incident list/detail/status APIs exist.
- [x] Incidents UI page exists.
- [x] Reopen/resolve actions exist in UI.
- [x] Realtime incident update code exists.
- [x] Add acknowledge action in backend, realtime contract, and UI.
- [x] Incident page has a triage workbench with filters, summary metrics, details, timeline, and actions.
- [x] Add incident detail drawer/page.
- [x] Add acknowledge lifecycle.
- [x] Add resolution note support.
- [x] Add incident timeline.
- [x] Add linked event samples.
- [x] Add severity filters.
- [x] Add status filters.
- [x] Add incident creation reason/rule display.
- [x] Add copy incident summary action.
- [ ] Todo Add queue backlog incident rule.
- [ ] Todo Add alert delivery later: email/webhook/Slack/Teams.

## Dashboard Overview

- [x] Overview route exists.
- [x] Summary cards exist.
- [x] Recent events panel exists.
- [x] Active incidents panel exists.
- [x] Worker and queue panels exist.
- [x] Realtime incident update handler exists.
- [x] No project onboarding; empty state is actionable through the setup redirect and shell selector.
- [x] Realtime covers incidents, telemetry events, metrics refreshes, vault audit, worker heartbeats, and queue status updates.
- [x] Add chart section for throughput, errors, latency.
- [x] Add environment and time range selectors.
- [x] Add project selector.
- [x] Add "send test traffic" controls.
- [x] Add dashboard auto-refresh and stale data indicator.
- [x] Add deep links from cards to Logs, Metrics, Incidents, Workers, Vault.
- [ ] Todo Add better no-data demo guidance.
- [x] Add realtime `event.created`, `vault.audit`, `worker.heartbeat`, and `queue.status`.

## Workers And Queues Experience

- [x] Ops service exists.
- [x] Worker health repository exists.
- [x] Queue status repository exists.
- [x] Worker/queue API client exists.
- [x] Overview displays worker and queue snippets.
- [x] Build dedicated Workers/Queues page.
- [x] Add worker table.
- [x] Add queue table.
- [x] Add queue depth, consumers, retry count, poison count, and derived queue health warnings.
- [ ] Todo Add RabbitMQ management-backed stats if needed.
- [x] Add DLQ inspection.
- [x] Add DLQ replay tool.
- [x] Add queue backlog warning.
- [x] Add stale worker warnings.

## Realtime

- [x] Realtime gateway exists.
- [x] Socket client exists.
- [x] Project room join/leave helpers exist.
- [x] Incident realtime consumer exists.
- [x] Dashboard uses realtime for incidents, telemetry events, trace refreshes, and vault audit updates.
- [x] Verify project ownership before room join in live path.
- [x] Add environment-scoped rooms.
- [x] Emit live events to Logs.
- [x] Emit live metric updates to Overview/Metrics.
- [x] Emit worker heartbeat updates.
- [x] Emit queue status updates.
- [x] Emit vault audit updates.
- [x] Handle reconnect by refetching current page.
- [x] Deduplicate events after reconnect.
- [x] Add visible stale connection state across shell.

## Vault Core

- [x] Vault service exists.
- [x] Vault secret model exists.
- [x] Vault token model exists.
- [x] AES-256-GCM encryption service exists.
- [x] Secret create/list/reveal/update/delete backend APIs exist.
- [x] Secret list does not expose values by contract.
- [x] Vault token create/list/revoke backend APIs exist.
- [x] Vault integration secret fetch exists.
- [x] Raw integration token is returned once.
- [x] Vault service unit tests exist.
- [x] Vault password flow exists as request password with a first-class browser-session unlock product flow.
- [x] Verify MongoDB never contains raw seeded secret values.
- [x] Verify reveal/fetch responses set no-store headers.
- [x] Add Vault setup screen for choosing/confirming vault password or clearly define stateless password mode.
- [x] Add environment tabs in Vault UI.
- [x] Add reveal modal instead of inline reveal.
- [x] Clear revealed value when modal closes.
- [x] Add copy secret value action inside reveal modal.
- [x] Add rotate secret flow.
- [x] Add soft-delete confirmation.
- [x] Add secret version history.
- [x] Add per-key metadata: created by, updated by, timestamps.
- [x] Add integration token scopes UI.
- [x] Add integration token expiry UI.
- [x] Add last-used token display.
- [x] Add external app secret fetch instructions.
- [x] Add rate limiting for vault reveal/fetch attempts.
- [x] Add wrong-password audit failure verification.

## Vault Audit

- [x] Audit service exists.
- [x] Audit event model exists.
- [x] Vault audit publisher exists.
- [x] Vault page displays audit events.
- [x] Audit is available as a dedicated audit product surface.
- [x] Build Vault Audit page.
- [x] Add filters: action, result, environment, key, actor, time range.
- [x] Add request ID display.
- [x] Add actor type display: user/integration token/system.
- [x] Add audit detail drawer.
- [x] Add export/copy audit row action.
- [x] Add realtime audit event updates.
- [x] Add tests proving audit never stores raw secret, password, token, or auth header.

## API Gateway

- [x] API gateway service exists.
- [x] Proxy controller/service exists.
- [x] Auth middleware exists.
- [x] CORS middleware exists.
- [x] Dashboard controller/service exists.
- [x] Error shape middleware exists.
- [x] Request ID middleware exists.
- [x] Unit tests exist for proxy and CORS.
- [x] Verify Gateway route coverage matches `planning/10_API_CONTRACTS.md`.
- [x] Add route-level docs or OpenAPI generation.
- [x] Add request/response logging with redaction verification.
- [x] Add gateway health aggregation.
- [x] Add service unavailable UX mapping.
- [x] Add rate limit at gateway.
- [x] Add Platform UI for service health, OpenAPI routes, backend coverage, and runtime config.

## Data Model And Storage

- [x] MongoDB compose service exists.
- [x] Redis compose service exists.
- [x] RabbitMQ compose service exists.
- [x] Collections exist for users, projects, API keys, events, incidents, vault secrets, vault tokens, audit events.
- [x] Mongoose models exist for core entities.
- [x] Verify all required indexes exist and are correct.
- [x] Add retention policy for telemetry events.
- [x] Add database seed script.
- [x] Add safe local reset script.
- [x] Add data migration/versioning strategy if needed.
- [x] Add dashboard query pagination indexes.
- [x] Add incident/event correlation indexes.
- [x] Add audit query indexes.

## Redis Hot State

- [x] Redis client/key helpers exist.
- [x] API key cache exists.
- [x] Ingestion rate limiting exists.
- [x] Ingestion idempotency exists.
- [x] Incident counters exist.
- [x] Worker heartbeat uses Redis.
- [x] Verify TTL behavior with tests for all hot-state keys.
- [x] Add dashboard-visible rate-limit counters.
- [x] Add cache invalidation documentation.
- [x] Add Redis unavailable behavior tests.
- [x] Add vault token cache visibility or diagnostics.

## RabbitMQ Messaging

- [x] RabbitMQ compose service exists.
- [x] Shared RabbitMQ helpers exist.
- [x] Telemetry publisher exists.
- [x] Event worker consumer exists.
- [x] Incident evaluation publisher/consumer exists.
- [x] Realtime incident publisher/consumer exists.
- [x] Audit consumer exists.
- [x] Retry/DLQ design exists with product visibility and verification.
- [x] Verify manual ack and retry behavior in tests.
- [x] Verify poison messages land in DLQ.
- [x] Add DLQ dashboard.
- [x] Add retry count metadata.
- [x] Add dead-letter reason display.
- [x] Add bounded retry tests.

## Security And Privacy

- [x] Security threat model exists.
- [x] Secret scanning script exists.
- [x] Logger redaction tests exist.
- [x] API key hashing exists.
- [x] Vault token hashing exists.
- [x] Secret encryption exists.
- [x] JWT auth exists.
- [x] Auth middleware files in service folders enforce gateway identity or API-key presence.
- [x] Verify no raw secrets/tokens/passwords appear in logs.
- [x] Verify project isolation across all APIs.
- [x] Verify realtime room authorization.
- [x] Verify no sensitive values are returned from list APIs.
- [x] Add brute-force protections for vault reveal.
- [x] Add metadata redaction/rejection tests for telemetry payloads.
- [x] Add security-focused integration test suite.
- [x] Add local security checklist in README.
- [x] Add explicit MVP limitations compared with HashiCorp Vault.

## Testing

- [x] Unit test framework exists.
- [x] Shared package tests exist.
- [x] Auth/project integration tests exist.
- [x] OAuth integration tests exist.
- [x] Ingestion integration tests exist.
- [x] Incident unit tests exist.
- [x] Vault unit tests exist.
- [x] Ops unit tests exist.
- [x] Event worker unit tests exist.
- [x] Demo smoke script exists.
- [x] Browser E2E test suite exists for the real user journey.
- [x] Add Playwright E2E tests: register, create project, create API key, send test event, see dashboard update.
- [x] Add Vault E2E: create secret, reveal, create token, fetch secret, see audit.
- [x] Add Incidents E2E: send repeated errors, incident appears, resolve/reopen.
- [x] Add Logs E2E: send log, live row appears.
- [x] Add Metrics E2E: send latency metric, chart updates.
- [x] Add Docker health E2E before demo smoke.
- [x] Add queue retry/DLQ tests.
- [x] Add Redis TTL tests.
- [x] Add project isolation tests.
- [x] Add API contract tests.

## Load And Demo Scripts

- [x] Normal traffic load script exists.
- [x] Repeated errors load script exists.
- [x] High latency load script exists.
- [x] Rate limit load script exists.
- [x] Demo smoke script exists.
- [ ] Todo Replace or supplement k6 requirement if scripts are plain Node scripts.
- [ ] Todo Add one-command demo data seeding.
- [ ] Todo Add one-command demo reset.
- [ ] Todo Add one-command "generate traffic for selected project" command.
- [ ] Todo Add script output that prints dashboard URLs and expected results.
- [ ] Todo Add app UI buttons that trigger the same scenarios.
- [ ] Todo Add documented demo timings.

## Documentation

- [x] Planning documentation suite exists.
- [x] Architecture docs exist per service.
- [x] CI/security docs exist.
- [x] Deployment doc exists.
- [ ] Partial README/demo documentation is not yet product-complete.
- [ ] Todo Write final README with exact local run path.
- [ ] Todo Add architecture diagram.
- [ ] Todo Add event flow diagram.
- [ ] Todo Add vault security explanation.
- [ ] Todo Add screenshots/GIFs.
- [ ] Todo Add recruiter demo checklist.
- [ ] Todo Add troubleshooting: Docker build slowness, Mongo/Compass port conflicts, OAuth provider setup.
- [ ] Todo Add API examples for ingestion and vault integration.
- [ ] Todo Add environment variable guide.
- [ ] Todo Add known limitations section.
- [ ] Todo Add "what makes this like Datadog" and "what makes this like Vault" explanation.

## DevOps And Local Runtime

- [x] pnpm workspace exists.
- [x] Dockerfiles exist for services.
- [x] Docker Compose apps profile exists.
- [x] MongoDB, Redis, RabbitMQ, MailHog run locally.
- [x] RabbitMQ management UI exposed.
- [x] UI served through container.
- [x] API gateway exposed.
- [x] Realtime gateway exposed.
- [ ] Partial Docker builds can be slow due dependency fetching.
- [ ] Todo Add fast local dev mode without rebuilding every service.
- [ ] Todo Add VS Code launch/tasks documentation.
- [ ] Todo Add `.env` validation guide.
- [ ] Todo Add "recreate env-only service" guide.
- [ ] Todo Add local service health dashboard.
- [ ] Todo Add compose profiles for infra-only, apps, workers-only.
- [ ] Todo Add cleanup/reset commands.
- [ ] Todo Add Windows-specific troubleshooting.

## CI/CD

- [x] CI workflow files exist.
- [x] PR guardrail scripts exist.
- [x] Secret scan script exists.
- [x] Security audit script exists.
- [ ] Verify CI passes on remote after latest merge.
- [ ] Todo Add E2E workflow with Docker services.
- [ ] Todo Add Playwright screenshot artifacts.
- [ ] Todo Add Docker image build cache strategy.
- [ ] Todo Add dependency vulnerability policy.
- [ ] Todo Add branch protection documentation.

## Product Quality And UX Polish

- [ ] Todo Replace marketing-first experience after auth with product-first dashboard.
- [ ] Todo Make every button do a real backend action or remove it.
- [ ] Todo Ensure every page has data, empty, error, loading, and unauthorized states.
- [ ] Todo Add consistent table density and operational styling.
- [ ] Todo Add consistent severity and status color system.
- [ ] Todo Add charts with useful axes/tooltips.
- [ ] Todo Add copy actions for all operational snippets.
- [ ] Todo Add inline setup instructions only where they unblock work.
- [ ] Todo Add keyboard-accessible modals/drawers.
- [ ] Todo Add mobile-safe layout for critical flows.
- [ ] Todo Run visual review across desktop and mobile.

## Organizations, Teams, And Access Control

- [ ] Todo Decide whether MVP remains single-user or expands to organizations before public demo.
- [ ] Todo Add organization/workspace model.
- [ ] Todo Add organization switcher.
- [ ] Todo Add team/member invitations.
- [ ] Todo Add member roles: owner, admin, developer, viewer.
- [ ] Todo Add project-level role overrides.
- [ ] Todo Add environment-level permissions for production access.
- [ ] Todo Add vault-specific permissions separate from telemetry permissions.
- [ ] Todo Add incident management permissions.
- [ ] Todo Add API key management permissions.
- [ ] Todo Add audit log read permissions.
- [ ] Todo Add service account identities.
- [ ] Todo Add personal access tokens for automation.
- [ ] Todo Add RBAC middleware shared by protected services.
- [ ] Todo Add ownership and RBAC tests for every protected endpoint.
- [ ] Todo Add UI permission gates so forbidden actions are hidden or disabled.
- [ ] Todo Add member activity audit events.

## Service Catalog And Ownership

- [ ] Todo Add service catalog model: service name, owner, language, repo URL, runtime, tags.
- [ ] Todo Auto-discover services from telemetry source names.
- [ ] Todo Let users assign service owners.
- [ ] Todo Add service detail page.
- [ ] Todo Show logs, errors, metrics, incidents, secrets, and deployments by service.
- [ ] Todo Add service health score.
- [ ] Todo Add dependency/service map from telemetry metadata or traces.
- [ ] Todo Add service tags and filtering.
- [ ] Todo Add ownership display on incidents.
- [ ] Todo Add runbook links per service.
- [ ] Todo Add repository/deployment links per service.
- [ ] Todo Add service-level onboarding checklist.

## Agents, SDKs, And Instrumentation

- [ ] Todo Decide ingestion strategy: raw HTTP only, lightweight SDK, or local agent.
- [ ] Todo Build Node.js SDK package for logs/errors/metrics.
- [ ] Todo Add browser-safe client only if RUM enters scope.
- [ ] Todo Add Express middleware for request logging and latency metrics.
- [ ] Todo Add error handler middleware that reports exceptions.
- [ ] Todo Add queue/job instrumentation helpers.
- [ ] Todo Add Docker/container environment setup examples.
- [ ] Todo Add deployed app setup examples for Render, Railway, Fly.io, Vercel, and generic VPS.
- [ ] Todo Add SDK key rotation guidance.
- [ ] Todo Add SDK retry/backoff behavior.
- [ ] Todo Add SDK local redaction helpers.
- [ ] Todo Add SDK tests and example app.
- [ ] Todo Add sample instrumented application in the repo.
- [ ] Todo Add "copy install command" UI.
- [ ] Todo Add "verify integration" flow that waits for first event from a service.

## Monitors, Alerts, And Notification Routing

- [ ] Todo Add monitor/rule model.
- [ ] Todo Add monitor builder UI.
- [ ] Todo Add log-based monitors.
- [ ] Todo Add metric threshold monitors.
- [ ] Todo Add error-rate monitors.
- [ ] Todo Add latency percentile monitors.
- [ ] Todo Add queue backlog monitors.
- [ ] Todo Add worker-stale monitors.
- [ ] Todo Add vault audit anomaly monitors.
- [ ] Todo Add monitor evaluation worker.
- [ ] Todo Add monitor state: OK, Alert, Warning, No Data.
- [ ] Todo Add alert grouping and deduplication.
- [ ] Todo Add alert mute/silence windows.
- [ ] Todo Add maintenance windows.
- [ ] Todo Add notification channels: email via MailHog/local SMTP.
- [ ] Todo Add webhook notification channel.
- [ ] Todo Add Slack/Teams notification channel as later integration.
- [ ] Todo Add notification routing rules by project, service, severity, environment.
- [ ] Todo Add alert history.
- [ ] Todo Add test notification button.
- [ ] Todo Add monitor import/export JSON.

## SLOs, SLIs, And Reliability Reporting

- [ ] Todo Add SLO model.
- [ ] Todo Add SLI query definitions from metrics/logs/incidents.
- [ ] Todo Add availability SLO.
- [ ] Todo Add latency SLO.
- [ ] Todo Add error-rate SLO.
- [ ] Todo Add burn-rate calculation.
- [ ] Todo Add error budget display.
- [ ] Todo Add SLO dashboard page.
- [ ] Todo Add SLO breach incidents.
- [ ] Todo Add SLO reporting by project/service/environment.
- [ ] Todo Add calendar/time-window handling.
- [ ] Todo Add demo SLO seeded scenario.

## Custom Dashboards And Explorers

- [ ] Todo Add saved dashboard model.
- [ ] Todo Add dashboard builder page.
- [ ] Todo Add widgets: timeseries, toplist, table, query value, incident list, log stream, markdown note.
- [ ] Todo Add drag/drop or grid layout.
- [ ] Todo Add chart query builder.
- [ ] Todo Add project/environment/time-range variables.
- [ ] Todo Add saved views.
- [ ] Todo Add dashboard clone/delete.
- [ ] Todo Add shareable local links.
- [ ] Todo Add dashboard templates: API health, worker health, vault activity, incident response.
- [ ] Todo Add query explorer for logs.
- [ ] Todo Add query explorer for metrics.
- [ ] Todo Add query syntax or structured filter builder.
- [ ] Todo Add CSV/JSON export for table widgets.

## Log Management Pipeline

- [ ] Todo Add log parsing pipeline.
- [ ] Todo Add structured JSON log handling.
- [ ] Todo Add pipeline processors: parse, remap, redact, drop, sample, tag.
- [ ] Todo Add sensitive-data scanner for telemetry metadata.
- [ ] Todo Add ingestion-time redaction rules per project.
- [ ] Todo Add log retention settings.
- [ ] Todo Add log indexes/facets for service, level, environment, host, trace ID.
- [ ] Todo Add saved log searches.
- [ ] Todo Add log context view around a selected event.
- [ ] Todo Add log volume analytics.
- [ ] Todo Add log sampling controls.
- [ ] Todo Add live tail mode.
- [ ] Todo Add archive/export story.

## Metrics Platform

- [ ] Todo Add metric definition/catalog model.
- [ ] Todo Add metric tags/dimensions support.
- [ ] Todo Add rollups: count, avg, sum, min, max, p50, p95, p99.
- [ ] Todo Add time-bucket aggregation APIs.
- [ ] Todo Add metric cardinality guardrails.
- [ ] Todo Add custom metric explorer.
- [ ] Todo Add service-level metric summary.
- [ ] Todo Add host/container metric support if infra monitoring enters scope.
- [ ] Todo Add metric retention/rollup policy.
- [ ] Todo Add anomaly detection later.
- [ ] Todo Add metric query tests for correctness.

## APM And Distributed Tracing

- [x] Decide whether traces are MVP, v1.5, or v2; MVP is trace correlation from telemetry attributes.
- [ ] Todo Add dedicated trace ingestion endpoint; MVP trace ingestion remains through log/error/metric attributes.
- [ ] Todo Add dedicated span ingestion endpoint; MVP span ingestion remains through log/error/metric attributes.
- [x] Add trace/span data model; gateway exposes trace/span summaries from correlated telemetry events.
- [x] Add trace ID correlation across logs, errors, and metrics.
- [x] Add service dependency map.
- [x] Add trace search.
- [x] Add trace waterfall view.
- [x] Add slow trace detection.
- [x] Add endpoint/resource performance table.
- [x] Add error traces.
- [ ] Todo Add distributed context propagation docs.
- [ ] Todo Add SDK helpers for trace propagation.
- [ ] Todo Add OpenTelemetry compatibility investigation.
- [ ] Todo Add OpenTelemetry collector compatibility if adopted.

## Infrastructure And Container Monitoring

- [ ] Todo Add host model.
- [ ] Todo Add container model.
- [ ] Todo Add local Docker stats collector.
- [ ] Todo Add CPU, memory, network, disk metrics.
- [ ] Todo Add container status table.
- [ ] Todo Add service/container mapping.
- [ ] Todo Add infrastructure overview page.
- [ ] Todo Add container logs correlation.
- [ ] Todo Add RabbitMQ, MongoDB, Redis health panels.
- [ ] Todo Add dependency health page.
- [ ] Todo Add infrastructure monitors.
- [ ] Todo Add host/container tags.
- [ ] Todo Add local-only collector docs.

## Uptime, Synthetics, And RUM

- [ ] Todo Decide whether uptime checks enter v1.5 or v2.
- [ ] Todo Add HTTP uptime check model.
- [ ] Todo Add uptime scheduler worker.
- [ ] Todo Add uptime check result storage.
- [ ] Todo Add uptime dashboard.
- [ ] Todo Add uptime incident rule.
- [ ] Todo Add synthetic assertion checks.
- [ ] Todo Add regional checks as non-goal or future cloud feature.
- [ ] Todo Add browser RUM scope decision.
- [ ] Todo Add RUM event ingestion if in scope.
- [ ] Todo Add frontend error/session tracking if in scope.

## Incident Response And On-Call

- [ ] Todo Add incident detail timeline.
- [ ] Todo Add incident comments.
- [ ] Todo Add incident assignee.
- [ ] Todo Add incident severity changes.
- [ ] Todo Add incident related resources: logs, traces, metrics, services, monitors.
- [ ] Todo Add incident runbook links.
- [ ] Todo Add postmortem notes.
- [ ] Todo Add incident export/summary.
- [ ] Todo Add on-call schedule model later.
- [ ] Todo Add escalation policy model later.
- [ ] Todo Add notification escalation later.
- [ ] Todo Add status page integration later.

## Vault Policies And Access Model

- [ ] Todo Add vault policy model.
- [ ] Todo Add policy language or structured policy builder.
- [ ] Todo Add project/environment/key path permissions.
- [ ] Todo Add policy assignment to users, roles, service accounts, and tokens.
- [ ] Todo Add deny-by-default enforcement.
- [ ] Todo Add policy simulator UI.
- [ ] Todo Add "why denied" safe explanation.
- [ ] Todo Add policy version history.
- [ ] Todo Add policy tests.
- [ ] Todo Add production environment extra confirmation.

## Vault Secret Engines

- [ ] Todo Keep current encrypted env-secret storage as KV engine.
- [ ] Todo Add KV v2-style version history.
- [ ] Todo Add soft delete and undelete.
- [ ] Todo Add destroy version operation.
- [ ] Todo Add secret metadata separate from secret versions.
- [ ] Todo Add secret expiration metadata.
- [ ] Todo Add secret rotation reminders.
- [ ] Todo Add dynamic database credentials as future engine.
- [ ] Todo Add leased credentials model for dynamic secrets.
- [ ] Todo Add SSH/API token broker as future engine if needed.
- [ ] Todo Add transit encryption engine as future engine.
- [ ] Todo Add PKI/certificate engine as explicit non-goal or future feature.

## Vault Auth Methods And Identity

- [ ] Todo Add service account auth method.
- [ ] Todo Add app role style auth for deployed applications.
- [ ] Todo Add token renewal endpoint.
- [ ] Todo Add token revoke self endpoint.
- [ ] Todo Add token lookup endpoint.
- [ ] Todo Add token TTL and max TTL.
- [ ] Todo Add renewable/non-renewable token flags.
- [ ] Todo Add child token hierarchy only if product needs it.
- [ ] Todo Add identity aliases for OAuth/user/service accounts.
- [ ] Todo Add auth method management UI.

## Vault Leases, Rotation, And Secret Delivery

- [ ] Todo Add lease model.
- [ ] Todo Add lease issue/renew/revoke flow.
- [ ] Todo Add lease expiration worker.
- [ ] Todo Add secret rotation scheduler.
- [ ] Todo Add rotation history.
- [ ] Todo Add secret consumers/usage tracking.
- [ ] Todo Add last fetched by token/service display.
- [ ] Todo Add environment variable bundle fetch endpoint.
- [ ] Todo Add `.env` export flow with warnings.
- [ ] Todo Add runtime secret injection examples.
- [ ] Todo Add deploy-platform examples for consuming secrets.

## Vault Cryptographic Operations

- [ ] Todo Verify current AES-GCM implementation uses unique nonce per encryption.
- [ ] Todo Add KDF parameter migration story.
- [ ] Todo Add vault master/setup state if adopting persistent vault password model.
- [ ] Todo Add vault lock/unlock UX if adopting persistent vault password model.
- [ ] Todo Add key rotation for encryption metadata.
- [ ] Todo Add transit encrypt/decrypt endpoints as future engine.
- [ ] Todo Add signed audit hash chain if tamper-evidence enters scope.
- [ ] Todo Add backup/restore story for encrypted vault data.
- [ ] Todo Add explicit unrecoverable-secret warning when password is lost.
- [ ] Todo Add no-store/cache-control tests for all secret-returning endpoints.

## Vault Audit Backends And Compliance

- [ ] Todo Add audit backend abstraction.
- [ ] Todo Keep MongoDB audit backend for local MVP.
- [ ] Todo Add file audit backend later.
- [ ] Todo Add webhook audit backend later.
- [ ] Todo Add audit hash chaining later.
- [ ] Todo Add audit retention settings.
- [ ] Todo Add audit export.
- [ ] Todo Add audit integrity check command.
- [ ] Todo Add compliance report page.
- [ ] Todo Add secret access report by actor.
- [ ] Todo Add failed reveal/fetch report.

## Integrations Marketplace

- [ ] Todo Add integrations settings page.
- [ ] Todo Add webhook outbound integration.
- [ ] Todo Add Slack integration later.
- [ ] Todo Add Teams integration later.
- [ ] Todo Add GitHub integration later for repo links/deploy events.
- [ ] Todo Add Jira/Linear issue creation later.
- [ ] Todo Add PagerDuty/Opsgenie later.
- [ ] Todo Add OpenTelemetry collector integration if adopted.
- [ ] Todo Add Prometheus scrape/import integration later.
- [ ] Todo Add Grafana dashboard export later.
- [ ] Todo Add HashiCorp Vault import/export compatibility investigation.

## Deployment Events And Change Tracking

- [ ] Todo Add deployment event ingestion endpoint.
- [ ] Todo Add deployment marker model.
- [ ] Todo Show deployment markers on metrics charts.
- [ ] Todo Correlate incidents with recent deployments.
- [ ] Todo Add release/version field on telemetry.
- [ ] Todo Add service version tracking.
- [ ] Todo Add deploy health summary.
- [ ] Todo Add rollback marker support.
- [ ] Todo Add GitHub/Git metadata examples.

## Query, Search, And Storage Scale

- [ ] Todo Define query language or structured filter grammar.
- [ ] Todo Add full-text search strategy for logs/errors.
- [ ] Todo Add cursor pagination everywhere.
- [ ] Todo Add time range constraints to protect local DB.
- [ ] Todo Add event retention settings per project.
- [ ] Todo Add archive/export path.
- [ ] Todo Add background rollup jobs.
- [ ] Todo Add summary materialization strategy.
- [ ] Todo Add index verification tests.
- [ ] Todo Add cardinality and payload-size guardrails.
- [ ] Todo Add data deletion by project.
- [ ] Todo Add user/account deletion path.

## Admin, Support, And Diagnostics

- [ ] Todo Add local admin diagnostics page.
- [ ] Todo Add service health matrix.
- [ ] Todo Add dependency status: MongoDB, Redis, RabbitMQ, MailHog.
- [ ] Todo Add version/build information.
- [ ] Todo Add environment variable validation report.
- [ ] Todo Add recent backend errors view.
- [ ] Todo Add request ID lookup.
- [ ] Todo Add queue diagnostics.
- [ ] Todo Add cache diagnostics.
- [ ] Todo Add one-click demo health check from UI.
- [ ] Todo Add "copy diagnostic bundle" action.

## Billing, Plans, And Product Packaging

- [ ] Todo Decide whether billing is an explicit non-goal for the repo demo.
- [ ] Todo If not building billing, document it clearly.
- [ ] Todo Add plan/limits abstraction only if needed for rate limits.
- [ ] Todo Add usage page: events ingested, retention, seats, API keys, vault secrets.
- [ ] Todo Add local-only license/deployment note.
- [ ] Todo Add product edition statement: educational/local-first.
- [ ] Todo Add packaging path: Docker Compose demo, screenshots, sample app.

## Accessibility, Internationalization, And Browser Support

- [ ] Todo Run keyboard navigation audit.
- [ ] Todo Add ARIA labels for icon-only controls.
- [ ] Todo Add accessible modal/dialog behavior.
- [ ] Todo Add color contrast audit.
- [ ] Todo Add reduced motion support.
- [ ] Todo Add screen reader labels for charts.
- [ ] Todo Add empty/error state announcements where appropriate.
- [ ] Todo Decide i18n scope.
- [ ] Todo Add date/time localization utilities.
- [ ] Todo Test Chrome, Edge, and Firefox for core flows.

## Data Import, Export, And Portability

- [ ] Todo Add project export command.
- [ ] Todo Add telemetry export by time range.
- [ ] Todo Add vault metadata export without secret values.
- [ ] Todo Add encrypted vault backup export.
- [ ] Todo Add audit export.
- [ ] Todo Add import seed data for demos.
- [ ] Todo Add Postman/Bruno collection.
- [x] Add OpenAPI spec export.
- [ ] Todo Add sample JSON payload library.

## Governance Of Scope

- [ ] Todo Split board into MVP, v1.5, v2, and future once the complete surface is accepted.
- [ ] Todo Mark true non-goals explicitly so missing enterprise features are not mistaken for forgotten work.
- [ ] Todo Convert high-level product areas into GitHub issues or local backlog files.
- [ ] Todo Add dependency ordering to tasks.
- [ ] Todo Add acceptance criteria to every implementation slice.
- [ ] Todo Add manual QA checklist per screen.
- [ ] Todo Add demo evidence checklist per milestone.

## Suggested Implementation Order From Here

1. [x] Build product shell and project onboarding.
2. [x] Build API key/app connection wizard.
3. [ ] Partial Build send-test-event flow and demo seed/reset scripts.
4. [x] Replace Logs placeholder with a real live logs page.
5. [x] Replace Metrics placeholder with real charts.
6. [x] Build dedicated Workers/Queues page.
7. [x] Upgrade Incidents into a full triage workbench.
8. [x] Upgrade Vault into setup, secrets, tokens, reveal modal, and integration docs.
9. [x] Build Vault Audit page.
10. [x] Add realtime events beyond incidents.
11. [ ] Todo Add browser E2E tests for the full demo.
12. [ ] Todo Write final README and troubleshooting guide.

## Definition Of 100 Percent For This Project

- [ ] Todo A new user can complete the entire product journey without manually calling APIs.
- [ ] Todo A deployed/local app can send logs, errors, and metrics with an ingestion API key.
- [ ] Todo The dashboard shows Datadog-like observability: logs, error groups, metrics charts, incidents, workers, queues, and realtime updates.
- [ ] Todo The vault shows Vault-like secret management: encrypted secrets, reveal flow, integration tokens, scoped external fetch, and audit logs.
- [x] The UI is not placeholder-based; every visible product area is functional.
- [ ] Todo The Docker stack starts reliably.
- [ ] Todo Tests prove the primary flows.
- [ ] Todo Documentation lets another developer run and demo it end to end.
