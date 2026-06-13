import {Injectable, Logger} from '@nestjs/common';
import {execSync} from 'child_process';

import {EnvironmentService} from '../../../infrastructure/environment/services/environment-service';
import {S3StorageService} from '../../../infrastructure/storage/services/s3-storage-service';
import {RollupService} from '../../interfaces/rollup-service';
import {ScriptLoaderService} from '../script-loader-service';

@Injectable()
export class MysqlRollupService extends RollupService {
  protected async restore(backupFileName: string) {
    const db = await this.environmentService.database();

    if (!db.ok) {
      return {ok: false as const, error: db.error};
    }

    const {host, port, name, user, password} = db.connection;

    try {
      execSync(this.scriptLoader.load('mysql', 'mysql-rollup'), {
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

      return {ok: true as const, data: {backupFileName}};
    } catch {
      return {ok: false as const, error: new Error('mariadb restore failed')};
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
