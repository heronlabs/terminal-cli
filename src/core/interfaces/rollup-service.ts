import {Logger} from '@nestjs/common';
import {rmSync, unlinkSync} from 'fs';

import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';

export abstract class RollupService {
  protected abstract restore(
    filename: string,
  ): Promise<
    {ok: true; data: {backupFileName: string}} | {ok: false; error: Error}
  >;

  public async run(filename: string, local: boolean) {
    if (!local) {
      const {error: downloadError} =
        await this.s3StorageService.download(filename);

      if (downloadError) {
        rmSync(filename, {force: true});
        this.logger.error(downloadError);
        return {ok: false};
      }
    }

    const result = await this.restore(filename);

    if (!result.ok) {
      this.logger.error(result.error);
      this.deleteDownloadedFile(filename, local);
      return {ok: false};
    }

    this.logger.log(`Restored ${result.data.backupFileName}`);

    this.deleteDownloadedFile(filename, local);

    return {ok: true};
  }

  private deleteDownloadedFile(filename: string, local: boolean) {
    if (local) {
      return;
    }

    unlinkSync(filename);
    this.logger.log('Deleted downloaded backup file');
  }

  constructor(
    protected readonly logger: Logger,
    protected readonly s3StorageService: S3StorageService,
  ) {}
}
