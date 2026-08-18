# PulseOps Frontend Dashboard Plan

## Product Feel

The dashboard should feel like an operational developer console: dense, scan-friendly, real-time, and useful. It should not look like a marketing landing page.

## Navigation

Primary navigation:

- Projects
- Overview
- Live Logs
- Errors
- Metrics
- Incidents
- Workers/Queues
- Vault
- Vault Audit
- Settings/API Keys

Global controls:

- project selector
- environment selector
- time range selector
- connection status
- current user menu

## Screens

| Screen | Purpose | Main Components | APIs | Realtime |
| --- | --- | --- | --- | --- |
| Login/Register | access dashboard | auth form, validation messages | auth endpoints | none |
| Project List | choose or create project | project table, create dialog | project APIs | optional project created |
| Project Overview | command center | KPIs, charts, active incidents, recent events | dashboard summary | events, metrics, incidents |
| Live Logs | inspect logs stream | filter bar, virtualized list, severity chips | events API | `event.created` |
| Errors | group repeated errors | group table, fingerprint detail, recent samples | dashboard errors/events | `event.created`, incidents |
| Metrics | inspect latency and throughput | p95 chart, avg latency, event rate | summary/events | `metric.updated` |
| Incidents | triage failures | incident list, detail drawer, resolve action | incidents API | `incident.created`, `incident.updated` |
| Workers/Queues | operational health | worker cards/table, queue depth, DLQ table | workers/queues APIs | worker and queue events |
| Vault Secrets | manage secrets | env tabs, secret metadata table, reveal modal, token panel | vault APIs | vault audit |
| Vault Audit Logs | inspect sensitive actions | audit table, filters | audit logs API | `vault.audit` |
| Settings/API Keys | manage ingestion keys | API key table, create/rotate/disable dialogs | project key APIs | none |

## States

Every screen must define:

- loading skeleton
- empty state with next useful action
- error state with retry
- stale connection state for WebSocket disconnect
- unauthorized state redirecting to login

## Overview Screen Details

Visible recruiter screenshot signals:

- total events today
- logs per minute
- error rate
- average latency
- p95 latency
- active incidents
- queue depth
- worker status
- vault audit activity
- live connection indicator

Charts:

- event throughput over time
- latency p95 and average
- errors by service

## Live Logs

Filters:

- environment
- service
- level
- search text
- time range

Behavior:

- newest events appear at top.
- user can pause live stream.
- metadata opens in a side drawer.
- sensitive keys are redacted.

## Errors

Main table:

- fingerprint
- service
- latest message sample
- count
- first seen
- last seen
- linked incident status

Detail:

- normalized fingerprint inputs
- recent occurrences
- related incident
- metadata samples with redaction

## Incidents

Actions:

- acknowledge
- resolve
- reopen
- copy incident summary for README/demo

Lifecycle display:

- open
- acknowledged
- resolved

## Vault Screens

Secrets list:

- key name
- environment
- version
- updated timestamp
- created by
- actions: reveal, rotate, delete

Reveal modal:

- asks for vault password
- shows value only after success
- includes copy action
- clears value when modal closes

Token panel:

- create token
- show raw token once
- list token prefixes, expiry, last used, status
- revoke token

Audit:

- never shows secret values
- shows actor, action, key name, environment, result, timestamp, request id

## Realtime Behavior

- On connect, join current project/environment room.
- On project or environment change, leave old room and join new room.
- On disconnect, show stale indicator and keep cached data visible.
- On reconnect, refetch dashboard summary and latest events.
- Deduplicate events by id to avoid duplicate UI rows after reconnect.

## Design Constraints

- Use operational layout, not a landing page.
- Use compact tables and charts.
- Avoid decorative UI that reduces scan speed.
- Use clear severity colors: red for critical, amber for warning, green for healthy, neutral for inactive.
- Show enough live data in screenshots to make system design visible.
