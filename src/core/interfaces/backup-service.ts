import {Logger} from '@nestjs/common';
import {unlinkSync} from 'fs';

import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';

export abstract class BackupService {
  protected abstract dump(
    filename?: string,
  ): Promise<
    {ok: true; data: {backupFileName: string}} | {ok: false; error: Error}
  >;

  public async run(local: boolean, filename?: string) {
    const result = await this.dump(filename);

    if (!result.ok) {
      this.logger.error(result.error.message);
      return;
    }

    if (local) {
      return {ok: true};
    }

    const {error: uploadError} = await this.s3StorageService.upload(
      result.data.backupFileName,
    );

    if (uploadError) {
      this.logger.error(uploadError.message);
      return;
    }

    unlinkSync(result.data.backupFileName);
    this.logger.log('Deleted local backup file');

    return {ok: true};
  }

  constructor(
    protected readonly logger: Logger,
    protected readonly s3StorageService: S3StorageService,
  ) {}
}
