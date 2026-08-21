# Developer documentation

Read in order if you're new to the codebase; otherwise jump to whichever you need.

1. [**Architecture**](./01-architecture.md) — stack, system diagram, multi-tenant shape, directory map.
2. [**Data model**](./02-data-model.md) — every type + the full KV key layout.
3. [**Auth & roles**](./03-auth-and-roles.md) — sessions, Super Admin / Org Admin / Player, approval flows, feature flags.
4. [**Local development**](./04-local-development.md) — first-time setup, day-to-day workflow, troubleshooting.
5. [**Deployment**](./05-deployment.md) — the Cloudflare Workers Builds pipeline, one-time setup, provisioning the first Super Admin.
6. [**API reference**](./06-api-reference.md) — every route, method, and who can call it.
7. [**Domain logic**](./07-domain-logic.md) — the exact rules behind poll confirmation, auction bidding, scheduling, standings tie-breaks, and bracket seeding.

See also: [`../DEVPLAN.md`](../DEVPLAN.md) — the original pre-build plan (historical, superseded by
this folder, kept for context on the original design intent) — and [`../user/`](../user/) for
end-user–facing guides.
