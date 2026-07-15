# Backend conventions — SFx Lite API


## Module layout
Every domain module follows the same shape:

```
src/modules/<domain>/
├── <domain>.module.ts
├── <domain>.controller.ts       # HTTP layer only — no business logic
├── <domain>.service.ts          # business logic — no HTTP concepts
├── dto/                          # class-validator DTOs (request contracts)
├── entities/                     # TypeORM entities (*.entity.ts)
└── <domain>.service.spec.ts      # at minimum, service unit tests
```

## Rules
1. **Controllers are thin.** Parse/validate in DTOs, delegate to services, return plain data —
   the global interceptor wraps the envelope.
2. **Services own transactions.** Any multi-row money operation runs in a single
   `dataSource.transaction()` with `pessimistic_write` locks on balance rows.
3. **DTO validation is the contract.** Every body/query/param has a DTO with class-validator
   decorators. No `any` request shapes.
4. **Errors are Nest HttpExceptions** with clear messages. Never throw raw strings; never leak
   internals (the filter handles 500s).
5. **Migrations only.** Entity change → `npm run migration:generate` → review the SQL → commit.
6. **Swagger on everything.** `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth` where relevant.
7. **Idempotency for money.** Deposits: unique index on tx hash. Transfers/withdrawals: accept an
   idempotency key, return the original result on replay.
8. **No console.log.** Use Nest `Logger` with a named context. Never log tokens, PINs, KYC URLs.
9. **Scheduled jobs** (`@nestjs/schedule`) must be safe to run twice — assume overlap and crashes.
