import {Command, CommandRunner, Option} from 'nest-commander';

import {PsqlBackupService} from '../../../../core/services/psql/psql-backup-service';
import {BackupOptions, BackupOptionsKeys} from './types/backup-options';

@Command({
  name: 'psql-backup',
  description: 'Backup PostgreSQL database',
})
export class PsqlBackupCommand extends CommandRunner {
  @Option({
    flags: `-f, --${BackupOptionsKeys.FILENAME} <filename>`,
    description:
      'Output filename (e.g. seed.sql.gz). Defaults to "<database>-<timestamp>.sql.gz"',
  })
  parseFilename(val: string): string {
    return val;
  }

  @Option({
    flags: `--${BackupOptionsKeys.LOCAL}`,
    description:
      'Save backup to the local filesystem instead of S3 (default: S3)',
  })
  parseLocal(): boolean {
    return true;
  }

  public async run(_args?: string[], options?: BackupOptions) {
    const result = await this.psqlBackupService.run(
      options?.[BackupOptionsKeys.LOCAL] ?? false,
      options?.[BackupOptionsKeys.FILENAME],
    );

    if (!result.ok) {
      process.exitCode = 1;
    }
  }

  constructor(private readonly psqlBackupService: PsqlBackupService) {
    super();
  }
}
