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
AWS S3, Luxon, croner and Sentry. Designed to run as a long-running scheduler container on EasyPanel.

## Table of Contents

- [Why This Project](#why-this-project)
- [Install](#install)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Docker & Scheduling](#docker--scheduling)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Why This Project

Scheduled, type-safe database backups with a single binary:

- **One tool, two engines** — PostgreSQL (`pg_dump`/`psql`) and MySQL (`mysqldump`/`mysql`) behind one CLI.
- **S3 or local** — push backups to S3 by default, or keep them on disk with `--local` (handy for seeding).
- **Scheduler built in** — `hcli run` backs up on start and on `BACKUP_SCHEDULE`; one image plus `easypanel/` inline-Dockerfile templates deploy it.
- **Observable** — optional Sentry: logs, errors and a cron monitor of the scheduled backup, with credentials redacted.
- **Safe restores** — `backups-list`, `--latest`, a shared job lock, and a refusal to restore into a database that already has tables.
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
| `hcli run` | Long-running scheduler: backs up `BACKUP_ENGINE` on start and on `BACKUP_SCHEDULE` until SIGTERM/SIGINT |
| `hcli psql-backup` | Back up a PostgreSQL database (S3 by default) |
| `hcli psql-rollup --filename <file>` / `--latest` | Restore a PostgreSQL database from a backup |
| `hcli mysql-backup` | Back up a MySQL database (S3 by default) |
| `hcli mysql-rollup --filename <file>` / `--latest` | Restore a MySQL database from a backup |
| `hcli backups-list` | List the configured database's backups in S3, newest first, with date and size |
| `hcli version` | Print the current version |

Every backup and rollup command exits with code `1` when it fails — the
dump/restore, the database resolution, or the S3 upload/download — so cron and
monitoring can act on it. A failed dump removes the partial file it left, and a
failed upload still deletes the local backup file (unless `--local` was passed,
where the file is the product). A failed remote rollup removes the downloaded
file, or the partial file a failed download left; with `--local` the file is
your input and is never deleted. S3 transfers are streamed, so backup size is
not bounded by memory.

A rollup counts the tables of the target database first and refuses (exit `1`,
a warning, no Sentry issue) when it is not empty, unless `--force` is passed.
Backups and rollups share a lock file: a manual command that finds another
backup or rollup running exits `1`; a scheduled backup is skipped with a warning.
`hcli run` exits `1` when `BACKUP_ENGINE` is missing or `BACKUP_SCHEDULE` is not
a valid cron pattern.

### Flags

| Flag | Applies to | Meaning |
|---|---|---|
| `-f, --filename <name>` | backups, rollups | Backup filename. Backups default to `<database>-<timestamp>.sql.gz`; a rollup takes either it or `--latest`. |
| `--local` | backups, rollups | Read/write the backup on the local filesystem instead of S3. |
| `--latest` | rollups | Restore the newest backup of the configured database from S3. Not combinable with `--filename` or `--local`. |
| `--force` | rollups | Restore even when the target database already has tables. |

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

# List the backups in S3 and restore the newest one into an empty database
hcli backups-list
hcli psql-rollup --latest
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
| `BACKUP_ENGINE` | for `hcli run` | `psql` or `mysql` |
| `BACKUP_SCHEDULE` | — | Cron pattern (UTC) of `hcli run` and of the Sentry monitor. Default `0 */12 * * *` |
| `BACKUP_ON_START` | — | `false` skips the backup when `hcli run` starts. Default `true` |
| `SENTRY_DSN` | — | Enables Sentry. Unset or empty: no Sentry, no network calls |
| `SENTRY_ENVIRONMENT` | — | Sentry environment. Default `production` |
| `SENTRY_MONITOR_SLUG` | — | Enables the cron monitor check-ins of the scheduled backup |
| `SENTRY_MONITOR_MAX_RUNTIME` | — | Minutes before the monitor reports a backup as stuck. Default `60` |

Locally, `pnpm start -- <command>` loads variables from a `.env` file via `dotenv`.

An unresolvable `DATABASE_URL`, or a missing `AWS_S3_BUCKET_NAME` when S3 is
used, fails the command with exit code `1`, like any other backup or rollup
failure.

With `SENTRY_DSN` set, every log line of every command goes to Sentry Logs and
every unexpected failure becomes a Sentry issue, all carrying the attributes
`command`, `job` (`backup` | `rollup` | `backups-list`), `job.id` and `trigger`
(`schedule` | `manual`). Connection-URL credentials, `PGPASSWORD=`, `MYSQL_PWD=`,
`AWS_SECRET_ACCESS_KEY=` and `AKIA…` keys are redacted before anything is sent.
Only the scheduled backup of `hcli run` checks in to the monitor
(`SENTRY_MONITOR_SLUG`); the release is `terminal-cli@<version>`.

## Architecture

Hexagonal NestJS layering:

```
src/
├── application/          # CLI surface (nest-commander)
│   └── cli/
│       ├── cli-module.ts
│       └── commands/     # backup/, rollup/, backups-list/, run/, version/ + option types
├── core/                 # domain logic
│   ├── interfaces/       # BackupService / RollupService abstract base services
│   ├── types/            # job result/options types
│   └── services/         # {mysql,psql}-{backup,rollup}-service, job/ (lock + runner),
│                         # backup-list/, schedule/ (croner)
└── infrastructure/       # adapters
    ├── environment/      # EnvironmentService (ConfigService wrapper)
    ├── log/              # nestjs-pino + Sentry Logs bridge logger
    ├── monitoring/       # Sentry wrapper, job context (AsyncLocalStorage), secret scrubber
    └── storage/          # S3StorageService (AWS SDK v3)
```

- **`application/`** wires commands into modules — the composition root.
- **`core/`** holds the backup/rollup flow. The abstract `BackupService`/`RollupService`
  own the S3 upload/download + local-cleanup orchestration; engine subclasses implement
  the `dump`/`restore` shell commands.
- **`infrastructure/`** adapters never import inward (enforced by `pnpm dep:cruise`).

## Docker & Scheduling

One published image — `heronlabs/terminal-cli` (built from `Dockerfile`) — carries
`hcli` on `PATH` and both DB clients. Scheduled backups are deployed from the
inline-Dockerfile templates under [`easypanel/`](easypanel/): each one is
`FROM heronlabs/terminal-cli:<tag>` with `CMD ["hcli", "run"]`, configured by
`BACKUP_ENGINE` / `BACKUP_SCHEDULE` and the optional Sentry variables. See
[`easypanel/README.md`](easypanel/README.md) for deploy and restore steps.

Local stack for manual testing — `docker-compose.yml` runs the psql + mysql DBs
(exposed on ports 5434/3307) and the `psql-integration`/`mysql-integration`
services that run the backup/rollup round-trip inside the prod-shaped
`integration/{postgres,mysql}/Dockerfile` images:

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
| Integration tests | `integration/` — Docker-based round-trip (PostgreSQL + MySQL) |
| Shared mocks | `tests/__mocks__/create-testing-module.ts` (moq.ts + vitest) |
| Coverage | v8, 100% lines/functions/branches/statements |
| Coverage excludes | `**/main.ts`, `**/*.d.ts`, `**/*factory.ts`, `**/types/` |
| Mutation | Stryker 9.x (`stryker.conf.json`), 100% break threshold |
| Mutation scope | `src/**/*.ts` excluding `main.ts`, `*.d.ts`, `*factory.ts`, `*-module.ts` |

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
