import {Logger} from '@nestjs/common';
import {rmSync, unlinkSync} from 'fs';

import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';

export abstract class RollupService {
  protected readonly logger = new Logger(this.constructor.name);

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
        this.logger.error(
          {err: downloadError, filename},
          'Backup download failed',
        );
        return {ok: false};
      }
    }

    const result = await this.restore(filename);

    if (!result.ok) {
      this.logger.error({err: result.error, filename}, 'Backup restore failed');
      this.deleteDownloadedFile(filename, local);
      return {ok: false};
    }

    this.logger.log(
      {filename: result.data.backupFileName},
      'Backup restore completed',
    );

    this.deleteDownloadedFile(filename, local);

    return {ok: true};
  }

  private deleteDownloadedFile(filename: string, local: boolean) {
    if (local) {
      return;
    }

    unlinkSync(filename);
    this.logger.log({filename}, 'Deleted downloaded backup file');
  }

  constructor(protected readonly s3StorageService: S3StorageService) {}
}
