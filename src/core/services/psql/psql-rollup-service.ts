import {Injectable, Logger} from '@nestjs/common';
import {execSync} from 'child_process';

import {EnvironmentService} from '../../../infrastructure/environment/services/environment-service';
import {S3StorageService} from '../../../infrastructure/storage/services/s3-storage-service';
import {RollupService} from '../../interfaces/rollup-service';
import {ScriptLoaderService} from '../script-loader-service';

@Injectable()
export class PsqlRollupService extends RollupService {
  protected async restore(backupFileName: string) {
    const {host, port, name, user, password} =
      await this.environmentService.database();

    try {
      execSync(this.scriptLoader.load('psql', 'psql-rollup'), {
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

      return {ok: true as const, data: {backupFileName}};
    } catch {
      return {ok: false as const, error: new Error('psql restore failed')};
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
