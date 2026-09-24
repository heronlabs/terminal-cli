# 🪶 terminal-cli — Heron CLI (`hcli`)

[![npm version](https://img.shields.io/npm/v/@heronlabs/terminal-cli.svg)](https://www.npmjs.com/package/@heronlabs/terminal-cli)
[![license](https://img.shields.io/npm/l/@heronlabs/terminal-cli.svg)](./LICENSE)
[![CI](https://github.com/heronlabs/terminal-cli/actions/workflows/continuous-integration.yml/badge.svg)](https://github.com/heronlabs/terminal-cli/actions/workflows/continuous-integration.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.x-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11.x-e0234e.svg)](https://nestjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Database backup & rollup CLI for PostgreSQL and MySQL. Dumps a database to a
gzipped SQL file, uploads it to S3 (or keeps it local), and restores it back on
demand. Built with NestJS + [nest-commander](https://nest-commander.jaymcdoniel.dev/),
AWS S3, and Luxon. Designed to run as a scheduled cron container on EasyPanel.

## Table of Contents

- [Why This Project](#why-this-project)
- [Install](#install)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Docker & Cron](#docker--cron)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Why This Project

Scheduled, type-safe database backups with a single binary:

- **One tool, two engines** — PostgreSQL (`pg_dump`/`psql`) and MySQL (`mysqldump`/`mysql`) behind one CLI.
- **S3 or local** — push backups to S3 by default, or keep them on disk with `--local` (handy for seeding).
- **Cron-ready container** — one image plus `easypanel/` inline-Dockerfile templates run a backup on start and every 12 hours.
- **100% tested** — v8 coverage + Stryker mutation testing, both at 100% thresholds.

## Install

`hcli` is a global CLI binary. Install it globally to put `hcli` on your `PATH`:

```bash
npm i -g @heronlabs/terminal-cli
# or: pnpm add -g @heronlabs/terminal-cli
```

Then run any command:

```bash
hcli version
hcli psql-backup
```

You also need the database client tools for the engine you back up: `pg_dump` /
`psql` for PostgreSQL, `mysqldump` / `mysql` for MySQL.

## Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | `>=22` | Runtime |
| pnpm | `>=10.33.2` | Package manager |
| `pg_dump` / `psql` | — | PostgreSQL backup/restore |
| `mysqldump` / `mysql` | — | MySQL backup/restore |

### From source (development)

```bash
git clone https://github.com/heronlabs/terminal-cli.git
cd terminal-cli
pnpm install
pnpm build         # nest build → bin/
```

After `pnpm build`, run the CLI via `node bin/src/main.js <command>` or link the
`hcli` bin (`pnpm link --global`).

### Verify

```bash
pnpm build         # nest build → bin/
pnpm lint:check    # gts + eslint
pnpm test:unit     # vitest run (100% coverage)
pnpm test:integration  # PostgreSQL + MySQL round-trip (requires Docker)
pnpm test:mutation # stryker (100% break)
pnpm dep:cruise    # architecture check
```

## Commands

| Command | Description |
|---|---|
| `hcli psql-backup` | Back up a PostgreSQL database (S3 by default) |
| `hcli psql-rollup --filename <file>` | Restore a PostgreSQL database from a backup |
| `hcli mysql-backup` | Back up a MySQL database (S3 by default) |
| `hcli mysql-rollup --filename <file>` | Restore a MySQL database from a backup |
| `hcli version` | Print the current version |

Every backup and rollup command exits with code `1` when it fails — the
dump/restore, the database resolution, or the S3 upload/download — so cron and
monitoring can act on it. A failed dump removes the partial file it left, and a
failed upload still deletes the local backup file (unless `--local` was passed,
where the file is the product). A failed remote rollup removes the downloaded
file, or the partial file a failed download left; with `--local` the file is
your input and is never deleted. S3 transfers are streamed, so backup size is
not bounded by memory.

### Flags

| Flag | Applies to | Meaning |
|---|---|---|
| `-f, --filename <name>` | all | Backup filename. Backups default to `<database>-<timestamp>.sql.gz`; rollup requires it. |
| `--local` | all | Read/write the backup on the local filesystem instead of S3. |

Examples:

```bash
# Back up to S3 with an auto-generated, timestamped filename
hcli psql-backup

# Back up to a local file (no S3)
hcli psql-backup --local --filename seed.sql.gz

# Restore from a local file
hcli psql-rollup --local --filename seed.sql.gz

# Restore from S3
hcli mysql-rollup --filename mydb-2026-03-05T12-00-00Z.sql.gz
```

## Configuration

All configuration comes from environment variables (see [.env.example](./.env.example)).

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Connection URL (`postgres://`/`mysql://user:pass@host:port/dbname`) or an AWS SSM Parameter Store ARN resolved via [`@heronlabs/env-ssm`](https://www.npmjs.com/package/@heronlabs/env-ssm) |
| `AWS_S3_BUCKET_NAME` | for S3 | Destination bucket for remote backups |
| `AWS_REGION` | for S3 | AWS region |
| `AWS_ACCESS_KEY_ID` | for S3 | AWS credentials (or use an instance role) |
| `AWS_SECRET_ACCESS_KEY` | for S3 | AWS credentials (or use an instance role) |
| `SENTRY_DSN` | ❌ | Sentry DSN; when set, failures and command errors are reported as Sentry errors and every pino log line is sent as a Sentry Log. Unset or empty disables Sentry. |
| `SENTRY_ENVIRONMENT` | ❌ | Sentry environment (default `production`) |
| `SENTRY_MONITOR_SLUG` | ❌ | Sentry Cron monitor slug; when set, each backup sends an `in_progress` check-in and an `ok`/`error` one when it ends (rollups never check in). Create the monitor in the Sentry UI with the same schedule as the crontab. |

Locally, `pnpm start -- <command>` loads variables from a `.env` file via `dotenv`.

An unresolvable `DATABASE_URL`, or a missing `AWS_S3_BUCKET_NAME` when S3 is
used, fails the command with exit code `1`, like any other backup or rollup
failure.

## Architecture

Hexagonal NestJS layering:

```
src/
├── instrument.ts         # Sentry init (imported first by main.ts)
├── application/          # CLI surface (nest-commander)
│   └── cli/
│       ├── cli-module.ts
│       └── commands/     # backup/, rollup/, version/ + per-command option types
├── core/                 # domain logic
│   ├── interfaces/       # BackupService / RollupService abstract base services
│   └── services/         # {mysql,psql}-{backup,rollup}-service
└── infrastructure/       # adapters
    ├── environment/      # EnvironmentService (ConfigService wrapper)
    ├── log/              # nestjs-pino logger module
    └── storage/          # S3StorageService (AWS SDK v3)
```

- **`application/`** wires commands into modules — the composition root.
- **`core/`** holds the backup/rollup flow. The abstract `BackupService`/`RollupService`
  own the S3 upload/download + local-cleanup orchestration; engine subclasses implement
  the `dump`/`restore` shell commands.
- **`infrastructure/`** adapters never import inward (enforced by `pnpm dep:cruise`).

## Docker & Cron

One published image — `heronlabs/terminal-cli` (built from `Dockerfile`) — carries
`hcli` on `PATH`, both DB clients, and busybox `crond`. Scheduled backups are
deployed from the inline-Dockerfile templates under [`easypanel/`](easypanel/):
each one is `FROM heronlabs/terminal-cli:<tag>`, adds a 12-hourly crontab, and
runs an immediate backup before starting `crond` in the foreground (dumping
`printenv` to `/etc/environment` so cron inherits the runtime variables EasyPanel
injects). See [`easypanel/README.md`](easypanel/README.md) for deploy steps.

Local stack for manual testing — `docker-compose.yml` runs the psql + mysql DBs
(exposed on ports 5434/3307) and the `psql-integration`/`mysql-integration`
services that run the backup/rollup round-trip inside the prod-shaped
`tests-integration/{postgres,mysql}/Dockerfile` images:

```bash
docker compose up postgres mysql              # local DBs only
pnpm test:integration:postgres                # PostgreSQL round-trip
pnpm test:integration:mysql                   # MySQL round-trip
pnpm test:integration                         # both
```

## Testing

| Detail | Value |
|---|---|
| Framework | Vitest 4.x (`vitest.config.ts`, SWC transform for decorators) |
| Test location | `tests/unit/` (mirrors `src/`) |
| Integration tests | `tests-integration/` — Docker-based round-trip (PostgreSQL + MySQL) |
| Shared mocks | `tests/__mocks__/create-testing-module.ts` (moq.ts + vitest) |
| Coverage | v8, 100% lines/functions/branches/statements |
| Coverage excludes | `**/main.ts`, `**/instrument.ts`, `**/*.d.ts`, `**/*factory.ts`, `**/types/` |
| Mutation | Stryker 9.x (`stryker.conf.json`), 100% break threshold |
| Mutation scope | `src/**/*.ts` excluding `main.ts`, `instrument.ts`, `*.d.ts`, `*factory.ts`, `*-module.ts` |

```bash
pnpm test:unit      # vitest run with coverage
pnpm test:integration  # PostgreSQL + MySQL round-trip (requires Docker)
pnpm test:mutation  # stryker mutation testing
```

## Contributing

```bash
pnpm lint:check       # check
pnpm lint:fix         # auto-fix
pnpm build            # verify compilation
pnpm test:unit        # verify tests pass at 100% coverage
pnpm test:integration # verify round-trip (requires Docker)
pnpm dep:cruise       # verify architecture
```

Conventional Commits:

```
feat: add mongodb backup engine
fix: handle empty database name in psql dump
test: cover s3 download error path
```

- All work branches from `main`; PRs target `main`. Never commit directly to `main`.

## License

MIT — see [LICENSE](LICENSE).

---

Built by [HeronLabs](https://github.com/heronlabs)
