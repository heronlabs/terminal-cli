import {Command, CommandRunner, Option} from 'nest-commander';

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
    required: true,
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

  public async run(_args: string[], options: RollupOptions) {
    await this.mysqlRollupService.run(
      options[RollupOptionsKeys.FILENAME],
      options[RollupOptionsKeys.LOCAL] ?? false,
    );
  }

  constructor(private readonly mysqlRollupService: MysqlRollupService) {
    super();
  }
}
