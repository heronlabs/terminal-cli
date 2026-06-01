import {Injectable, Logger} from '@nestjs/common';
import {execSync} from 'child_process';

import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';
import {RollupService} from '../interfaces/rollup-service';
import {ScriptLoaderService} from './script-loader-service';

@Injectable()
export class EasypanelRollupService extends RollupService {
  protected restore(backupFileName: string) {
    if (process.getuid?.() !== 0) {
      return {
        ok: false as const,
        error: new Error(
          'easypanel-rollup must run as root (needs systemctl + /var/lib/docker access)',
        ),
      };
    }

    try {
      execSync(this.scriptLoader.load('easypanel-rollup'), {
        env: {
          ...process.env,
          ARCHIVE: backupFileName,
        },
        stdio: ['inherit', 'pipe', 'inherit'],
        shell: '/bin/bash',
      });

      return {ok: true as const, data: {backupFileName}};
    } catch {
      return {ok: false as const, error: new Error('easypanel restore failed')};
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
