import {Command, CommandRunner, Option} from 'nest-commander';

import {JobRunnerService} from '../../../../core/services/job/job-runner-service';
import {MysqlRollupService} from '../../../../core/services/mysql/mysql-rollup-service';
import {RollupOptions, RollupOptionsKeys} from './types/rollup-options';

@Command({
  name: 'mysql-rollup',
  description:
    'Restore a MySQL database from a backup file (S3 by default, or local filesystem with --local)',
})
export class MysqlRollupCommand extends CommandRunner {
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
      {command: 'mysql-rollup', job: 'rollup', trigger: 'manual', lock: true},
      () =>
        this.mysqlRollupService.run({
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
    private readonly mysqlRollupService: MysqlRollupService,
    private readonly jobRunner: JobRunnerService,
  ) {
    super();
  }
}
