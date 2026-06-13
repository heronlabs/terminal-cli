# terminal-cli — Heron CLI (`hcli`)

Standalone NestJS CLI. Database backup & rollup for PostgreSQL and MySQL →
S3 (or local). Built with nest-commander, AWS SDK v3, Luxon, nestjs-pino.

Binary: `hcli` → `bin/src/main.js`. Entry point: `src/main.ts` bootstraps the
`CliModule` via `CommandFactory` (nest-commander).

## Commands

| Command | What it does |
|---|---|
| `pnpm build` | `nest build --path tsconfig.bin.json` → `bin/` |
| `pnpm lint:check` | `gts lint` + eslint on JSON/YAML + shellcheck on `src/**/*.sh` |
| `pnpm lint:fix` | `gts fix` + eslint `--fix` on JSON/YAML + shellcheck (check-only) |
| `pnpm lint:shell` | shellcheck on `src/**/*.sh` (config: `.shellcheckrc`; scripts are shebang-less by design) |
| `pnpm test:unit` | `VITE_CJS_IGNORE_WARNING=true vitest run` |
| `pnpm test:mutation` | `stryker run stryker.conf.json` |
| `pnpm dep:cruise` | dependency-cruiser architecture check |
| `pnpm start -- <cmd>` | run a CLI command locally (loads `.env` via dotenv) |

## CLI Commands (`hcli`)

`psql-backup`, `psql-rollup`, `mysql-backup`, `mysql-rollup`,
`easypanel-backup`, `easypanel-rollup`, `version`.
Flags: `-f, --filename <name>`, `--local` (filesystem instead of S3).

The `easypanel-*` commands snapshot an EasyPanel host (config + Docker state) to
a `.tar.gz` rather than a database; they run natively on the host **as root**
(stop Docker → tar → restart) and use only the `AWS_*` env vars.

## Source Layout

| Path | Role |
|---|---|
| `src/main.ts` | Bootstrap — `CommandFactory.runApplication(CliModule)` |
| `src/application/cli/` | `cli-module.ts` + `commands/{backup,rollup,version}/` (nest-commander commands + option types) |
| `src/core/interfaces/` | `BackupService` / `RollupService` abstract base services (own S3 + cleanup orchestration) |
| `src/core/services/` | One folder per engine — `{easy-panel,mysql,psql}/` with its backup + rollup services (`easy-panel/` also holds its `.sh` scripts); shared `script-loader-service.ts` at the root |
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
injected `SsmConfigService` (env-ssm v2 no longer ships a NestJS module, so
`EnvironmentModule` provides it via `SsmConfigFactory.make()`) and parsed by the
async `EnvironmentService.database()`
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

Runs automatically on every push to `main` (defaulting the bump to `patch`), plus manual `workflow_dispatch` to pick major/minor/patch. Bumps a semver tag via `heronlabs/action-tag-release-build@v3`.

| Input | Values |
|---|---|
| `spec` | major, minor, patch |

The `publish-npm` job runs `npm publish --access public --provenance` and carries
`id-token: write` (plus `contents: read`) permission — enabled now that the repo
is public, since npm only signs sigstore provenance for public source repos.

**Secret:** `PAT` must be set in GitHub repo settings.

## Docker

`Dockerfile` (general), `cron-tab-postgres.dockerfile`, `cron-tab-mysql.dockerfile`
(EasyPanel cron containers: backup on start + every 12h). `docker-compose.yml`
spins up local psql/mysql DBs + CLI containers.

`easypanel/` holds paste-able EasyPanel "Create from Schema" templates
(`psql-backup.json`, `mysql-backup.json` + README) that run the generic published
image with the backup cron defined **in the template** (file mount at
`/etc/crontabs/root`) instead of a baked-in cron-tab image.

## TypeScript

- Target ES2022, module CommonJS, strict, decorators on, `noUncheckedIndexedAccess`.
- Build tsconfig (`tsconfig.bin.json`) compiles `src/` only → `bin/`.

## Branching

- All work branches from `main`; PRs target `main`. Never commit directly to `main`.
