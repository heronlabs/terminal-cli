import {Injectable, Logger} from '@nestjs/common';
import {execSync} from 'child_process';
import {DateTime} from 'luxon';

import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';
import {BackupService} from '../interfaces/backup-service';

@Injectable()
export class EasypanelBackupService extends BackupService {
  protected dump(filename?: string) {
    if (process.getuid?.() !== 0) {
      return {
        ok: false as const,
        error: new Error(
          'easypanel-backup must run as root (needs systemctl + /var/lib/docker access)',
        ),
      };
    }

    const timestamp = DateTime.utc().toFormat("yyyy-MM-dd'T'HH-mm-ss'Z'");

    const backupFileName = filename ?? `easypanel-${timestamp}.tar.gz`;

    try {
      execSync(
        `set -e
trap 'systemctl start docker' EXIT
systemctl stop docker.socket || true
systemctl stop docker
tar czf "$ARCHIVE" --warning=no-file-changed /etc/easypanel /var/lib/docker/volumes /var/lib/docker/buildkit 2>/dev/null || true
test -s "$ARCHIVE"`,
        {
          env: {
            ...process.env,
            ARCHIVE: backupFileName,
          },
          stdio: ['inherit', 'pipe', 'inherit'],
          shell: '/bin/bash',
        },
      );

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
  ) {
    super(logger, s3StorageService);
  }
}
