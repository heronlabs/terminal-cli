import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import {Upload} from '@aws-sdk/lib-storage';
import {Injectable, Logger} from '@nestjs/common';
import {createReadStream, createWriteStream} from 'fs';
import type {Readable} from 'stream';
import {pipeline} from 'stream/promises';

import {EnvironmentService} from '../../environment/services/environment-service';

export type StoredObject = {key: string; size: number; lastModified: Date};

@Injectable()
export class S3StorageService {
  public async upload(filePath: string, key?: string) {
    try {
      const upload = new Upload({
        client: this.s3,
        params: {
          Bucket: this.environmentService.storage.bucketName,
          Key: key ?? filePath,
          Body: createReadStream(filePath),
          ContentType: 'application/octet-stream',
        },
      });

      await upload.done();

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

      await pipeline(response.Body as Readable, createWriteStream(key));

      this.logger.log('Downloaded file from S3');

      return {ok: true};
    } catch (error) {
      if (error instanceof Error) {
        return {ok: false, error};
      }

      return {ok: false, error: new Error('Error downloading file from S3')};
    }
  }

  public async list(prefix: string) {
    try {
      const objects: StoredObject[] = [];
      let continuationToken: string | undefined;

      do {
        const response = await this.s3.send(
          new ListObjectsV2Command({
            Bucket: this.environmentService.storage.bucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        );

        response.Contents?.forEach(({Key, Size, LastModified}) => {
          if (Key && LastModified) {
            objects.push({
              key: Key,
              size: Size ?? 0,
              lastModified: LastModified,
            });
          }
        });

        continuationToken = response.IsTruncated
          ? response.NextContinuationToken
          : undefined;
      } while (continuationToken);

      objects.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
      );

      return {ok: true as const, objects};
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error
            ? error
            : new Error('Error listing S3 objects'),
      };
    }
  }

  constructor(
    private readonly logger: Logger,
    private readonly environmentService: EnvironmentService,
    private readonly s3: S3Client,
  ) {}
}
