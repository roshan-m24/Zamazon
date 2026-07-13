# Changelog

All notable changes to this project are documented in this file.
This project follows [Semantic Versioning](https://semver.org/).

## [2.0.0]

### Added
- `/products/search` now supports `category`, `minPrice`, and `maxPrice`
  query parameters, combinable with `keyword`.
- Input validation + `400` error responses for malformed query parameters
  (non-numeric price bounds, `minPrice > maxPrice`, unknown category).
- Centralized error-handling middleware; internal errors return a generic
  `500` without leaking stack traces.

## [1.1.0]

### Added
- `GET /products/search?keyword=` — case-insensitive keyword search across
  product name, category, and keyword tags. Returns the full catalogue if
  no keyword is supplied.

## [1.0.0] - Base release

### Added
- `GET /health` — liveness/readiness endpoint.
- `GET /products` — returns the full product catalogue.
- Dockerfile (multi-stage, Alpine, non-root, healthcheck).
- Jest/Supertest test suite.
