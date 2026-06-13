import {Injectable, Logger} from '@nestjs/common';
import {execSync} from 'child_process';

import {S3StorageService} from '../../../infrastructure/storage/services/s3-storage-service';
import {BackupService} from '../../interfaces/backup-service';
import {ScriptLoaderService} from '../script-loader-service';

@Injectable()
export class EasypanelBackupService extends BackupService {
  protected async dump(filename?: string) {
    if (process.getuid?.() !== 0) {
      return {
        ok: false as const,
        error: new Error(
          'easypanel-backup must run as root (needs systemctl + /var/lib/docker access)',
        ),
      };
    }

    const backupFileName = this.resolveBackupFileName(
      filename,
      'easypanel',
      'tar.gz',
    );

    try {
      execSync(this.scriptLoader.load('easy-panel', 'easypanel-backup'), {
        env: {
          ...process.env,
          ARCHIVE: backupFileName,
        },
        stdio: ['inherit', 'pipe', 'inherit'],
        shell: '/bin/bash',
      });

      this.logger.log(
        `Backup EasyPanel host successfully! Filename: ${backupFileName}`,
      );

      return {ok: true as const, data: {backupFileName}};
    } catch {
      return {ok: false as const, error: new Error('easypanel backup failed')};
    }
  }

  constructor(
    protected readonly logger: Logger,
    protected readonly s3StorageService: S3StorageService,
    private readonly scriptLoader: ScriptLoaderService,
  ) {
    super(logger, s3StorageService);
  }
}
