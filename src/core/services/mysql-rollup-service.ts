import {Injectable, Logger} from '@nestjs/common';
import {execSync} from 'child_process';

import {EnvironmentService} from '../../infrastructure/environment/services/environment-service';
import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';
import {RollupService} from '../interfaces/rollup-service';

@Injectable()
export class MysqlRollupService extends RollupService {
  protected restore(backupFileName: string) {
    const {host, port, name, user, password} = this.environmentService.database;

    try {
      execSync(
        `set -o pipefail; gunzip -c "${backupFileName}" | mariadb -u "${user}" -h "${host}" -P "${port}" "${name}"`,
        {
          env: {
            ...process.env,
            MYSQL_PWD: password,
          },
          stdio: ['inherit', 'pipe', 'inherit'],
          shell: '/bin/bash',
        },
      );

      return {ok: true as const, data: {backupFileName}};
    } catch {
      return {ok: false as const, error: new Error('mariadb restore failed')};
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
