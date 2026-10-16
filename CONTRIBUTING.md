# Contributing

Use Node.js 22 LTS and PostgreSQL 17. Copy `.env.example` to `.env`, install with `npm ci`, and apply migrations. Never commit credentials or real financial data.

Run `npm run db:generate`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration` and `npm run build` before opening a pull request. Integration tests require a separate database with `moneyflow_test` in its name.

Financial changes must include tests for decimal precision, transfer semantics and cross-user access. Keep amounts as decimal strings at API boundaries. Do not introduce floating point persistence. Use Prisma migrations for schema changes. Describe observable behavior and verification in pull requests.

Report security problems privately to the repository owner rather than publishing exploit details with real data.
