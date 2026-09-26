import {Logger} from '@nestjs/common';
import {rmSync, unlinkSync} from 'fs';

import {redact} from '../../infrastructure/log/redact';
import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';

export abstract class RollupService {
  protected abstract readonly engine: 'postgres' | 'mysql';

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
          {
            logId: 'rollup.download-failed',
            engine: this.engine,
            filename,
            err: downloadError,
            errorName: downloadError.name,
            errorMessage: redact(downloadError.message),
          },
          'rollup.download-failed',
          RollupService.name,
        );
        return {ok: false};
      }
    }

    const result = await this.restore(filename);

    if (!result.ok) {
      this.logger.error(
        {
          logId: 'rollup.restore-failed',
          engine: this.engine,
          filename,
          err: result.error,
          errorName: result.error.name,
          errorMessage: redact(result.error.message),
        },
        'rollup.restore-failed',
        RollupService.name,
      );
      this.deleteDownloadedFile(filename, local);
      return {ok: false};
    }

    this.logger.log(
      {
        logId: 'rollup.completed',
        engine: this.engine,
        filename: result.data.backupFileName,
      },
      'rollup.completed',
      RollupService.name,
    );

    this.deleteDownloadedFile(filename, local);

    return {ok: true};
  }

  private deleteDownloadedFile(filename: string, local: boolean) {
    if (local) {
      return;
    }

    unlinkSync(filename);
    this.logger.log(
      {
        logId: 'rollup.downloaded-file-deleted',
        engine: this.engine,
        filename,
      },
      'rollup.downloaded-file-deleted',
      RollupService.name,
    );
  }

  constructor(
    protected readonly logger: Logger,
    protected readonly s3StorageService: S3StorageService,
  ) {}
}
