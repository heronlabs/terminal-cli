# 🪶 terminal-cli — Heron CLI (`hcli`)

[![CI](https://github.com/heronlabs/terminal-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/heronlabs/terminal-cli/actions/workflows/ci.yml)
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
- **Cron-ready containers** — purpose-built Dockerfiles run a backup on start and every 12 hours.
- **100% tested** — v8 coverage + Stryker mutation testing, both at 100% thresholds.

## Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | `>=22` | Runtime |
| pnpm | `>=10.29.3` | Package manager |
| `pg_dump` / `psql` | — | PostgreSQL backup/restore |
| `mysqldump` / `mysql` | — | MySQL backup/restore |

### Installation

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
| `hcli version` | Print the current version |

### Flags

| Flag | Applies to | Meaning |
|---|---|---|
| `-f, --filename <name>` | all | Backup filename. Backup defaults to `<database>-<timestamp>.sql.gz`; rollup requires it. |
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
| `DB_HOST` | ✅ | Database host |
| `DB_PORT` | ✅ | Database port |
| `DB_NAME` | ✅ | Database name |
| `DB_USER` | ✅ | Database user |
| `DB_PASSWORD` | ✅ | Database password |
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

Three Dockerfiles:

| File | Purpose |
|---|---|
| `Dockerfile` | General-purpose image with `hcli` on `PATH` and both DB clients |
| `cron-tab-postgres.dockerfile` | PostgreSQL cron container — backup on start + every 12h |
| `cron-tab-mysql.dockerfile` | MySQL cron container — backup on start + every 12h |

The cron images dump `printenv` to `/etc/environment` so `crond` inherits the
runtime variables injected by EasyPanel, run an immediate backup, then start
`crond` in the foreground.

Local stack for manual testing:

```bash
docker compose up        # spins up psql + mysql DBs and CLI containers
```

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
