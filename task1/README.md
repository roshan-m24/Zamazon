# Identity Reconciliation Service

A service that consolidates multiple orders placed with different `email` /
`phoneNumber` combinations into a single logical customer identity, via one
endpoint: `POST /identify`.

## How it works

Every contact is stored as a row with:

| field          | type              | meaning                                             |
|----------------|-------------------|------------------------------------------------------|
| id             | Int               | primary key                                          |
| email          | String?           | optional                                              |
| phoneNumber    | String?           | optional                                              |
| linkedId       | Int?              | id of the primary contact this one belongs to         |
| linkPrecedence | "primary"\|"secondary" | "primary" if this is the first contact in the chain |
| createdAt / updatedAt / deletedAt | DateTime | bookkeeping |

When a request comes in:

1. **No existing contact matches** the email or phone → a brand new
   `primary` contact is created.
2. **Some existing contact matches** → all matches are traced back to their
   primary contact(s).
   - If the request bridges **two different primary chains** (e.g. the
     email belongs to one customer's chain and the phone belongs to
     another's), the **older** primary (by `createdAt`) stays primary; the
     newer one — and everything linked to it — is converted to `secondary`
     and re-linked under the older one.
   - If the request contains an email or phone number **not yet seen** in
     the consolidated group, a new `secondary` contact is created to record
     that new information.
   - If the request is a pure repeat of already-known info, nothing new is
     written.
3. The endpoint always returns the fully consolidated view of that identity.

### Example

```
POST /identify
{ "email": "lorraine@hillvalley.edu", "phoneNumber": "123456" }

200 OK
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

```
POST /identify
{ "email": "mcfly@hillvalley.edu", "phoneNumber": "123456" }

200 OK
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

## Running locally

Requirements: Node.js 18+.

```bash
npm install
cp .env.example .env
npm start
# Service listens on http://localhost:3000
```

Try it:

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"lorraine@hillvalley.edu","phoneNumber":"123456"}'
```

## Running tests

```bash
npm test
```

This runs a full Jest + Supertest suite (9 tests) against the real
Express app and a disposable SQLite database, covering: new contact
creation, secondary creation, duplicate/no-op requests, the two-primaries
merge scenario, single-field requests, and input validation.

## Running with Docker

```bash
docker build -t identity-reconciliation .
docker run -p 3000:3000 -v $(pwd)/data:/app/data -e DB_PATH=/app/data/data.sqlite identity-reconciliation
```

The image is a multi-stage Alpine build, runs as a non-root user, and
ships a container `HEALTHCHECK` against `/health`.

## Database choice / using Postgres instead

SQLite (via `better-sqlite3`) is used so the project runs with **zero
external setup** — no DB server to install, no docker-compose needed to try
it out. All SQL in `src/db.js` / `src/identityService.js` is plain,
portable SQL. To swap to Postgres in production:

1. Replace `better-sqlite3` with `pg` (or an ORM of your choice).
2. Reimplement `src/db.js` to open a `pg.Pool` instead of a SQLite file,
   and run the equivalent `CREATE TABLE` (types map directly:
   `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`, `TEXT` →
   `VARCHAR`/`TIMESTAMPTZ` as appropriate).
3. `src/identityService.js` doesn't need to change — it only uses
   parameterized `SELECT`/`INSERT`/`UPDATE` statements.

## API error handling

- Malformed payloads (wrong types) → `400`.
- Missing both `email` and `phoneNumber` → `400`.
- Unexpected server errors are logged in full server-side but returned to
  the caller as a generic `{"error": "Unable to process request"}` with
  status `500` — no stack traces, schema details, or internals are ever
  exposed in a response.
- Unknown routes → generic `404`.

## Project structure

```
.
├── index.js                  # entrypoint
├── src/
│   ├── app.js                 # Express app + routes
│   ├── db.js                  # SQLite connection + schema
│   └── identityService.js     # core reconciliation algorithm
├── tests/
│   └── identify.test.js       # Jest/Supertest suite
├── Dockerfile
└── .env.example
```
