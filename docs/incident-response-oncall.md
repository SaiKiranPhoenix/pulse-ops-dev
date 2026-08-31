# Incident Response & On-Call Management

PulseOps provides an enterprise-grade Incident Response, On-Call Scheduling, and Escalation platform tightly coupled with automated monitor detections and distributed observability telemetry.

## Architecture Overview

```
 [Monitor Triggers / Synthetic Failures]
                     │
                     ▼
           [Incident Service]
         ┌───────────┴───────────┐
         ▼                       ▼
 [Interactive Timeline]    [On-Call Rotations & Escalations]
         │                       │
         ├─ Live Comments        ├─ Step 1: Active Responder Page
         ├─ Triage & Assignee    ├─ Step 2: Slack / Discord Channel
         ├─ Postmortem RCA       └─ Step 3: Secondary Escalation
         └─ Markdown Briefing
```

## Key Capabilities

### 1. Interactive Incident Timelines & Triage
- **Audit Trails**: Real-time recording of status transitions (`open`, `acknowledged`, `resolved`), severity triage (`critical`, `high`, `medium`, `low`), and assignees.
- **Collaborative Comments**: Live team notes and investigation threads tied to incident IDs.
- **Runbook Integrations**: Direct links to service runbooks for fast mitigation.
- **Root Cause Samples**: Embedded error traces and correlated spans.

### 2. Postmortem Root Cause Analysis (RCA)
- Structured postmortem drafting with Executive Summary, Technical Root Cause, Trigger, and MTTR metrics (`impactDurationMinutes`, `detectionTimeMinutes`, `resolutionTimeMinutes`).
- Action items checklist to track follow-up engineering guardrails.

### 3. Automated Markdown Incident Briefing Export
- Generates a structured markdown report ready to share with stakeholders or attach to post-incident retrospectives via `/incidents/:id/export`.

### 4. On-Call Rotations & Escalation Policies
- **On-Call Schedules**: Timezone-aware responder rotations (`daily`, `weekly`, `custom`).
- **Tiered Escalation Chains**: Multi-step notification policies with configurable delay intervals and target fallback routes.

## REST & Real-Time API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `PATCH` | `/incidents/:id/triage` | Update severity, assignee, and runbook link |
| `POST` | `/incidents/:id/comments` | Post live responder comment |
| `PUT` | `/incidents/:id/postmortem` | Save or update postmortem RCA report |
| `GET` | `/incidents/:id/export` | Export markdown incident briefing |
| `GET` | `/on-call/schedules` | List active on-call rotation schedules |
| `POST` | `/on-call/schedules` | Create on-call schedule |
| `GET` | `/on-call/escalation-policies` | List tiered escalation policies |
| `POST` | `/on-call/escalation-policies` | Create escalation policy |
