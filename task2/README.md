# Product Catalogue Microservice — Containerization, Versioning & Kubernetes Deployment

A REST API for managing a product catalogue, shipped as three
progressively-featured versions (`v1.0`, `v1.1`, `v2.0`), containerized,
version-controlled with git tags/branches, deployed to Kubernetes with
autoscaling and namespace isolation, and wired into a GitHub Actions
CI/CD pipeline.

## Versions

| Version | Endpoints | Git tag | Git branch |
|---|---|---|---|
| v1.0 | `GET /health`, `GET /products` | `v1.0.0` | `v1.0` |
| v1.1 | + `GET /products/search?keyword=` | `v1.1.0` | `v1.1` |
| v2.0 | + `category`, `minPrice`, `maxPrice` filters, input validation, error handling | `v2.0.0` | `v2.0` |

See [`CHANGELOG.md`](./CHANGELOG.md) for the detailed per-version changes,
and [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) for the architectural
reasoning (why one codebase / three tags, namespace layout, routing, etc).

## Running locally

```bash
npm install
cp .env.example .env
npm start
# listens on http://localhost:4000
```

```bash
curl http://localhost:4000/health
curl http://localhost:4000/products
curl "http://localhost:4000/products/search?category=electronics&maxPrice=1000"
```

## Running tests

```bash
npm test
```

12 Jest/Supertest tests covering all three versions' endpoints, including
error-handling cases (`400`s for malformed `minPrice`/`maxPrice`/`category`).

## Docker

```bash
docker build -t product-catalog:v2.0.0 .
docker run -p 4000:4000 product-catalog:v2.0.0
```

The image is a multi-stage Alpine build (small, production-only deps,
non-root user, container-level `HEALTHCHECK`).

To build a specific historical version's image, check out its tag first:

```bash
git checkout v1.0.0   # or v1.1.0
docker build -t product-catalog:v1.0.0 .
git checkout main
```

## Kubernetes deployment

Requires a running cluster (Minikube, kind, or any cloud cluster) and
`kubectl` configured against it, plus the NGINX ingress controller:

```bash
minikube start
minikube addons enable ingress
```

Deploy all three versions + shared ingress + RBAC:

```bash
kubectl apply -f k8s/v1/namespace.yaml   && kubectl apply -f k8s/v1/
kubectl apply -f k8s/v1.1/namespace.yaml && kubectl apply -f k8s/v1.1/
kubectl apply -f k8s/v2/namespace.yaml   && kubectl apply -f k8s/v2/
kubectl apply -f k8s/ingress/ingress.yaml
kubectl apply -f k8s/rbac/rbac.yaml
```

Check rollout status:

```bash
kubectl get pods -n catalog-v1
kubectl get pods -n catalog-v1-1
kubectl get pods -n catalog-v2
kubectl get hpa -A
```

Route to `catalog.local` locally (Minikube):

```bash
echo "$(minikube ip) catalog.local" | sudo tee -a /etc/hosts
curl http://catalog.local/v1/products
curl http://catalog.local/v1.1/products/search?keyword=fitness
curl http://catalog.local/v2/products/search?category=books
```

TLS setup (self-signed for local testing, or cert-manager for production):
see [`k8s/ingress/README-tls.md`](./k8s/ingress/README-tls.md).

## CI/CD pipeline

`.github/workflows/ci-cd.yml` runs on GitHub Actions:

1. **test** — every push/PR: install + `npm test`.
2. **build-and-push** — on any pushed `v*.*.*` tag: builds & pushes the
   Docker image to GHCR (`ghcr.io/<org>/product-catalog:<tag>`).
3. **deploy** — applies the k8s manifests matching that version and
   updates the running Deployment's image, then waits for rollout.
4. **integration-tests** — smoke-tests `/health` and `/products` against
   the live deployment.

Required repo secrets to make deploy/integration-tests work against your
own cluster:
- `KUBE_CONFIG_DATA` — base64-encoded kubeconfig for your cluster.
- `DEPLOYED_BASE_URL` — the externally reachable URL of the deployed
  service (e.g. your ingress host).

To trigger a release: `git push origin v2.0.0` (or any of the version
tags already created in this repo).

## Logging and monitoring

- The app logs unhandled errors to stdout (`console.error`) with no
  internal details returned to the client (see `SYSTEM_DESIGN.md`).
- In a cluster, stdout/stderr from every pod is already collected by
  whatever node-level log agent is running (e.g. Fluent Bit → Loki, or
  the cloud provider's default logging). No extra code is required for
  basic log collection; `kubectl logs -n catalog-v2 deploy/product-catalog`
  works out of the box.
- The `/health` endpoint doubles as the target for k8s liveness/readiness
  probes (see `k8s/*/deployment.yaml`) and the Docker `HEALTHCHECK`.
- For production-grade monitoring, the next step would be exposing a
  Prometheus `/metrics` endpoint (e.g. via `prom-client`) and scraping it
  with a `ServiceMonitor`, which isn't wired up here to keep the service
  dependency-free per the assignment's "lightweight" requirement.

## Bonus tasks

- **Vulnerability scan**: `trivy image product-catalog:v2.0.0` (or
  `docker scout cves product-catalog:v2.0.0`).
- **RBAC**: `k8s/rbac/rbac.yaml` — least-privilege, per-namespace
  ServiceAccounts/Roles/RoleBindings.
- **TLS**: `k8s/ingress/README-tls.md`.
- **Terraform cluster provisioning**: `terraform/main.tf` — provisions a
  local `kind` cluster with zero cloud credentials required
  (`cd terraform && terraform init && terraform apply`); swap the provider
  block for an EKS/GKE/AKS module for a real cloud cluster.

## Project structure

```
.
├── index.js                     # entrypoint
├── src/
│   ├── app.js                    # Express app (current = v2.0)
│   └── data.js                   # in-memory product catalogue
├── tests/
│   └── app.test.js                # Jest/Supertest suite, all 3 versions
├── Dockerfile
├── CHANGELOG.md
├── SYSTEM_DESIGN.md
├── k8s/
│   ├── v1/        namespace, deployment, service, hpa  (catalog-v1)
│   ├── v1.1/      namespace, deployment, service, hpa  (catalog-v1-1)
│   ├── v2/        namespace, deployment, service, hpa  (catalog-v2)
│   ├── ingress/   shared NGINX ingress + TLS notes
│   └── rbac/      per-namespace least-privilege RBAC
├── terraform/
│   └── main.tf     # local `kind` cluster provisioning
└── .github/workflows/ci-cd.yml
```

## What still needs to happen on your end

I've built, tested, and version-controlled everything above inside this
sandbox, but a few things require your own accounts/hardware and can't be
done from here:
- **Pushing this repo to GitHub** (making it public, per the submission
  guidelines) — the git history with all 3 tags/branches is ready to push
  as-is.
- **Filling out the submission form** with your GitHub links.
- **Recording the demo video** of it running.
- **Actually provisioning a live cluster and running `kubectl apply`** —
  the manifests are tested for correctness (valid YAML, consistent
  namespace/label/selector references) but not run against a live
  cluster from this sandbox, since no cluster is available here.
- **Docker Hub / GHCR push** — needs your registry credentials.
