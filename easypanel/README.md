# EasyPanel backup templates

Inline-Dockerfile templates that schedule a database backup on
[EasyPanel](https://easypanel.io/). Each service runs `FROM
heronlabs/terminal-cli:<tag>` — the one generic published image, which already
carries `hcli` and both DB clients — with `CMD ["hcli", "run"]`: a long-running
scheduler that backs up on start and then on `BACKUP_SCHEDULE`, until the
container is stopped.

| File | Engine | `BACKUP_ENGINE` |
|---|---|---|
| `psql-backup.json` | PostgreSQL | `psql` |
| `mysql-backup.json` | MySQL | `mysql` |

This replaces the old dedicated `cron-tab-postgres.dockerfile` /
`cron-tab-mysql.dockerfile` images: instead of publishing one image per engine,
CD now ships a single `heronlabs/terminal-cli` image and the schedule lives in
these per-deployment inline Dockerfiles.

## Deploy

1. In EasyPanel, create a new app (or use **Create from Schema** and paste the
   matching `*.json` template).
2. Open the service's **Source** tab and choose **Dockerfile**.
3. Paste the inline Dockerfile (the `source.dockerfile` value from the template),
   or rely on the schema you imported in step 1.
4. Replace `CHANGE_ME` with a published `heronlabs/terminal-cli` tag — CD tags
   the image with the semver release only, so pin a real version (e.g.
   `heronlabs/terminal-cli:2.0.2`).
5. Set the environment variables (table below).
6. Deploy.

## Environment

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | A `postgres://` / `mysql://` connection URL, or an AWS SSM Parameter Store ARN resolved by `@heronlabs/env-ssm`. |
| `AWS_S3_BUCKET_NAME` | yes | Destination bucket for the backup artifact. |
| `AWS_REGION` | yes | Region of the bucket. |
| `AWS_ACCESS_KEY_ID` | yes | Credentials for the S3 upload. |
| `AWS_SECRET_ACCESS_KEY` | yes | Credentials for the S3 upload. |
| `BACKUP_ENGINE` | yes | `psql` or `mysql`. `hcli run` exits 1 without it. |
| `BACKUP_SCHEDULE` | no | Cron pattern (UTC) of the backup. Default `0 */12 * * *`. An invalid pattern makes `hcli run` exit 1. |
| `BACKUP_ON_START` | no | `false` skips the backup when the container starts. Default `true`. |
| `SENTRY_DSN` | no | DSN of the client's `terminal-cli` Sentry project. Empty or unset disables Sentry. |
| `SENTRY_ENVIRONMENT` | no | Sentry environment. Default `production`. |
| `SENTRY_MONITOR_SLUG` | no | Slug of the Sentry cron monitor of the scheduled backup. Empty or unset disables the check-ins. |
| `SENTRY_MONITOR_MAX_RUNTIME` | no | Minutes before the monitor reports a running backup as stuck. Default `60`. |

## Notes

- **The schedule is `BACKUP_SCHEDULE`**, read by the scheduler and by the
  Sentry monitor. Changing it is an environment change and a redeploy, not a
  Dockerfile edit. Spread the minute per client (e.g. `17 */12 * * *`) so the
  backups on one host do not all start together.
- **No `USER root`.** `hcli run` schedules in-process, so the container keeps the
  base image's `USER node`.
- **One job at a time.** Backups and rollups share a lock: a scheduled backup
  that finds a rollup running is skipped with a warning (the Sentry monitor
  reports the missed run), and a manual command that finds the lock taken exits 1.
- **Sentry.** With `SENTRY_DSN` set, every log line and error of every command
  goes to the client's Sentry, tagged with `command`, `job`, `job.id` and
  `trigger`; credentials are redacted before sending. With
  `SENTRY_MONITOR_SLUG` set, each scheduled backup sends an `in_progress` → `ok`
  / `error` check-in.

## Restore

```
EasyPanel → client project → terminal-cli → Console
# stop the app
hcli psql-rollup --latest
```

`--latest` restores the newest backup of the configured database from S3; use
`--filename <key>` instead of `--latest` to restore an older backup (use
`mysql-rollup` for MySQL).
