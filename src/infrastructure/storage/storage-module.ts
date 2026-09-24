import {S3Client} from '@aws-sdk/client-s3';
import {Module} from '@nestjs/common';

import {EnvironmentModule} from '../environment/environment-module';
import {S3StorageService} from './services/s3-storage-service';

@Module({
  imports: [EnvironmentModule],
  providers: [
    S3StorageService,
    {
      provide: S3Client,
      useValue: new S3Client({}),
    },
  ],
  exports: [S3StorageService],
})
export class StorageModule {}
