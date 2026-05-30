import {Injectable, Logger} from '@nestjs/common';
import {execSync} from 'child_process';
import {DateTime} from 'luxon';

import {EnvironmentService} from '../../infrastructure/environment/services/environment-service';
import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';
import {BackupService} from '../interfaces/backup-service';

@Injectable()
export class MysqlBackupService extends BackupService {
  protected dump(filename?: string) {
    const {host, port, name, user, password} = this.environmentService.database;

    const timestamp = DateTime.utc().toFormat("yyyy-MM-dd'T'HH-mm-ss'Z'");

    const backupFileName = filename ?? `${name}-${timestamp}.sql.gz`;

    try {
      // Command is a constant: every dynamic value flows through `env` and is
      // referenced as a quoted shell variable. Bash does not re-evaluate the
      // contents of an expanded variable, so a malicious filename or db param
      // (e.g. "$(rm -rf /)") is treated literally — no shell injection.
      execSync(
        'set -o pipefail; mariadb-dump -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" | gzip > "$BACKUP_FILE"',
        {
          env: {
            ...process.env,
            DB_USER: user,
            DB_HOST: host,
            DB_PORT: port,
            DB_NAME: name,
            MYSQL_PWD: password,
            BACKUP_FILE: backupFileName,
          },
          stdio: ['inherit', 'pipe', 'inherit'],
          shell: '/bin/bash',
        },
      );

      this.logger.log(
        `Backup MySQL database successfully! Filename: ${backupFileName}`,
      );

      return {ok: true as const, data: {backupFileName}};
    } catch {
      return {ok: false as const, error: new Error('mariadb-dump failed')};
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
