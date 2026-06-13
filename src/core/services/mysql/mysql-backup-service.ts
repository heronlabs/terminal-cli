import {Injectable, Logger} from '@nestjs/common';
import {execSync} from 'child_process';
import {DateTime} from 'luxon';

import {EnvironmentService} from '../../../infrastructure/environment/services/environment-service';
import {S3StorageService} from '../../../infrastructure/storage/services/s3-storage-service';
import {BackupService} from '../../interfaces/backup-service';
import {ScriptLoaderService} from '../script-loader-service';

@Injectable()
export class MysqlBackupService extends BackupService {
  protected async dump(filename?: string) {
    const db = await this.environmentService.database();

    if (!db.ok) {
      return {ok: false as const, error: db.error};
    }

    const {host, port, name, user, password} = db.connection;

    const timestamp = DateTime.utc().toFormat("yyyy-MM-dd'T'HH-mm-ss'Z'");

    const backupFileName = filename ?? `${name}-${timestamp}.sql.gz`;

    try {
      execSync(this.scriptLoader.load('mysql', 'mysql-backup'), {
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
      });

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
    private readonly scriptLoader: ScriptLoaderService,
  ) {
    super(logger, s3StorageService);
  }
}
