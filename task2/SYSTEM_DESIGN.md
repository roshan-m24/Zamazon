# System Design

## Overview

A REST microservice for product catalogue management, deployed as three
independently-versioned instances (`v1.0`, `v1.1`, `v2.0`) on Kubernetes,
each reachable through a shared NGINX Ingress, each built and shipped
through the same CI/CD pipeline.

## Why one codebase, three git-tagged versions?

The assignment asks for three *versions* of the same microservice, each
adding capability on top of the last (`v1.0` → `v1.1` → `v2.0`). Rather than
maintaining three divergent codebases, this repo captures that evolution as
three real git commits/tags/branches (`v1.0.0`/`v1.0`, `v1.1.0`/`v1.1`,
`v2.0.0`/`v2.0`) on top of a single, growing `src/app.js`. This mirrors how
a real team would actually ship incremental API versions, and it means
`git diff v1.0.0 v2.0.0 -- src/app.js` shows exactly what changed between
versions.

Each tagged commit is built into its own immutable Docker image
(`product-catalog:v1.0.0`, `:v1.1.0`, `:v2.0.0`) and deployed into its own
Kubernetes namespace, so all three versions can run side-by-side in
production simultaneously — useful for canarying `v2.0` while `v1.1` still
serves existing clients.

## Namespace isolation

Each version gets a dedicated namespace (`catalog-v1`, `catalog-v1-1`,
`catalog-v2`). This gives:
- Independent scaling (each has its own HPA).
- Independent RBAC (each has its own ServiceAccount + Role, least-privilege,
  scoped to only that namespace's Deployments/Pods/Services/HPAs — no
  cluster-wide access, no Secrets access).
- Blast-radius containment: rolling out a bad `v2.0` build can't touch
  `v1.0`'s running pods.
- Independent resource quotas/limits, if added later.

## Routing

A single NGINX Ingress Controller sits in front of all three namespaces.
Because a Kubernetes `Ingress` object can only target Services in its own
namespace, one `Ingress` resource is defined per namespace, all sharing the
same host (`catalog.local`) — together they form one logical routing table:

```
catalog.local/v1/products     -> catalog-v1 namespace   -> v1.0 pods
catalog.local/v1.1/products   -> catalog-v1-1 namespace -> v1.1 pods
catalog.local/v2/products     -> catalog-v2 namespace   -> v2.0 pods
```

The `rewrite-target` annotation strips the version prefix before it reaches
the container, so the same application code (which only knows about
`/products`, not `/v1/products`) works unmodified behind any prefix.

## Scaling & resource management

Each Deployment declares explicit CPU/memory `requests` and `limits`
(100m/64Mi requested, 250m/128Mi capped) — deliberately small because the
service holds its catalogue in memory and does no heavy computation. Each
namespace's `HorizontalPodAutoscaler` scales pods 2→6 on CPU (70%) or
memory (80%) utilization, so a traffic spike against `v2.0`'s search
endpoint scales only `v2.0`, not the other versions.

## Containerization

The Dockerfile is a two-stage Alpine build:
1. **builder** stage installs full `node_modules` (incl. dev deps needed
   for tests, though tests run in CI, not in the image).
2. **production** stage installs only production deps, copies just
   `src/` and `index.js` from the builder, runs as a non-root `appuser`,
   and declares a container-level `HEALTHCHECK` against `/health` — so an
   orchestrator (Docker, k8s) can detect a hung process even if the
   process hasn't crashed.

## CI/CD pipeline

GitHub Actions (`.github/workflows/ci-cd.yml`):
1. **test** — runs on every push/PR: `npm ci && npm test`. Nothing gets
   built or deployed if tests fail.
2. **build-and-push** — only on pushed `v*.*.*` tags: builds the Docker
   image and pushes it to GHCR tagged with that exact version.
3. **deploy** — applies the matching `k8s/vX/` manifests (chosen by
   pattern-matching the tag) plus the shared ingress/RBAC manifests, then
   waits for the rollout to finish.
4. **integration-tests** — smoke-tests `/health` and `/products` against
   the freshly-deployed service before considering the pipeline green.

## Security / bonus considerations

- **RBAC**: `k8s/rbac/rbac.yaml` gives each namespace's deployer identity
  only the verbs it needs (read Pods/Services/HPAs, update Deployments) —
  no wildcard permissions, no cross-namespace access, no Secrets access.
- **TLS**: see `k8s/ingress/README-tls.md` for how to terminate TLS at the
  Ingress with `cert-manager` + Let's Encrypt (or a self-signed cert for
  local minikube testing).
- **Vulnerability scanning**: see the "Bonus tasks" section of the main
  README for the `trivy` command used to scan the built image.
- **Secrets**: no secrets are needed by this service today (no DB
  credentials, no API keys), but the Dockerfile and Deployment are
  structured so that if any were added, they'd be injected via a
  Kubernetes `Secret` mounted as env vars — never baked into the image.

## Trade-offs / what a production version would add

- Real persistence (Postgres/MySQL) instead of an in-memory array —
  in-memory is used here to keep the service dependency-free and the
  assignment focused on containerization/deployment rather than DB ops.
- A service mesh or mTLS between pods, if this were part of a larger
  multi-service system.
- Centralized logging/metrics (e.g. shipping to Loki/Prometheus) instead
  of `console.log`/`console.error` — noted as a follow-up in the README's
  "Logging and monitoring" section.
