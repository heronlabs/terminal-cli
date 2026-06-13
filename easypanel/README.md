# EasyPanel templates

Paste-able [EasyPanel](https://easypanel.io/) templates that run scheduled
PostgreSQL / MySQL backups with `hcli` — **without** building a custom image.
They deploy the published, generic [`heronlabs/terminal-cli`](https://hub.docker.com/r/heronlabs/terminal-cli)
image and define the backup cron **in the template itself**, so EasyPanel users
no longer need the baked-in `cron-tab-*.dockerfile` images.

| Template | Engine | Runs |
|---|---|---|
| `psql-backup.json` | PostgreSQL | `hcli psql-backup` on start + every 12h |
| `mysql-backup.json` | MySQL | `hcli mysql-backup` on start + every 12h |

## Deploy

1. In EasyPanel, open (or create) a project, then **Create Service → From Schema**.
2. Paste the contents of `psql-backup.json` or `mysql-backup.json`.
3. **Pin the image tag** — replace `CHANGE_ME` in `source.image`
   (`heronlabs/terminal-cli:CHANGE_ME`) with a published release tag. See
   [Image tag](#image-tag) below.
4. Fill in the environment variables (see [Environment](#environment)).
5. Deploy. The service runs an immediate backup, then `crond` keeps it running
   on the schedule.

The template's `deploy.command` mirrors the cron images: it dumps `printenv` to
`/etc/environment` (so `crond` inherits EasyPanel's injected env vars), runs one
backup immediately, then starts `crond` in the foreground. The schedule itself
lives in a file mount at `/etc/crontabs/root`.

## Environment

Set these on the service (the template ships them as placeholders):

| Variable | Required | Notes |
|---|---|---|
| `DB_URL` | yes | A `postgres://` / `mysql://` connection URL, **or** an AWS SSM Parameter Store ARN (resolved by `@heronlabs/env-ssm`). |
| `AWS_S3_BUCKET_NAME` | yes | Destination bucket for the backup. |
| `AWS_REGION` | yes | Bucket region, e.g. `us-east-1`. |
| `AWS_ACCESS_KEY_ID` | yes | Credentials with write access to the bucket. |
| `AWS_SECRET_ACCESS_KEY` | yes | — |

## Image tag

CD publishes images tagged by **semver only** — there is no moving `latest`
tag — so the template cannot safely reference `:latest`. Replace the
`CHANGE_ME` placeholder with a real release tag, e.g.:

```
heronlabs/terminal-cli:v2.0.2
```

Find published tags on the
[Docker Hub tags page](https://hub.docker.com/r/heronlabs/terminal-cli/tags) or
the repository's [GitHub releases](https://github.com/heronlabs/terminal-cli/releases).

> Future follow-up (not in this change): publishing a moving `latest` tag from
> CD would let templates omit the pin.

## Changing the schedule

The cron expression lives in the file mount at `/etc/crontabs/root`:

```
0 */12 * * *	. /etc/environment; hcli psql-backup
```

Edit the leading cron expression (the part before the tab) to change the
cadence — build and check expressions with [crontab.guru](https://crontab.guru/).
For example, daily at 02:00:

```
0 2 * * *	. /etc/environment; hcli psql-backup
```

Keep the `. /etc/environment; hcli <engine>-backup` part intact so the cron job
inherits the runtime env vars.

> Only `*-backup` is scheduled here — rollup (restore) is intentionally manual.

## Relationship to the cron-tab images

These templates replace the need for the
`cron-tab-postgres.dockerfile` / `cron-tab-mysql.dockerfile` images **for
EasyPanel users**: instead of building and pushing a dedicated cron image, you
run the generic published image and supply the cron from the template.

The `cron-tab-*` images remain available for other environments (plain Docker,
`docker compose`, other orchestrators) where baking the cron into the image is
preferable. See the repository [`Dockerfile`](../Dockerfile) and the main
[README](../README.md#docker--cron).
