import {S3Client} from '@aws-sdk/client-s3';
import {Logger, Module, ModuleMetadata} from '@nestjs/common';

import {EnvironmentModule} from '../environment/environment-module';
import {S3StorageService} from './services/s3-storage-service';

export const storageModule: ModuleMetadata = {
  imports: [EnvironmentModule],
  providers: [
    Logger,
    S3StorageService,
    {
      provide: S3Client,
      useValue: new S3Client({}),
    },
  ],
  exports: [S3StorageService],
};

@Module(storageModule)
export class StorageModule {}
