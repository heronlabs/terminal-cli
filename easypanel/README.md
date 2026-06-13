# EasyPanel templates

Paste-able [EasyPanel](https://easypanel.io/) templates for one-click scheduled
PostgreSQL / MySQL backups with `hcli`. They **wrap the published cron-tab
images** ([`terminal-cli-cron-postgres`](https://hub.docker.com/r/heronlabs/terminal-cli-cron-postgres)
/ [`terminal-cli-cron-mysql`](https://hub.docker.com/r/heronlabs/terminal-cli-cron-mysql)),
which already run as **root**, ship `crond`, and bake the run-once-on-start +
every-12h schedule. The template's job is to add the EasyPanel env form and a
file mount that overrides the schedule — no custom image build, no `deploy.command`.

| Template | Engine | Image | Runs |
|---|---|---|---|
| `psql-backup.json` | PostgreSQL | `heronlabs/terminal-cli-cron-postgres` | `hcli psql-backup` on start + every 12h |
| `mysql-backup.json` | MySQL | `heronlabs/terminal-cli-cron-mysql` | `hcli mysql-backup` on start + every 12h |

## Deploy

1. In EasyPanel, open (or create) a project, then **Create Service → From Schema**.
2. Paste the contents of `psql-backup.json` or `mysql-backup.json`.
3. **Pin the image tag** — replace `CHANGE_ME` in `source.image`
   (`heronlabs/terminal-cli-cron-postgres:CHANGE_ME`) with a published release
   tag. See [Image tag](#image-tag) below.
4. Fill in the environment variables (see [Environment](#environment)).
5. Deploy.

The image's own `CMD` runs as root: it dumps `printenv` to `/etc/environment`
(so `crond` inherits EasyPanel's injected env vars), runs one backup
immediately, then starts `crond` in the foreground. The template adds a file
mount at `/etc/crontabs/root` that overlays the baked crontab, so you can change
the cadence from the template without building a new image.

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
heronlabs/terminal-cli-cron-postgres:v2.0.2
```

Find published tags on the cron-image Docker Hub tags pages —
[terminal-cli-cron-postgres](https://hub.docker.com/r/heronlabs/terminal-cli-cron-postgres/tags)
/ [terminal-cli-cron-mysql](https://hub.docker.com/r/heronlabs/terminal-cli-cron-mysql/tags) —
or the repository's [GitHub releases](https://github.com/heronlabs/terminal-cli/releases).

> Future follow-up (not in this change): publishing a moving `latest` tag from
> CD would let templates omit the pin.

## Changing the schedule

The cron expression lives in the file mount at `/etc/crontabs/root`, which
overrides the schedule baked into the image:

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

## Relationship to the images

These templates package the **cron-tab images**
(`cron-tab-postgres.dockerfile` / `cron-tab-mysql.dockerfile`) for one-click
EasyPanel deploy: the image supplies root + `crond` + the baked run-once and
schedule, and the template supplies the env form and the schedule-override file
mount.

The plain [`heronlabs/terminal-cli`](https://hub.docker.com/r/heronlabs/terminal-cli)
image is **not** used here — it runs non-root and ships no cron, so it's for
interactive / one-off CLI use (`docker run … hcli psql-backup`), not scheduled
backups. See the repository [`Dockerfile`](../Dockerfile) and the main
[README](../README.md#docker--cron).
