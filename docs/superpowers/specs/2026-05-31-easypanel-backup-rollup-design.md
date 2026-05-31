# EasyPanel backup & rollup — design

- **Ticket:** [ClickUp #86ba6g6np](https://app.clickup.com/t/86ba6g6np) — "Create backup/rollup for easy panel"
- **Date:** 2026-05-31
- **Status:** Approved

## Context

`hcli` already backs up PostgreSQL and MySQL databases to S3 (or local) and restores
("rollup") them. A new target is needed: a full **EasyPanel host snapshot** for an
Ubuntu 22.04 VPS — archive the EasyPanel config and Docker state, push to S3, and be
able to roll the host back from that archive.

The snapshot must be consistent, so the Docker daemon is stopped while the archive is
taken and restarted afterward.

## Run model (decided)

**Run `hcli` natively on the Ubuntu host as root.** This is the only clean fit:

- The command runs `systemctl stop docker` and reads `/var/lib/docker/volumes`. Neither
  works from inside a container managed by that same daemon — stopping the daemon would
  kill the container running the backup, and there is no systemd in the container.
- `hcli` already ships to npm (`@heronlabs/terminal-cli`, bin `hcli`), so host deployment
  is `npm i -g @heronlabs/terminal-cli` + a cron entry or systemd timer.

Rejected: privileged container with host mounts (cannot reliably stop the host daemon;
would require `nsenter` into host systemd — fragile).

## Architecture

Reuse the existing hexagonal pattern exactly — the abstract base classes already own the
S3 + local-cleanup orchestration:

- `BackupService.run(local, filename?)` → calls `dump()`, then (unless `--local`) uploads
  to S3 and unlinks the local file.
- `RollupService.run(filename, local)` → (unless `--local`) downloads from S3, then calls
  `restore()`, then unlinks the downloaded file.

The EasyPanel services only implement `dump()` / `restore()`. They touch **only** the S3
config (`AWS_S3_BUCKET_NAME` etc.) via the existing base class — no DB env vars, no new
env vars.

### New files

| File | Role |
|---|---|
| `src/core/services/easypanel-backup-service.ts` | `EasypanelBackupService extends BackupService` — implements `dump()` |
| `src/core/services/easypanel-rollup-service.ts` | `EasypanelRollupService extends RollupService` — implements `restore()` |
| `src/application/cli/commands/backup/easypanel-backup-command.ts` | `easypanel-backup` command (mirrors `psql-backup-command.ts`) |
| `src/application/cli/commands/rollup/easypanel-rollup-command.ts` | `easypanel-rollup` command (mirrors `psql-rollup-command.ts`) |
| `tests/specs/core/services/easypanel-backup-service.spec.ts` | mirror `psql-backup-service.spec.ts` |
| `tests/specs/core/services/easypanel-rollup-service.spec.ts` | mirror `psql-rollup-service.spec.ts` |
| `tests/specs/application/cli/commands/backup/easypanel-backup-command.spec.ts` | mirror the psql backup command spec |
| `tests/specs/application/cli/commands/rollup/easypanel-rollup-command.spec.ts` | mirror the psql rollup command spec |
| `docker-compose.easypanel.yml` | **sandbox** round-trip test compose (see below) |
| `examples/docker-compose.easypanel-host.yml` | **deployment** example compose (documented, not executed) |

The two commands reuse the existing `BackupOptions` / `RollupOptions` types and the
`-f, --filename` / `--local` flags — no new option types.

### Modified files

- `src/core/core-module.ts` — add `EasypanelBackupService`, `EasypanelRollupService` to `providers` and `exports`.
- `src/application/cli/cli-module.ts` — add `EasypanelBackupCommand`, `EasypanelRollupCommand` to `providers`.
- `README.md` — commands table + a host-install + cron/systemd schedule section + usage examples + the restore-overwrites-host warning.
- `CLAUDE.md` — add `easypanel-backup`, `easypanel-rollup` to the CLI commands list.
- `.env.example` — note that the easypanel commands need only the `AWS_*` vars (no DB vars).

## The command strings (injection-safe)

Follow the existing DB pattern: a **constant** command string, with the only variable
(the archive path) passed through an environment variable (`ARCHIVE`). `execSync` with
`shell: '/bin/bash'`, `env: {...process.env, ARCHIVE: backupFileName}`.

The archive paths (`/etc/easypanel`, `/var/lib/docker/volumes`, `/var/lib/docker/buildkit`)
and the restore target (`/`) are **hardcoded constants** — they are standard EasyPanel
locations, and keeping them out of the variable path preserves injection-safety.

### `dump()` — `easypanel-backup`

```bash
trap 'systemctl start docker' EXIT
systemctl stop docker.socket
systemctl stop docker
tar czf "$ARCHIVE" --warning=no-file-changed /etc/easypanel /var/lib/docker/volumes /var/lib/docker/buildkit 2>/dev/null || true
test -s "$ARCHIVE"
```

- `trap … EXIT` guarantees the Docker daemon restarts even if a later step fails.
- `|| true` tolerates tar's exit code 1 on files that change during read (expected for
  live volumes).
