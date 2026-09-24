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
});
