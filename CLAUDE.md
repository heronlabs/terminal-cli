# terminal-cli — Heron CLI (`hcli`)

Standalone NestJS CLI. Database backup & rollup for PostgreSQL and MySQL →
S3 (or local). Built with nest-commander, AWS SDK v3, Luxon, nestjs-pino.

Binary: `hcli` → `bin/src/main.js`. Entry point: `src/main.ts` bootstraps the
`CliModule` via `CommandFactory` (nest-commander).

## Commands

| Command | What it does |
|---|---|
| `pnpm build` | `nest build --path tsconfig.bin.json` → `bin/` |
| `pnpm lint:check` | `gts lint` + eslint on JSON/YAML |
| `pnpm lint:fix` | `gts fix` + eslint `--fix` on JSON/YAML |
| `pnpm test:unit` | `VITE_CJS_IGNORE_WARNING=true vitest run` |
| `pnpm test:mutation` | `stryker run stryker.conf.json` |
| `pnpm dep:cruise` | dependency-cruiser architecture check |
| `pnpm start -- <cmd>` | run a CLI command locally (loads `.env` via dotenv) |

## CLI Commands (`hcli`)

`psql-backup`, `psql-rollup`, `mysql-backup`, `mysql-rollup`, `version`.
Flags: `-f, --filename <name>`, `--local` (filesystem instead of S3).

## Source Layout

| Path | Role |
|---|---|
| `src/main.ts` | Bootstrap — `CommandFactory.runApplication(CliModule)` |
| `src/application/cli/` | `cli-module.ts` + `commands/{backup,rollup,version}/` (nest-commander commands + option types) |
| `src/core/interfaces/` | `BackupService` / `RollupService` abstract base services (own S3 + cleanup orchestration) |
| `src/core/services/` | `{mysql,psql}-{backup,rollup}-service` — engine-specific `dump`/`restore` |
| `src/infrastructure/environment/` | `EnvironmentService` — typed wrapper over `@nestjs/config` |
| `src/infrastructure/log/` | `LogModule` — nestjs-pino global logger |
| `src/infrastructure/storage/` | `S3StorageService` — AWS SDK v3 upload/download |

## Architecture Rules (`pnpm dep:cruise`)

- No circular dependencies under `src/`.
- `core/` must not import `application/`.
- `infrastructure/` must not import `application/` or `core/`.
- `core/` MAY import `infrastructure/` — the backup/rollup base services depend on the S3 adapter by design.

## Configuration

Env vars (see `.env.example`): `DB_URL` (a `postgres://`/`mysql://`
connection URL, or an AWS SSM Parameter Store ARN resolved via
`@heronlabs/env-ssm`), and for S3 `AWS_S3_BUCKET_NAME`, `AWS_REGION`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. `DB_URL` is resolved through an
injected `SsmService` (env-ssm's `CoreBootstrap.register('DB_URL')` is imported
by `EnvironmentModule`) and parsed by the async `EnvironmentService.database()`
into the host/port/name/user/password the dump/restore services pass to engine
subprocesses via env vars.

## Testing

| Detail | Value |
|---|---|
| Framework | Vitest 4.x (`vitest.config.ts`; default transform handles NestJS decorators) |
| Test location | `tests/specs/` (mirrors `src/`) |
| Shared mocks | `tests/__mocks__/create-testing-module.ts` (moq.ts + vitest) |
| Libraries | `@faker-js/faker`, `moq.ts`, `nest-commander-testing` |
| Coverage | v8, 100% thresholds; excludes `main.ts`, `*.d.ts`, `*factory.ts`, `types/` |
| Mutation | Stryker 9.x, 100% break; mutates `src/**/*.ts` minus `main.ts`, `*.d.ts`, `*factory.ts`, `*-module.ts` |

## CI/CD

### CI (`.github/workflows/ci-cli.yml`)

Triggers on PR to `main`. Three jobs:

1. **setup** — install deps, `pnpm build`
2. **audit** (needs setup) — `pnpm dep:cruise` + `pnpm audit --prod --audit-level=high`
3. **lint-test** (needs setup) — lint, unit tests + coverage upload, mutation tests + report upload

### CD — Releases (`.github/workflows/cd-tags.yml`)

Runs automatically on every push to `main` (defaulting the bump to `patch`), plus manual `workflow_dispatch` to pick major/minor/patch. Bumps a semver tag via `heronlabs/build-tag-release-action@v2`.

| Input | Values |
|---|---|
| `spec` | major, minor, patch |

**Secret:** `PAT` must be set in GitHub repo settings.

## Docker

`Dockerfile` (general), `cron-tab-postgres.dockerfile`, `cron-tab-mysql.dockerfile`
(EasyPanel cron containers: backup on start + every 12h). `docker-compose.yml`
spins up local psql/mysql DBs + CLI containers.

## TypeScript

- Target ES2022, module CommonJS, strict, decorators on, `noUncheckedIndexedAccess`.
- Build tsconfig (`tsconfig.bin.json`) compiles `src/` only → `bin/`.

## Branching

- All work branches from `main`; PRs target `main`. Never commit directly to `main`.
