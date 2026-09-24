import {Injectable} from '@nestjs/common';
import {execSync} from 'child_process';
import {rmSync} from 'fs';

import {EnvironmentService} from '../../../infrastructure/environment/services/environment-service';
import {S3StorageService} from '../../../infrastructure/storage/services/s3-storage-service';
import {BackupService} from '../../interfaces/backup-service';
import {ScriptLoaderService} from '../script-loader-service';

@Injectable()
export class PsqlBackupService extends BackupService {
  protected async dump(filename?: string) {
    const db = await this.environmentService.database();

    if (!db.ok) {
      return {ok: false as const, error: db.error};
    }

    const {host, port, name, user, password} = db.connection;

    const backupFileName = this.resolveBackupFileName(filename, name, 'sql.gz');

    try {
      execSync(this.scriptLoader.load('psql', 'psql-backup'), {
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
        {database: name, filename: backupFileName},
        'Backup dump completed',
      );

      return {ok: true as const, data: {backupFileName}};
    } catch {
      rmSync(backupFileName, {force: true});

      return {ok: false as const, error: new Error('pg_dump failed')};
    }
  }

  constructor(
    private readonly environmentService: EnvironmentService,
    protected readonly s3StorageService: S3StorageService,
    private readonly scriptLoader: ScriptLoaderService,
  ) {
    super(s3StorageService);
  }
}
