# terminal-cli — Heron CLI (`hcli`)

Standalone NestJS CLI. Database backup & rollup for PostgreSQL and MySQL →
S3 (or local). Built with nest-commander, AWS SDK v3, Luxon, nestjs-pino.

Binary: `hcli` → `bin/src/main.js`. Entry point: `src/main.ts` bootstraps the
`CliModule` via `CommandFactory` (nest-commander).

## Commands

| Command | What it does |
|---|---|
| `pnpm build` | `nest build --path tsconfig.bin.json` → `bin/` |
| `pnpm lint:check` | `gts lint` + eslint on JSON/YAML + shellcheck on `src/**/*.sh` and `tests-integration/**/*.sh` |
| `pnpm lint:fix` | `gts fix` + eslint `--fix` on JSON/YAML + shellcheck (check-only) |
| `pnpm lint:shell` | shellcheck on `src/**/*.sh` and `tests-integration/**/*.sh` (config: `.shellcheckrc`; scripts are shebang-less by design) |
| `pnpm test:unit` | `VITE_CJS_IGNORE_WARNING=true vitest run` |
| `pnpm test:integration` | Run both PostgreSQL and MySQL round-trip integration tests |
| `pnpm test:integration:postgres` | `docker compose run --build --rm psql-integration` |
| `pnpm test:integration:mysql` | `docker compose run --build --rm mysql-integration` |
| `pnpm test:mutation` | `stryker run stryker.conf.json` |
| `pnpm dep:cruise` | dependency-cruiser architecture check |
| `pnpm start -- <cmd>` | run a CLI command locally (loads `.env` via dotenv) |

## CLI Commands (`hcli`)

`psql-backup`, `psql-rollup`, `mysql-backup`, `mysql-rollup`, `version`.
Flags: `-f, --filename <name>`, `--local` (filesystem instead of S3).

Every backup and rollup command failure (database resolution, dump/restore,
S3 upload/download) exits 1: `BackupService.run` / `RollupService.run` return
`{ok: false}` and the command sets `process.exitCode = 1`; `main.ts` sets it too
for bootstrap errors and for errors thrown by a command (nest-commander's
`serviceErrorHandler`). A failed dump removes its partial file; a failed upload
still deletes the local backup unless `--local`. A failed remote rollup removes
the downloaded file, or the partial file a failed download left; `--local`
never deletes the input file. S3 transfers stream
(`@aws-sdk/lib-storage` `Upload` from `createReadStream`, download piped into
`createWriteStream`).

Sentry is opt-in via `SENTRY_DSN` (unset or empty ⇒ SDK disabled, no network).
`src/instrument.ts` (first import of `main.ts`) calls `Sentry.init` from
`process.env` with `enableLogs` + `pinoIntegration`, so nestjs-pino log lines are
sent as Sentry Logs, and `error: {levels: ['error']}` turns every `error` line
into a Sentry issue. Every backup, rollup and storage log call is
`this.logger.<level>({logId, ...fields}, logId, Class.name)`: `logId` is a
stable `<domain>.<event>` (`backup.dump-failed`, `rollup.completed`,
`storage.upload-completed`), never interpolated, and is also the message;
nestjs-pino reads the last argument as the context, so the class-name third
argument is what keeps `logId` as `msg`. `hcli version` keeps its
`Current Version: <version>` line, which is its user-facing output. Fields are
flat camelCase scalars (`engine`, `filename`, `errorName`, `errorMessage`),
never a connection string or credential; `errorMessage` goes through
`redact` (`src/infrastructure/log/redact.ts`), which replaces e-mails and
letter-and-digit tokens of 24+ characters with `[redacted]`. The shared log
standard forbids non-scalar attributes, with one pino exception: `err` (the
Error itself), on `error`-level lines only, because `pinoIntegration` turns it
into a Sentry issue with the exception type/message/stack; `main.ts` `fail` captures
bootstrap/command errors, and `Sentry.flush(2000)` runs after the app closes.
Every backup (scheduled or manual) sends an `in_progress` cron check-in to the
fixed monitor slug `terminal-cli-backup` and an `ok`/`error` one when it ends
(rollups never check in); the monitor is created in Sentry with the template
crontab schedule (`0 */12 * * *`).

## Source Layout

| Path | Role |
|---|---|
| `src/main.ts` | Bootstrap — `CommandFactory.runApplication(CliModule)` |
| `src/instrument.ts` | Sentry early init (errors, pino logs), imported first by `main.ts` |
| `src/application/cli/` | `cli-module.ts` + `commands/{backup,rollup,version}/` (nest-commander commands + option types) |
| `src/core/interfaces/` | `BackupService` / `RollupService` abstract base services (own S3 + cleanup orchestration) |
| `src/core/services/` | One folder per engine — `{mysql,psql}/` with its backup + rollup services and `.sh` scripts; shared `script-loader-service.ts` at the root |
| `src/infrastructure/environment/` | `EnvironmentService` — typed wrapper over `@nestjs/config` |
| `src/infrastructure/log/` | `LogModule` — nestjs-pino global logger; `redact` for logged error messages |
| `src/infrastructure/storage/` | `S3StorageService` — AWS SDK v3 streamed upload (`@aws-sdk/lib-storage`) / download |

