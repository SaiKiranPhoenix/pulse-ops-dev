# po-shared Architecture

`po-shared` contains cross-service utilities and contracts only. It must never become a dumping ground for service business logic.

## Allowed

- typed environment config helpers
- shared API, queue, and realtime contracts
- common error classes and response shapes
- logger and redaction utilities
- crypto primitives, not vault workflows
- RabbitMQ, Redis, and MongoDB connection helpers
- shared security helpers
- test helpers and fixtures

## Forbidden

- service-specific MongoDB models
- service-specific repositories
- auth/project/vault/incident business use cases
- UI code
- secrets or real environment values

## Folder Map

- `src/config`: typed environment loading and validation.
- `src/contracts`: public API, queue, and realtime schemas.
- `src/crypto`: reusable hash, random token, and encryption primitives.
- `src/errors`: common application error model.
- `src/logger`: structured logging and redaction.
- `src/messaging`: RabbitMQ helpers.
- `src/mongo`: Mongo connection helpers.
- `src/redis`: Redis client helpers.
- `src/security`: common auth/redaction/security helpers.
- `src/testing`: reusable test fixtures.
- `src/types`: shared TypeScript types.
- `src/validation`: shared schema utilities.
