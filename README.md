# SFx Lite API

A modular **cross-border payments & FX backend** built with NestJS. SFx Lite lets
users hold a stablecoin balance, deposit and withdraw **USDC on Polygon**, convert
between currencies at live FX rates, send transfers to saved beneficiaries, complete
KYC, and get help from an AI support assistant — all behind a double-entry ledger that
keeps every balance provable.

**Stack:** NestJS 11 · TypeScript · PostgreSQL (Neon, `pgvector`) · TypeORM · Redis
(optional) · ethers v6 · Resend · Cloudinary · Voyage AI + Anthropic · deployed on Render.

> Built as part of the **SFx Lite Intern Build Program**. See
> [`docs/BACKEND_CONVENTIONS.md`](docs/BACKEND_CONVENTIONS.md) for the coding rules every
> module follows and [`docs/SFx-Lite-Boilerplate-Guide.html`](docs/SFx-Lite-Boilerplate-Guide.html)
> for the boilerplate walkthrough.

---

## Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [Domain modules](#domain-modules)
- [API shape & conventions](#api-shape--conventions)
- [Authentication & authorization](#authentication--authorization)
- [Money & the ledger](#money--the-ledger)
- [On-chain wallets](#on-chain-wallets)
- [AI support (RAG chat)](#ai-support-rag-chat)
- [Database & migrations](#database--migrations)
- [Scheduled jobs](#scheduled-jobs)
- [CLI](#cli)
- [Testing](#testing)
- [Deployment](#deployment)

---

## What it does

SFx Lite is the backend for a lightweight remittance / neobank-style app. The core user
journeys it supports:

- **Sign up & sign in** — email/username + password or Google, with optional
  email-OTP two-factor authentication and a separate transaction PIN for money actions.
- **Verify identity (KYC)** — submit documents, tracked through a status machine, with
  email notifications on each decision.
- **Fund a wallet** — each user gets an on-chain deposit address; incoming USDC on
  Polygon is detected, confirmed, and credited automatically.
- **Move money** — convert currencies at live FX rates, send transfers to saved
  beneficiaries, and withdraw USDC back on-chain — all fee-aware and idempotent.
- **Stay informed** — in-app notifications and transactional emails.
- **Get help** — an AI assistant answers product questions grounded in ingested docs.
- **Be governed** — every sensitive action is audit-logged; admins get dashboards,
  revenue reporting, and hot-wallet gas monitoring behind role-based access control.

## Architecture

SFx Lite is a single NestJS application organized into **feature modules** under
`src/modules`. Cross-cutting behavior (auth, rate limiting, logging, response shaping,
error handling, caching) is wired once at the application root and applies everywhere.

```
                       ┌──────────────────────────────────────────┐
   HTTP request ─────► │  Middleware: request-id → http-logger     │
                       ├──────────────────────────────────────────┤
                       │  Guards:  JwtAuth → Roles → Throttler     │
                       ├──────────────────────────────────────────┤
                       │  Controller (thin)  →  Service (logic)    │
                       │                         │                 │
                       │                         ▼                 │
                       │         TypeORM ── PostgreSQL (Neon)      │
                       │         ethers  ── Polygon RPC (Alchemy)  │
                       │         Redis / in-memory cache           │
                       ├──────────────────────────────────────────┤
                       │  Interceptors: Transform → Timeout →Cache │
                       │  Filter: AllExceptions (envelope + 500s)  │
                       └──────────────────────────────────────────┘
   HTTP response ◄──── every response wrapped as { status, message, data }
```

Global providers registered in `app.module.ts`:

- **Guards** run in order — `JwtAuthGuard` (authentication) → `RolesGuard`
  (authorization) → `AppThrottlerGuard` (rate limiting).
- **Interceptors** — `TransformResponseInterceptor` (uniform envelope),
  `TimeoutInterceptor` (per-request timeout), `ResponseCacheInterceptor` (opt-in caching).
- **Filter** — `AllExceptionsFilter` normalizes errors and hides internals on 500s.
- **Middleware** — `RequestIdMiddleware` (correlation id) and `HttpLoggerMiddleware`.

## Tech stack

| Concern            | Choice |
| ------------------ | ------ |
| Framework          | NestJS 11 (Express platform) |
| Language           | TypeScript 5.7 |
| Database           | PostgreSQL on Neon, with the `pgvector` extension |
| ORM                | TypeORM 0.3 (migrations, not `synchronize`) |
| Cache              | Redis via `ioredis` — **optional**, falls back to in-memory |
| Auth               | JWT (access + refresh) via `@nestjs/jwt` + Passport, Google OAuth 2.0 |
| Blockchain         | `ethers` v6 against Polygon (Amoy testnet), USDC ERC-20 |
| Email              | Resend |
| File storage       | Cloudinary (KYC documents, profile images) |
| AI                 | Voyage AI (embeddings) + Anthropic (chat) over `pgvector` |
| Rate limiting      | `@nestjs/throttler` (per-IP and per-user) |
| Scheduling         | `@nestjs/schedule` |
| API docs           | Swagger / OpenAPI (`@nestjs/swagger`) |
| Validation         | `class-validator` + `class-transformer` DTOs |
| CLI                | `nest-commander` + `@clack/prompts` |
| Security           | Helmet, CORS allow-list, bcrypt password/PIN hashing |

## Quick start

**Prerequisites:** Node.js 20+, npm, and access to the shared Neon Postgres connection
string (ask the team — it is never committed).

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
#    A .env is generated automatically from .env.example on first run,
#    or copy it yourself:
cp .env.example .env
#    …then fill in DATABASE_URL, JWT secrets, and any providers you need.

# 3. Run outstanding database migrations
npm run migration:run

# 4. (optional) Seed demo data
npm run seed

# 5. Start in watch mode
npm run start:dev
```

The API is then available at **`http://localhost:4000/api/v1`** and interactive Swagger
docs at **`http://localhost:4000/docs`** (development only — docs are disabled in
production).

### Common scripts

| Script | What it does |
| ------ | ------------ |
| `npm run start:dev` | Start with hot reload |
| `npm run start:prod` | Run the compiled build (`dist/main`) |
| `npm run build` | Compile with the Nest CLI |
| `npm run lint` | ESLint (auto-fix) |
| `npm run format` | Prettier |
| `npm run type-check` | `tsc --noEmit` |
| `npm test` / `test:watch` / `test:cov` | Jest unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run migration:generate` | Generate a migration from entity changes |
| `npm run migration:run` / `migration:revert` | Apply / roll back migrations |
| `npm run seed` | Seed demo data |
| `npm run wallet:check` | Check the master wallet's gas balance |
| `npm run cli` | Run the interactive CLI (e.g. doc ingestion) |

## Configuration

All configuration comes from environment variables. A typed, validated view of them lives
in [`src/config/env.ts`](src/config/env.ts) — import `env` anywhere rather than reading
`process.env` directly. Validation rules are in `src/config/env.validation.ts`, and a
`prestart`/`prebuild` hook (`scripts/ensure-env.js`) guarantees a `.env` exists.

Key groups (see [`.env.example`](.env.example) for the full, annotated list):

| Group | Variables | Notes |
| ----- | --------- | ----- |
| **App** | `NODE_ENV`, `PORT`, `API_PREFIX`, `API_VERSION`, `FRONTEND_URL` | Routes mount at `/{API_PREFIX}/v{API_VERSION}` |
| **CORS** | `CORS_ORIGINS` | Comma-separated allow-list |
| **Rate limiting** | `THROTTLE_TTL_SECONDS`, `THROTTLE_LIMIT_IP`, `THROTTLE_LIMIT_USER` | Anonymous by IP, authenticated by user id |
| **Database** | `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_LOGGING` | Shared Neon Postgres; SSL required |
| **Cache** | `REDIS_URL`, `CACHE_TTL_SECONDS`, `CACHE_MAX_ITEMS` | Leave `REDIS_URL` empty for in-memory |
| **Auth** | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `*_EXPIRES_IN`, `GOOGLE_*` | Access + refresh secrets; Google OAuth |
| **Blockchain** | `ALCHEMY_AMOY_RPC_URL`, `MASTER_WALLET_MNEMONIC`, `USDC_TOKEN_ADDRESS`, `DEPOSIT_CONFIRMATIONS`, `GETLOGS_MAX_RANGE`, sweep/withdrawal tunables | Mnemonic is a secret |
| **Storage** | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | KYC uploads |
| **AI** | `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY` | Chat + embeddings |
| **Email** | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional email |
| **Root admin** | `ROOT_ADMIN_EMAIL`, `ROOT_ADMIN_PASSWORD`, `ROOT_ADMIN_USERNAME` | Self-provisioning `super_admin` on first login |
| **Fees** | `LOCAL_TRANSFER_FEE_PERCENTAGE`, `INTERNATIONAL_TRANSFER_FEE_PERCENTAGE`, `MINIMUM_TRANSFER_FEE`, `MAXIMUM_TRANSFER_FEE` | Transfer fee bands |

> **Never commit secrets.** The database is a shared cloud instance; get its connection
> string from the team, not from source control.

## Project structure

```
src/
├── main.ts                  # bootstrap: helmet, CORS, versioning, validation, Swagger
├── app.module.ts            # global guards / interceptors / filters + feature wiring
├── cli.ts / cli.module.ts   # nest-commander entrypoint
├── config/                  # env (typed), validation, configuration, swagger
├── common/                  # cross-cutting building blocks
│   ├── cache/               # Redis factory, cache service, response-cache interceptor
│   ├── decorators/          # @Public, @Roles, @CurrentUser, @IsStrongPassword
│   ├── entities/            # BaseEntity (id, timestamps)
│   ├── filters/             # AllExceptionsFilter
│   ├── guards/              # JwtAuth, Roles, KycVerified, Throttler
│   ├── interceptors/        # transform-response, timeout
│   ├── middleware/          # request-id, http-logger
│   └── utils/               # money (decimal-safe), password, response helpers
├── database/                # data-source, module, migrations/, seeders/, seed.ts
└── modules/                 # one folder per domain (see below)
```

Every domain module follows the same shape: a thin **controller** (HTTP only), a
**service** (business logic), `dto/` (validated request contracts), `entities/` (TypeORM),
and at least a `*.service.spec.ts`. See `docs/BACKEND_CONVENTIONS.md`.

## Domain modules

| Module | Responsibility |
| ------ | -------------- |
| **auth** | Registration, login (password / Google), JWT issue & refresh, transaction PIN, email-OTP 2FA, password & PIN reset, admin login, root-admin provisioning |
| **users** | Profile, addresses, account tier, KYC status, password change, admin user listing |
| **kyc** | Document submission, status machine (unverified → pending → under review → verified/rejected), decision emails |
| **wallets** | Per-user on-chain deposit addresses, deposit watcher, escrow sweep, reconciliation |
| **chain** | Low-level Polygon/ethers access and the USDC ERC-20 ABI |
| **ledger** | Double-entry ledger — entries, transactions, balance locking, insufficient-funds handling |
| **transactions** | Transfers between accounts, transaction history/views, fee application, idempotency |
| **withdrawals** | On-chain USDC withdrawals with confirmation polling |
| **fx** | Live exchange rates, scheduled rate sync, currency conversion, fee calc |
| **fees** | Transfer fee calculation (local vs international, min/max bands) |
| **beneficiaries** | Saved transfer recipients |
| **notifications** | In-app user notifications |
| **email** | Resend-backed transactional email + HTML templates |
| **admin** | Stats overview, revenue reporting, master-wallet gas health |
| **audit** | Audit log of sensitive actions (categories + severity levels) |
| **analytics** | Event capture and dashboard/reporting SQL views |
| **rag** | Document ingestion, embeddings, `pgvector` retrieval |
| **chat** | AI support conversations & messages (grounded via RAG) |
| **uploads** | Cloudinary uploads (KYC docs, profile images) |
| **health** | Liveness/readiness checks (`@nestjs/terminus`) |

## API shape & conventions

- **Base path:** `/api/v1` (URI versioning). Global prefix + default version are set in
  `main.ts`.
- **Uniform envelope:** every successful response is wrapped by
  `TransformResponseInterceptor` as:

  ```json
  { "status": true, "message": "…", "data": { } }
  ```

- **Validation:** a global `ValidationPipe` strips unknown properties
  (`whitelist`), rejects unexpected ones (`forbidNonWhitelisted`), and casts params to
  DTO types. Every request body/query/param has a `class-validator` DTO.
- **Errors:** thrown as Nest `HttpException`s and normalized by `AllExceptionsFilter`;
  internals never leak on 500s.
- **Correlation:** every request carries an `x-request-id` (generated if absent) and is
  logged with method, path, status, and latency.
- **Idempotency for money:** deposits are deduped by a unique tx-hash index; transfers
  and withdrawals accept an idempotency key and replay the original result.
- **Docs:** Swagger is generated from `@ApiTags` / `@ApiOperation` / `@ApiResponse`
  decorators on controllers and `@ApiProperty` on DTOs — browse it at `/docs` in dev.

## Authentication & authorization

Authentication is **JWT-based** with short-lived access tokens and longer-lived refresh
tokens. `JwtAuthGuard` protects every route by default; opt a route out with the
`@Public()` decorator.

Highlights:

- **Login** with email *or* username + password (`POST /auth/login`). Regular users only —
  admin accounts are rejected here and must use `POST /auth/admin/login`.
- **Google sign-in** for SPA/mobile: verify a Google ID token server-side
  (`POST /auth/google/verify`), with an optional single-use nonce
  (`GET /auth/google/nonce`) for replay protection.
- **Two-factor auth (email OTP):** when enabled, login returns a challenge
  (`requiresOtp` + `otpToken`) instead of tokens; the user completes it at
  `POST /auth/login/otp` (resend via `POST /auth/login/otp/resend`).
- **Transaction PIN:** a separate 4-digit PIN gates sensitive money actions
  (`POST /auth/pin`, `/auth/pin/verify`, `/auth/pin/reset`), with lockout after repeated
  failures.
- **Password reset:** request a link (`POST /auth/forgot_password`) and consume the
  single-use, time-limited token (`POST /auth/reset_password/:token`). Reset tokens are
  stored only as SHA-256 hashes.
- **RBAC:** roles are `user`, `admin`, and `super_admin`. `RolesGuard` + the `@Roles()`
  decorator protect admin surfaces; the `KycVerifiedGuard` gates actions that require a
  verified identity. The **root admin** (`ROOT_ADMIN_EMAIL`) self-provisions as
  `super_admin` on first admin login; all other admins are promoted by a `super_admin`.

Passwords and PINs are hashed with **bcrypt**; tokens, PINs, and KYC URLs are never
logged.

## Money & the ledger

Balances are tracked with a **double-entry ledger** rather than a single mutable balance
column, so every credit has a matching debit and balances are always reconstructable.

- Multi-row money operations run inside a single `dataSource.transaction()` with
  **pessimistic write locks** on the affected balance rows — no lost updates under
  concurrency.
- Money math uses a decimal-safe helper (`common/utils/money.ts`), never floats.
- Insufficient funds raise a typed `InsufficientFundsException`.
- Transfers and withdrawals are **idempotent**: replaying the same idempotency key returns
  the original outcome instead of double-spending.

## On-chain wallets

SFx Lite custodies **USDC on Polygon** (Amoy testnet in this build).

- Each user is assigned a **deterministically derived deposit address** (HD wallet from a
  master mnemonic; a derivation sequence keeps indexes unique).
- A **deposit watcher** polls the chain (`eth_getLogs`, paged by `GETLOGS_MAX_RANGE` to
  respect free-tier RPC limits), waits for `DEPOSIT_CONFIRMATIONS`, and credits the ledger
  once — crediting is idempotent so overlapping scans are safe.
- A **sweep job** drips a little POL to funded deposit addresses so they can pay gas, then
  sweeps their USDC into the master wallet (skipping dust below `SWEEP_MIN_USDC`).
- **Withdrawals** broadcast an on-chain USDC transfer and flip `processing → successful`
  after `WITHDRAWAL_CONFIRMATIONS`.
- A **reconciliation service** cross-checks on-chain state against the ledger, and
  **master-wallet gas health** monitoring warns admins when the hot wallet's POL balance
  falls below `MIN_POL_FLOOR` (also checkable via `npm run wallet:check`).

## AI support (RAG chat)

The `rag` and `chat` modules provide a support assistant grounded in your own docs:

- Documents are **ingested** (via the CLI), chunked, embedded with **Voyage AI**, and
  stored in a `pgvector` column.
- At query time, the user's question is embedded, the nearest chunks are retrieved, and
  **Anthropic** answers using that context.
- Conversations and messages are persisted (with token/latency/cost accounting captured
  for admin cost dashboards).

## Database & migrations

- **PostgreSQL on Neon** with the `pgvector` extension enabled (see the pgvector
  migration).
- **TypeORM with migrations only** — `synchronize` is off. Change an entity, generate a
  migration, review the SQL, then commit:

  ```bash
  npm run migration:generate    # diff entities → src/database/migrations/
  npm run migration:run         # apply
  npm run migration:revert      # roll back the last one
  ```

- Reporting **SQL views** (dashboards, KYC SLA, cohort analysis, send funnel, chatbot
  cost/failure) are themselves shipped as migrations under `src/database/migrations/`.
- **Seeders** for users, wallets, FX rates, beneficiaries, KYC submissions, and
  notifications live in `src/database/seeders/`; run them with `npm run seed`.

## Scheduled jobs

Powered by `@nestjs/schedule`. All jobs are written to be **safe to run twice** (assume
overlap and crashes):

- **FX rate sync** — refreshes exchange rates on an interval.
- **Deposit watcher** — polls for and credits incoming USDC deposits.
- **Escrow sweep** — moves swept USDC into the master wallet (`SWEEP_INTERVAL_MS`).
- **Withdrawal confirmation** — polls pending withdrawals for confirmations
  (`WITHDRAWAL_POLL_MS`).

## CLI

An interactive CLI (`nest-commander` + `@clack/prompts`) is available for operational
tasks such as ingesting documents into the RAG store:

```bash
npm run cli
```

## Testing

```bash
npm test           # unit tests (Jest)
npm run test:watch # watch mode
npm run test:cov   # coverage
npm run test:e2e   # end-to-end
```

Every service ships at least a `*.service.spec.ts`; critical paths (ledger, KYC status
machine, wallets/deposit watcher, transfers, chat) have their own specs.

## Deployment

Deployed on **Render**.

- The app trusts Render's proxy (`trust proxy`) so rate limiting sees real client IPs.
- Security middleware (Helmet, compression) and a CORS allow-list are enabled in
  `main.ts`.
- **Swagger is disabled in production.**
- `enableShutdownHooks()` lets in-flight ledger writes finish on deploys.
- Production runs the compiled build: `npm run start:prod` (`node dist/main`).

---

*Follow [`docs/BACKEND_CONVENTIONS.md`](docs/BACKEND_CONVENTIONS.md) for the module layout
and rules all contributions are expected to meet.*
