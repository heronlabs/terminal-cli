import {Command, CommandRunner, Option} from 'nest-commander';

import {EasypanelBackupService} from '../../../../core/services/easy-panel/easypanel-backup-service';
import {BackupOptions, BackupOptionsKeys} from './types/backup-options';

@Command({
  name: 'easypanel-backup',
  description: 'Backup EasyPanel host (config + Docker state)',
})
export class EasypanelBackupCommand extends CommandRunner {
  @Option({
    flags: `-f, --${BackupOptionsKeys.FILENAME} <filename>`,
    description:
      'Output filename (e.g. snapshot.tar.gz). Defaults to "easypanel-<timestamp>.tar.gz"',
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
    await this.easypanelBackupService.run(
      options?.[BackupOptionsKeys.LOCAL] ?? false,
      options?.[BackupOptionsKeys.FILENAME],
    );
  }

  constructor(private readonly easypanelBackupService: EasypanelBackupService) {
    super();
  }
}
