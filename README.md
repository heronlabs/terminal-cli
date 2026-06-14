# 🪶 terminal-cli — Heron CLI (`hcli`)

[![npm version](https://img.shields.io/npm/v/@heronlabs/terminal-cli.svg)](https://www.npmjs.com/package/@heronlabs/terminal-cli)
[![license](https://img.shields.io/npm/l/@heronlabs/terminal-cli.svg)](./LICENSE)
[![CI](https://github.com/heronlabs/terminal-cli/actions/workflows/ci-cli.yml/badge.svg)](https://github.com/heronlabs/terminal-cli/actions/workflows/ci-cli.yml)
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
| pnpm | `>=10.29.3` | Package manager |
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
| `hcli easypanel-backup` | Snapshot an EasyPanel host — config + Docker state — to a `.tar.gz` (S3 by default). Run as root on the host. |
| `hcli easypanel-rollup --filename <file>` | Restore an EasyPanel host from a snapshot. Run as root on the host. **Overwrites host files.** |
| `hcli version` | Print the current version |

### Flags

| Flag | Applies to | Meaning |
|---|---|---|
| `-f, --filename <name>` | all | Backup filename. DB backups default to `<database>-<timestamp>.sql.gz` and `easypanel-backup` to `easypanel-<timestamp>.tar.gz`; rollup requires it. |
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

# Snapshot an EasyPanel host to S3 (run as root on the host)
sudo hcli easypanel-backup

# Snapshot to a local file with a custom name
sudo hcli easypanel-backup --local --filename easypanel-snapshot.tar.gz

# Restore an EasyPanel host from S3 (OVERWRITES host files)
sudo hcli easypanel-rollup --filename easypanel-2026-03-05T12-00-00Z.tar.gz
```

## Configuration

All configuration comes from environment variables (see [.env.example](./.env.example)).

| Variable | Required | Description |
|---|---|---|
| `DB_URL` | ✅ | Connection URL (`postgres://`/`mysql://user:pass@host:port/dbname`) or an AWS SSM Parameter Store ARN resolved via [`@heronlabs/env-ssm`](https://www.npmjs.com/package/@heronlabs/env-ssm) |
| `AWS_S3_BUCKET_NAME` | for S3 | Destination bucket for remote backups |
| `AWS_REGION` | for S3 | AWS region |
| `AWS_ACCESS_KEY_ID` | for S3 | AWS credentials (or use an instance role) |
| `AWS_SECRET_ACCESS_KEY` | for S3 | AWS credentials (or use an instance role) |

Locally, `pnpm start -- <command>` loads variables from a `.env` file via `dotenv`.

## Architecture

Hexagonal NestJS layering:

```
src/
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
`integration-{postgres,mysql}.dockerfile` images:

```bash
docker compose up postgres mysql              # local DBs only
docker compose run --build --rm psql-integration   # PostgreSQL round-trip
docker compose run --build --rm mysql-integration  # MySQL round-trip
```

## EasyPanel host backup

`easypanel-backup` / `easypanel-rollup` snapshot a whole [EasyPanel](https://easypanel.io/)
host — `/etc/easypanel`, `/var/lib/docker/volumes`, and `/var/lib/docker/buildkit` —
into a single `.tar.gz`. To keep the snapshot consistent the command stops the
Docker daemon while the archive is taken and restarts it afterwards (even if the
backup fails).

Because it runs `systemctl stop docker` and reads `/var/lib/docker`, it must run
**natively on the host as root**, not inside a container managed by that daemon.
If not run as root the command refuses to start (it will not stop Docker and
then fail), so schedule it as root.

> ⚠️ **`easypanel-rollup` extracts the archive to `/` and overwrites host files**
> (`/etc/easypanel` and `/var/lib/docker`). It does not prompt — run it
> deliberately, against a host you intend to roll back.

### Scheduling (every 12h)

Install the CLI on the host (Ubuntu 22.04) and match the DB backup templates'
cadence with a host crontab line:

```bash
npm i -g @heronlabs/terminal-cli
```

```cron
# /etc/crontab — run as root, source the env first
0 */12 * * * root . /etc/easypanel-backup.env; hcli easypanel-backup
```

Put the `AWS_*` variables (the `easypanel-*` commands need only `AWS_*`, no DB
vars) in `/etc/easypanel-backup.env`.

## Testing

| Detail | Value |
|---|---|
| Framework | Vitest 4.x (`vitest.config.ts`, SWC transform for decorators) |
| Test location | `tests/specs/` (mirrors `src/`) |
| Shared mocks | `tests/__mocks__/create-testing-module.ts` (moq.ts + vitest) |
| Coverage | v8, 100% lines/functions/branches/statements |
| Coverage excludes | `**/main.ts`, `**/*.d.ts`, `**/*factory.ts`, `**/types/` |
| Mutation | Stryker 9.x (`stryker.conf.json`), 100% break threshold |
| Mutation scope | `src/**/*.ts` excluding `main.ts`, `*.d.ts`, `*factory.ts`, `*-module.ts` |

```bash
pnpm test:unit      # vitest run with coverage
pnpm test:mutation  # stryker mutation testing
```

## Contributing

```bash
pnpm lint:check   # check
pnpm lint:fix     # auto-fix
pnpm build        # verify compilation
pnpm test:unit    # verify tests pass at 100% coverage
pnpm dep:cruise   # verify architecture
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
