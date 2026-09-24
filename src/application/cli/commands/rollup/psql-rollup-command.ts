import {Command, CommandRunner, Option} from 'nest-commander';

import {JobRunnerService} from '../../../../core/services/job/job-runner-service';
import {PsqlRollupService} from '../../../../core/services/psql/psql-rollup-service';
import {RollupOptions, RollupOptionsKeys} from './types/rollup-options';

@Command({
  name: 'psql-rollup',
  description:
    'Restore a PostgreSQL database from a backup file (S3 by default, or local filesystem with --local)',
})
export class PsqlRollupCommand extends CommandRunner {
  @Option({
    flags: `-f, --${RollupOptionsKeys.FILENAME} <filename>`,
    description:
      'Backup filename to restore (e.g. mydb-2026-03-05T12-00-00Z.sql.gz)',
  })
  parseFilename(val: string): string {
    return val;
  }

  @Option({
    flags: `--${RollupOptionsKeys.LOCAL}`,
    description:
      'Read backup from the local filesystem instead of S3 (default: S3)',
  })
  parseLocal(): boolean {
    return true;
  }

  @Option({
    flags: `--${RollupOptionsKeys.LATEST}`,
    description: 'Restore the newest backup of the configured database from S3',
  })
  parseLatest(): boolean {
    return true;
  }

  public async run(_args: string[], options: RollupOptions) {
    const outcome = await this.jobRunner.run(
      {command: 'psql-rollup', job: 'rollup', trigger: 'manual', lock: true},
      () =>
        this.psqlRollupService.run({
          filename: options[RollupOptionsKeys.FILENAME],
          latest: options[RollupOptionsKeys.LATEST] ?? false,
          local: options[RollupOptionsKeys.LOCAL] ?? false,
        }),
    );

    if (outcome !== 'ok') {
      process.exitCode = 1;
    }
  }

  constructor(
    private readonly psqlRollupService: PsqlRollupService,
    private readonly jobRunner: JobRunnerService,
  ) {
    super();
  }
}
