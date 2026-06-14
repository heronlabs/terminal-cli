# EasyPanel backup templates

Inline-Dockerfile templates that schedule a database backup on
[EasyPanel](https://easypanel.io/). Each service runs `FROM
heronlabs/terminal-cli:<tag>` — the one generic published image, which already
carries `hcli`, both DB clients, and busybox `crond` — adds a 12-hourly crontab,
and runs an immediate backup before starting `crond` in the foreground.

| File | Engine | Command |
|---|---|---|
| `psql-backup.json` | PostgreSQL | `hcli psql-backup` |
| `mysql-backup.json` | MySQL | `hcli mysql-backup` |

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
| `DB_URL` | yes | A `postgres://` / `mysql://` connection URL, or an AWS SSM Parameter Store ARN resolved by `@heronlabs/env-ssm`. |
| `AWS_S3_BUCKET_NAME` | yes | Destination bucket for the backup artifact. |
| `AWS_REGION` | yes | Region of the bucket. |
| `AWS_ACCESS_KEY_ID` | yes | Credentials for the S3 upload. |
| `AWS_SECRET_ACCESS_KEY` | yes | Credentials for the S3 upload. |

## Notes

- **The schedule lives in the inline Dockerfile's crontab** (`0 */12 * * *`).
  Changing the cadence means editing the Dockerfile and redeploying — it is not
  an environment variable.
- **`USER root` is required.** The base `heronlabs/terminal-cli` image runs as
  `USER node`, but writing `/etc/crontabs/root` and running `crond` need root, so
  the inline Dockerfile switches back to root before installing the crontab.
