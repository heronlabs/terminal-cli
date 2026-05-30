import {Injectable, Logger} from '@nestjs/common';
import {execSync} from 'child_process';
import {DateTime} from 'luxon';

import {EnvironmentService} from '../../infrastructure/environment/services/environment-service';
import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';
import {BackupService} from '../interfaces/backup-service';

@Injectable()
export class PsqlBackupService extends BackupService {
  protected dump(filename?: string) {
    const {host, port, name, user, password} = this.environmentService.database;

    const timestamp = DateTime.utc().toFormat("yyyy-MM-dd'T'HH-mm-ss'Z'");

    const backupFileName = filename ?? `${name}-${timestamp}.sql.gz`;

    try {
      execSync('set -o pipefail; pg_dump | gzip > "$BACKUP_FILE"', {
        env: {
          ...process.env,
          PGHOST: host,
          PGPORT: port,
          PGDATABASE: name,
          PGUSER: user,
          PGPASSWORD: password,
          BACKUP_FILE: backupFileName,
        },
        stdio: ['inherit', 'pipe', 'inherit'],
        shell: '/bin/bash',
      });

      this.logger.log(
        `Backup PostgreSQL database successfully! Filename: ${backupFileName}`,
      );

      return {ok: true as const, data: {backupFileName}};
    } catch {
      return {ok: false as const, error: new Error('pg_dump failed')};
    }
  }

  constructor(
    protected readonly logger: Logger,
    private readonly environmentService: EnvironmentService,
    protected readonly s3StorageService: S3StorageService,
  ) {
    super(logger, s3StorageService);
  }
}
