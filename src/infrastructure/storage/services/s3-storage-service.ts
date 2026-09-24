import {GetObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {Upload} from '@aws-sdk/lib-storage';
import {Injectable, Logger} from '@nestjs/common';
import {createReadStream, createWriteStream} from 'fs';
import type {Readable} from 'stream';
import {pipeline} from 'stream/promises';

import {EnvironmentService} from '../../environment/services/environment-service';

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);

  public async upload(filePath: string, key = filePath) {
    try {
      const bucket = this.environmentService.storage.bucketName;

      const upload = new Upload({
        client: this.s3,
        params: {
          Bucket: bucket,
          Key: key,
          Body: createReadStream(filePath),
          ContentType: 'application/octet-stream',
        },
      });

      await upload.done();

      this.logger.log({bucket, key}, 'Uploaded file to S3');

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
      const bucket = this.environmentService.storage.bucketName;

      const command = new GetObjectCommand({Bucket: bucket, Key: key});

      const response = await this.s3.send(command);

      await pipeline(response.Body as Readable, createWriteStream(key));

      this.logger.log({bucket, key}, 'Downloaded file from S3');

      return {ok: true};
    } catch (error) {
      if (error instanceof Error) {
        return {ok: false, error};
      }

      return {ok: false, error: new Error('Error downloading file from S3')};
    }
  }

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly s3: S3Client,
  ) {}
}
