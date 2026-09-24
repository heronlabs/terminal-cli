# terminal-cli — Heron CLI (`hcli`)

Standalone NestJS CLI. Database backup & rollup for PostgreSQL and MySQL →
S3 (or local), with a long-running scheduler (`hcli run`) and optional Sentry
monitoring. Built with nest-commander, AWS SDK v3, Luxon, nestjs-pino, croner,
`@sentry/node`.

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

`run`, `psql-backup`, `psql-rollup`, `mysql-backup`, `mysql-rollup`,
`backups-list`, `version`.
Flags: `-f, --filename <name>`, `--local` (filesystem instead of S3); rollups
also take `--latest` (newest S3 backup of the database; excludes `--filename`
and `--local`) and `--force` (restore into a database that has tables).

`hcli run` schedules the backup of `BACKUP_ENGINE` with `croner` on
`BACKUP_SCHEDULE` (UTC, no overlap), backs up on start unless
`BACKUP_ON_START=false`, and stops on SIGTERM/SIGINT after the backup in flight;
a missing engine or invalid schedule exits 1. Every command goes through
`JobRunnerService`: a `job.id`, the job attributes in an `AsyncLocalStorage`, the
shared lock file (`<tmpdir>/hcli.lock`, stale-pid recovery) for backups and
rollups, the Sentry check-in of the scheduled backup, and the error capture. A
rollup refuses a non-empty target database (table count via
`{psql,mysql}-count-tables.sh`) unless `--force`: exit 1, a warning, no Sentry
issue.

Every backup and rollup command failure (database resolution, dump/restore,
S3 upload/download) exits 1: `BackupService.run` / `RollupService.run` return
`{ok: false, error}` (a `JobResult`), `JobRunnerService.run` turns it into a
`failed` outcome and the command sets `process.exitCode = 1`; `main.ts` sets it
too for bootstrap errors and for errors thrown by a command (nest-commander's
`serviceErrorHandler`), reports them to Sentry, and closes the app so Sentry
flushes. A failed dump removes its partial file; a failed upload
still deletes the local backup unless `--local`. A failed remote rollup removes
the downloaded file, or the partial file a failed download left; `--local`
never deletes the input file. S3 transfers stream
(`@aws-sdk/lib-storage` `Upload` from `createReadStream`, download piped into
`createWriteStream`).

## Source Layout

| Path | Role |
|---|---|
| `src/main.ts` | Bootstrap — `CommandFactory.runApplication(CliModule)` |
| `src/application/cli/` | `cli-module.ts` + `commands/{backup,rollup,backups-list,run,version}/` (nest-commander commands + option types) |
| `src/core/interfaces/` | `BackupService` / `RollupService` abstract base services (own S3 + cleanup orchestration, rollup request validation + empty-database guard) |
| `src/core/services/` | One folder per engine — `{mysql,psql}/` with its backup + rollup services and `.sh` scripts; `job/` (lock + runner), `backup-list/`, `schedule/` (croner); shared `script-loader-service.ts` at the root |
| `src/core/types/` | `JobResult`, `JobOptions`, `JobOutcome` |
| `src/infrastructure/environment/` | `EnvironmentService` — typed wrapper over `@nestjs/config` (database, storage, monitoring, schedule, release) |
| `src/infrastructure/log/` | `LogModule` — nestjs-pino + `BridgeLoggerService` (every log line to pino and Sentry Logs) |
| `src/infrastructure/monitoring/` | `MonitoringModule` — `MonitoringService` (`@sentry/node` init, logs, errors, check-ins, flush), `JobContextService` (`AsyncLocalStorage`), `SecretScrubberService` |
| `src/infrastructure/storage/` | `S3StorageService` — AWS SDK v3 streamed upload (`@aws-sdk/lib-storage`) / download / list |

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
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. `DATABASE_URL` is resolved through an
injected `SsmConfigService` (env-ssm v2 no longer ships a NestJS module, so
`EnvironmentModule` provides it via `SsmConfigFactory.make()`) and parsed by the
async `EnvironmentService.database()`
into the host/port/name/user/password the dump/restore services pass to engine
subprocesses via env vars.

Scheduler and Sentry (all optional except `BACKUP_ENGINE` for `hcli run`):
`BACKUP_ENGINE` (`psql` | `mysql`), `BACKUP_SCHEDULE` (`0 */12 * * *`),
`BACKUP_ON_START` (`true`), `SENTRY_DSN` (unset or empty disables Sentry — no
network calls), `SENTRY_ENVIRONMENT` (`production`), `SENTRY_MONITOR_SLUG`
(enables the scheduled backup's cron check-ins), `SENTRY_MONITOR_MAX_RUNTIME`
(`60` minutes). Logs and errors carry `command`, `job`, `job.id`, `trigger`;
`beforeSend`/`beforeSendLog` redact URL credentials, `PGPASSWORD=`, `MYSQL_PWD=`,
`AWS_SECRET_ACCESS_KEY=` and `AKIA…` keys. Release: `terminal-cli@<version>`.

## Testing

| Detail | Value |
|---|---|
| Framework | Vitest 4.x (`vitest.config.ts`; default transform handles NestJS decorators) |
| Test location | `tests/unit/` (mirrors `src/`) |
| Shared mocks | `tests/__mocks__/create-testing-module.ts` (moq.ts + vitest) |
| Libraries | `@faker-js/faker`, `moq.ts`, `nest-commander-testing` |
| Coverage | v8, 100% thresholds; excludes `main.ts`, `*.d.ts`, `*factory.ts`, `types/` |
| Mutation | Stryker 9.x, 100% break; mutates `src/**/*.ts` minus `main.ts`, `*.d.ts`, `*factory.ts`, `*-module.ts` |

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
the CLI + all DB clients + the `hcli` wrapper. Scheduled backups are deployed
via `easypanel/` inline-Dockerfile templates (`psql-backup.json`,
`mysql-backup.json`) that `FROM` that base and run `CMD ["hcli", "run"]`,
configured by env — see `easypanel/README.md`. `docker-compose.yml` provides the
local psql/mysql DBs (ports 5434/3307) plus the `psql-integration`/
`mysql-integration` runner services that execute the backup/rollup round-trip
integration tests inside the prod-shaped `tests-integration/{postgres,mysql}/Dockerfile`
images (`docker compose run --build --rm <svc>-integration`).

## TypeScript

- Target ES2022, module CommonJS, strict, decorators on, `noUncheckedIndexedAccess`.
- Build tsconfig (`tsconfig.bin.json`) compiles `src/` only → `bin/`.

## Branching

- All work branches from `main`; PRs target `main`. Never commit directly to `main`.
