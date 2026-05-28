import {Logger} from '@nestjs/common';
import {unlinkSync} from 'fs';

import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';

export abstract class RollupService {
  protected abstract restore(
    filename: string,
  ): {ok: true; data: {backupFileName: string}} | {ok: false; error: Error};

  public async run(filename: string, local: boolean) {
    if (!local) {
      const {error: downloadError} =
        await this.s3StorageService.download(filename);

      if (downloadError) {
        this.logger.error(downloadError.message);
        return;
      }
    }

    const result = this.restore(filename);

    if (!result.ok) {
      this.logger.error(result.error.message);
      return;
    }

    this.logger.log(`Restored ${result.data.backupFileName}`);

    if (!local) {
      unlinkSync(filename);
      this.logger.log('Deleted downloaded backup file');
    }
  }

  constructor(
    protected readonly logger: Logger,
    protected readonly s3StorageService: S3StorageService,
  ) {}
}
