import {Upload} from '@aws-sdk/lib-storage';
import {faker} from '@faker-js/faker';
import {createReadStream, createWriteStream} from 'fs';
import {pipeline} from 'stream/promises';

import {S3StorageService} from '../../../../../src/infrastructure/storage/services/s3-storage-service';
import {storageModule} from '../../../../../src/infrastructure/storage/storage-module';
import {
  createTestingModule,
  loggerService,
  s3Service,
} from '../../../../__mocks__/create-testing-module';

const {uploadDone} = vi.hoisted(() => ({uploadDone: vi.fn()}));

vi.mock('@aws-sdk/lib-storage', () => ({
  Upload: vi.fn(
    class {
      done = uploadDone;
    },
  ),
}));
vi.mock('fs', () => ({createReadStream: vi.fn(), createWriteStream: vi.fn()}));
vi.mock('stream/promises', () => ({pipeline: vi.fn()}));

describe('Given a service', () => {
  let service: S3StorageService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(storageModule).compile();
    service = moduleRef.get(S3StorageService);
  });

  describe('Given upload', () => {
    it('Should create an Upload with the S3 client and the exact bucket key stream and content type', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;
      const stream = {path: filePath};

      vi.mocked(createReadStream).mockReturnValueOnce(stream as never);

      await service.upload(filePath);

      expect(Upload).toHaveBeenCalledWith({
        client: expect.anything(),
        params: {
          Bucket: 'AWS_S3_BUCKET_NAME',
          Key: filePath,
          Body: stream,
          ContentType: 'application/octet-stream',
        },
      });
    });

    it('Should stream the file from disk instead of reading it into memory', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;

      await service.upload(filePath);

      expect(createReadStream).toHaveBeenCalledWith(filePath);
    });

    it('Should wait for the upload to complete', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;

      await service.upload(filePath);

      expect(uploadDone).toHaveBeenCalledTimes(1);
    });

    it('Should use the explicit key when provided instead of the file path', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;
      const key = `${faker.string.alphanumeric(10)}-explicit.sql.gz`;

      await service.upload(filePath, key);

      expect(Upload).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({Key: key}),
        }),
      );
    });

    it('Should log the exact upload success message', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;

      await service.upload(filePath);

      expect(loggerService.log).toHaveBeenCalledWith('Uploaded file to S3');
    });

    it('Should return ok true when upload succeeds', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;

      const result = await service.upload(filePath);

      expect(result).toEqual({ok: true});
    });

    it('Should not log success when the upload rejects', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;

      uploadDone.mockRejectedValueOnce(new Error(faker.lorem.words()));

      await service.upload(filePath);

      expect(loggerService.log).not.toHaveBeenCalled();
    });

    it('Should return ok false with the original error when the upload rejects with an Error', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;
      const error = new Error(faker.lorem.words());

      uploadDone.mockRejectedValueOnce(error);

      const result = await service.upload(filePath);

      expect(result).toEqual({ok: false, error});
    });

    it('Should return ok false with generic upload error when thrown value is not an Error', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;

      uploadDone.mockRejectedValueOnce(faker.lorem.word());

      const result = await service.upload(filePath);

      expect(result).toEqual({
        ok: false,
        error: new Error('Error uploading file to S3'),
      });
    });
  });

  describe('Given download', () => {
    it('Should send a GetObjectCommand with the exact bucket and key', async () => {
      const key = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});

      await service.download(key);

      expect(s3Service.send).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          input: {
            Bucket: 'AWS_S3_BUCKET_NAME',
            Key: key,
          },
        }),
      );
    });

    it('Should log the exact download success message', async () => {
      const key = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});

      await service.download(key);

      expect(loggerService.log).toHaveBeenCalledWith('Downloaded file from S3');
    });

    it('Should return ok true when download succeeds', async () => {
      const key = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});

      const result = await service.download(key);

      expect(result).toEqual({ok: true});
    });

    it('Should pipe the response body into a file stream under the same key', async () => {
      const key = `${faker.string.alphanumeric(10)}.sql.gz`;
      const body = {id: faker.string.uuid()};
      const stream = {path: key};

      s3Service.send.mockResolvedValueOnce({Body: body});
      vi.mocked(createWriteStream).mockReturnValueOnce(stream as never);

      await service.download(key);

      expect(createWriteStream).toHaveBeenCalledWith(key);
    });

    it('Should pipe the response body into the file stream', async () => {
      const key = `${faker.string.alphanumeric(10)}.sql.gz`;
      const body = {id: faker.string.uuid()};
      const stream = {path: key};

      s3Service.send.mockResolvedValueOnce({Body: body});
      vi.mocked(createWriteStream).mockReturnValueOnce(stream as never);

      await service.download(key);

      expect(pipeline).toHaveBeenCalledWith(body, stream);
    });

    it('Should return ok false with the original error when the pipeline rejects', async () => {
      const key = `${faker.string.alphanumeric(10)}.sql.gz`;
      const error = new Error(faker.lorem.words());

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(pipeline).mockRejectedValueOnce(error);

      const result = await service.download(key);

      expect(result).toEqual({ok: false, error});
    });

    it('Should not log success when the pipeline rejects', async () => {
      const key = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(pipeline).mockRejectedValueOnce(new Error(faker.lorem.words()));

      await service.download(key);

      expect(loggerService.log).not.toHaveBeenCalled();
    });

    it('Should return ok false with the original error when send rejects with an Error', async () => {
      const key = `${faker.string.alphanumeric(10)}.sql.gz`;
      const error = new Error(faker.lorem.words());

      s3Service.send.mockRejectedValueOnce(error);

      const result = await service.download(key);

      expect(result).toEqual({ok: false, error});
    });

    it('Should return ok false with generic download error when thrown value is not an Error', async () => {
      const key = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockImplementationOnce(() => {
        throw faker.lorem.word();
      });

      const result = await service.download(key);

      expect(result).toEqual({
        ok: false,
        error: new Error('Error downloading file from S3'),
      });
    });
  });

  describe('Given list', () => {
    const prefix = `${faker.string.alphanumeric(8)}-`;
    const object = () => ({
      Key: `${faker.string.alphanumeric(10)}.sql.gz`,
      Size: faker.number.int({min: 1, max: 1_000_000}),
      LastModified: faker.date.past(),
    });

    it('Should send ListObjectsV2 with the bucket and prefix', async () => {
      s3Service.send.mockResolvedValueOnce({Contents: []});

      await service.list(prefix);

      expect(s3Service.send.mock.calls[0]![0].input).toEqual({
        Bucket: 'AWS_S3_BUCKET_NAME',
        Prefix: prefix,
        ContinuationToken: undefined,
      });
    });

    it('Should follow the continuation token', async () => {
      s3Service.send
        .mockResolvedValueOnce({
          Contents: [],
          IsTruncated: true,
          NextContinuationToken: 'next',
        })
        .mockResolvedValueOnce({Contents: []});

      await service.list(prefix);

      expect(s3Service.send).toHaveBeenCalledTimes(2);
    });

    it('Should send the continuation token on the next page', async () => {
      const token = faker.string.alphanumeric(16);

      s3Service.send
        .mockResolvedValueOnce({
          Contents: [],
          IsTruncated: true,
          NextContinuationToken: token,
        })
        .mockResolvedValueOnce({Contents: []});

      await service.list(prefix);

      expect(s3Service.send.mock.calls[1]![0].input.ContinuationToken).toBe(
        token,
      );
    });

    it('Should stop when the page is not truncated', async () => {
      s3Service.send
        .mockResolvedValueOnce({
          Contents: [],
          IsTruncated: false,
          NextContinuationToken: faker.string.alphanumeric(16),
        })
        .mockResolvedValueOnce({Contents: []});

      await service.list(prefix);

      expect(s3Service.send).toHaveBeenCalledTimes(1);
    });

    it('Should collect the objects of every page', async () => {
      const first = object();
      const second = object();

      s3Service.send
        .mockResolvedValueOnce({
          Contents: [first],
          IsTruncated: true,
          NextContinuationToken: 'next',
        })
        .mockResolvedValueOnce({Contents: [second]});

      const result = await service.list(prefix);

      expect(result.ok && result.objects.map(({key}) => key).sort()).toEqual(
        [first.Key, second.Key].sort(),
      );
    });

    it('Should return the objects newest first', async () => {
      s3Service.send.mockResolvedValueOnce({
        Contents: [
          {Key: 'a', Size: 1, LastModified: new Date('2026-01-01')},
          {Key: 'b', Size: 2, LastModified: new Date('2026-02-01')},
        ],
      });

      expect(await service.list(prefix)).toEqual({
        ok: true,
        objects: [
          {key: 'b', size: 2, lastModified: new Date('2026-02-01')},
          {key: 'a', size: 1, lastModified: new Date('2026-01-01')},
        ],
      });
    });

    it('Should default a missing size to 0', async () => {
      const lastModified = faker.date.past();

      s3Service.send.mockResolvedValueOnce({
        Contents: [{Key: 'a', LastModified: lastModified}],
      });

      expect(await service.list(prefix)).toEqual({
        ok: true,
        objects: [{key: 'a', size: 0, lastModified}],
      });
    });

    it('Should skip entries without a key', async () => {
      s3Service.send.mockResolvedValueOnce({
        Contents: [{Size: 3, LastModified: faker.date.past()}],
      });

      expect(await service.list(prefix)).toEqual({ok: true, objects: []});
    });

    it('Should skip entries without a date', async () => {
      s3Service.send.mockResolvedValueOnce({Contents: [{Key: 'a', Size: 3}]});

      expect(await service.list(prefix)).toEqual({ok: true, objects: []});
    });

    it('Should treat a page without contents as empty', async () => {
      s3Service.send.mockResolvedValueOnce({});

      expect(await service.list(prefix)).toEqual({ok: true, objects: []});
    });

    it('Should return the error when S3 rejects', async () => {
      const error = new Error(faker.lorem.word());

      s3Service.send.mockRejectedValueOnce(error);

      expect(await service.list(prefix)).toEqual({ok: false, error});
    });

    it('Should return a generic error when S3 rejects with a non-Error', async () => {
      s3Service.send.mockRejectedValueOnce(faker.lorem.word());

      expect(await service.list(prefix)).toEqual({
        ok: false,
        error: new Error('Error listing S3 objects'),
      });
    });
  });
});