## Architecture Rules (`pnpm dep:cruise`)

- No circular dependencies under `src/`.
- `core/` must not import `application/`.
- `application/` must not import `infrastructure/` (except `cli-module.ts` — the composition root).
- `infrastructure/` must not import `application/` or `core/`.
- `core/` MAY import `infrastructure/` — the backup/rollup base services depend on the S3 adapter by design.
- Production code in `src/` must not import `devDependencies` (type-only imports allowed).
- Every import from `src/` must resolve to a `package.json` dependency (no phantom deps).
- Every module in `src/` must be reachable from `main.ts` (dead-code guard).
- No orphan modules (files not imported by anything, except `.d.ts` and `main.ts`).

## Configuration

Env vars (see `.env.example`): `DATABASE_URL` (a `postgres://`/`mysql://`
connection URL, or an AWS SSM Parameter Store ARN resolved via
`@heronlabs/env-ssm`), and for S3 `AWS_S3_BUCKET_NAME`, `AWS_REGION`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; optional `SENTRY_DSN`,
`SENTRY_ENVIRONMENT` (default `production`), read from
`process.env` (locally `pnpm start` loads `.env` via dotenv-cli before
`instrument.ts` runs). `DATABASE_URL` is resolved through an
injected `SsmConfigService` (env-ssm v2 no longer ships a NestJS module, so
`EnvironmentModule` provides it via `SsmConfigFactory.make()`) and parsed by the
async `EnvironmentService.database()`
into the host/port/name/user/password the dump/restore services pass to engine
subprocesses via env vars.

## Testing

| Detail | Value |
|---|---|
| Framework | Vitest 4.x (`vitest.config.ts`; default transform handles NestJS decorators) |
| Test location | `tests/unit/` (mirrors `src/`); integration round-trips in `tests-integration/` |
| Shared mocks | `tests/__mocks__/create-testing-module.ts` (moq.ts + vitest) |
| Libraries | `@faker-js/faker`, `moq.ts`, `nest-commander-testing` |
| Coverage | v8, 100% thresholds; excludes `main.ts`, `instrument.ts`, `*.d.ts`, `*factory.ts`, `types/` |
| Mutation | Stryker 9.x, 100% break; mutates `src/**/*.ts` minus `main.ts`, `instrument.ts`, `*.d.ts`, `*factory.ts`, `*-module.ts` |

## CI/CD

### CI (`.github/workflows/continuous-integration.yml`)

Triggers on PR to `main` (plus `workflow_dispatch`). A sequential gate chain
that fans out at the end — each job `needs` the previous, so the first failure
halts the rest:

`install → audit → lint → unit → { mutation ∥ integration-postgres ∥ integration-mysql }`

1. **install** — install deps, `pnpm build` (caches `node_modules` + `bin`)
2. **audit** — `pnpm dep:cruise` + `pnpm audit --prod --audit-level=high`
3. **lint** — `pnpm lint:check`
4. **unit** — `pnpm test:unit` + coverage artifact
5. **mutation** — `pnpm test:mutation` + score step-summary + report artifact
6. **integration-test-{postgres,mysql}** — `pnpm test:integration:postgres` / `pnpm test:integration:mysql` round-trip, with a `==>`/`ok:`/`FAIL:` step-summary (these two run in parallel with **mutation**, all gated on **unit**)

### CD — Releases (`.github/workflows/continuous-deployment.yml`)

Runs automatically on every push to `main` (defaulting the bump to `patch`), plus manual `workflow_dispatch` to pick major/minor/patch. Bumps a semver tag via `heronlabs/action-tag-release-build@v6`.

| Input | Values |
|---|---|
| `semantic` | major, minor, patch |

The `publish-npm` job runs `npm publish --access public --provenance` and the
`publish-docker` job builds and pushes `heronlabs/terminal-cli` to Docker Hub.
Both run in parallel after the release tag is created, carrying
`id-token: write` (plus `contents: read`) permission — enabled now that the repo
is public, since npm only signs sigstore provenance for public source repos.

**Secret:** `PAT` must be set in GitHub repo settings.

## Docker

One generic image, `heronlabs/terminal-cli` (built from `Dockerfile`), carries
the CLI + all DB clients + the `hcli` wrapper + busybox `crond`. Scheduled
backups are deployed via `easypanel/` inline-Dockerfile templates
(`psql-backup.json`, `mysql-backup.json`) that `FROM` that base, add a crontab,
and run `crond` — see `easypanel/README.md`. `docker-compose.yml` provides the
local psql/mysql DBs (ports 5434/3307) plus the `psql-integration`/
`mysql-integration` runner services that execute the backup/rollup round-trip
integration tests inside the prod-shaped `tests-integration/{postgres,mysql}/Dockerfile`
images (`docker compose run --build --rm <svc>-integration`).

## TypeScript

- Target ES2022, module CommonJS, strict, decorators on, `noUncheckedIndexedAccess`.
- Build tsconfig (`tsconfig.bin.json`) compiles `src/` only → `bin/`.

## Branching

- All work branches from `main`; PRs target `main`. Never commit directly to `main`.