- `test -s "$ARCHIVE"` fails the command if the archive is missing or empty, so a truly
  failed tar is reported as an error (and `BackupService.run` will not upload it).

### `restore()` — `easypanel-rollup`

```bash
trap 'systemctl start docker' EXIT
systemctl stop docker.socket
systemctl stop docker
tar xzf "$ARCHIVE" -C /
```

- Absolute paths inside the archive extract back to `/`.
- If extraction fails, `execSync` throws → `restore()` returns `{ok: false, error}`; the
  daemon still restarts via the trap.

### Default filename

`easypanel-<UTC-timestamp>.tar.gz`, timestamp formatted exactly like the DB services:
`DateTime.utc().toFormat("yyyy-MM-dd'T'HH-mm-ss'Z'")`. Overridable with `-f/--filename`.

### Root guard

Both `dump()` and `restore()` check root **before** stopping Docker:

```ts
if (process.getuid?.() !== 0) {
  return {
    ok: false as const,
    error: new Error('easypanel-backup must run as root (needs systemctl + /var/lib/docker access)'),
  };
}
```

This avoids stopping the daemon and then failing on a permission error. (`restore` uses an
analogous "easypanel-rollup must run as root" message.)

### Return shape & error handling

Identical to the DB services: `{ok: true, data: {backupFileName}}` on success, or
`{ok: false, error: new Error(...)}` on failure. Wrap `execSync` in try/catch and return a
descriptive error (`'easypanel backup failed'` / `'easypanel restore failed'`).

## Testing

Mirror the existing `psql-*`/`mysql-*` specs (moq.ts + vitest, `execSync` mocked).

Coverage and mutation are enforced and **must both be 100%**:

- `pnpm test:unit` — v8 coverage, 100% thresholds.
- `pnpm test:mutation` — Stryker, 100% break. **This runs in CI but is _not_ in
  `.claude/supera.json`'s verify list**, so the engineer must run it explicitly and reach
  100% before the work is considered done.

To satisfy 100% mutation, the service specs must assert:

- the **exact** constant command string passed to `execSync` (both backup and rollup),
- the `env` object includes `ARCHIVE` set to the resolved filename,
- the `shell: '/bin/bash'` option,
- the default-filename branch **and** the explicit `-f/--filename` branch,
- the root-guard branch for both `getuid() === 0` and `!== 0` (stub `process.getuid`),
- the success path and the thrown-error path.

Command specs mirror the psql/mysql command specs (nest-commander-testing): assert the
service `run` is called with the correct `(local, filename)` / `(filename, local)` args
and the option defaults (`--local` defaults to `false`).

## Compose files

### `docker-compose.easypanel.yml` — sandbox round-trip (test aid)

A single service built from the repo `Dockerfile` that:

1. seeds a sample layout (`/srv/sandbox/etc/easypanel`, `/srv/sandbox/var/lib/docker/volumes`)
   with dummy files — note: the **real** hardcoded paths can't be safely written to inside
   CI, so the sandbox demonstrates the **tar packaging + restore round-trip** using
   `hcli easypanel-backup --local` then `hcli easypanel-rollup --local`, **without** the
   `systemctl` / docker-stop step (which cannot run in compose).
2. Documented at the top of the file: this exercises archive create/extract only; the
   docker stop/start is host-only and verified manually.

> The sandbox is a manual integration aid (`docker compose -f docker-compose.easypanel.yml up`),
> not part of `pnpm test:unit`.

### `examples/docker-compose.easypanel-host.yml` — deployment example (documented)

A commented, illustrative compose showing how an operator could run the command on a real
host (privileged, host bind-mounts for `/etc/easypanel`, `/var/lib/docker`, `/var/run/docker.sock`,
S3 env), **with an explicit caveat** that native host execution (npm global + cron/systemd)
is the recommended path and the container form is illustrative only.

## README / docs

Add to `README.md`:

- `easypanel-backup` and `easypanel-rollup` rows in the commands table.
- Usage examples (S3 + `--local`, custom `--filename`).
- A "EasyPanel host backup" section: `npm i -g @heronlabs/terminal-cli`, run as root, the
  required `AWS_*` env, and a schedule example — either a host crontab line
  (`0 */12 * * * hcli easypanel-backup`) or a systemd timer unit (every 12h, matching the
  existing cron containers' cadence).
- A clear warning that `easypanel-rollup` extracts to `/` and **overwrites host files**.

## Out of scope

- Configurable backup paths (hardcoded by design).
- Incremental / encrypted backups.
- Non-root execution.
- Automated host install/provisioning tooling.
- A confirmation prompt on rollup (matches existing `psql-rollup` — no prompt).

## Acceptance criteria

- `hcli easypanel-backup` (and `--local`, `-f`) and `hcli easypanel-rollup -f <file>` (and `--local`) work and are wired into the CLI module.
- `dump`/`restore` use constant command strings with `ARCHIVE` env indirection and a root guard.
- `pnpm build`, `pnpm lint:check`, `pnpm test:unit` (100% coverage), and `pnpm test:mutation` (100%) all pass.
- Both compose files exist; README + CLAUDE.md + .env.example updated.
- `pnpm dep:cruise` passes (no new architecture violations).
