import {GetObjectCommand, PutObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {Injectable, Logger} from '@nestjs/common';
import {readFileSync, writeFileSync} from 'fs';

import {EnvironmentService} from '../../environment/services/environment-service';

@Injectable()
export class S3StorageService {
  public async upload(filePath: string, key?: string) {
    try {
      const body = readFileSync(filePath);

      const command = new PutObjectCommand({
        Bucket: this.environmentService.storage.bucketName,
        Key: key ?? filePath,
        Body: body,
        ContentType: 'application/octet-stream',
      });

      await this.s3.send(command);

      this.logger.log('Uploaded file to S3');

      return {ok: true};
    } catch (error) {
      if (error instanceof Error) {
        return {ok: false, error};
      }

      return {ok: false, error: new Error('Error uploading file to S3')};
    }
  }

  public async download(key: string) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.environmentService.storage.bucketName,
        Key: key,
      });

      const response = await this.s3.send(command);
      const bytes = await response.Body!.transformToByteArray();

      writeFileSync(key, bytes);

      this.logger.log('Downloaded file from S3');

      return {ok: true};
    } catch (error) {
      if (error instanceof Error) {
        return {ok: false, error};
      }

      return {ok: false, error: new Error('Error downloading file from S3')};
    }
  }

  constructor(
    private readonly logger: Logger,
    private readonly environmentService: EnvironmentService,
    private readonly s3: S3Client,
  ) {}
}
