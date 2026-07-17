import {faker} from '@faker-js/faker';
import {readFileSync, writeFileSync} from 'fs';

import {S3StorageService} from '../../../../../src/infrastructure/storage/services/s3-storage-service';
import {storageModule} from '../../../../../src/infrastructure/storage/storage-module';
import {
  createTestingModule,
  loggerService,
  s3Service,
} from '../../../../__mocks__/create-testing-module';

vi.mock('fs', () => ({readFileSync: vi.fn(), writeFileSync: vi.fn()}));

describe('Given a service', () => {
  let service: S3StorageService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(storageModule).compile();
    service = moduleRef.get(S3StorageService);
  });

  describe('Given upload', () => {
    it('Should send a PutObjectCommand with the exact bucket key body and content type', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;
      const body = Buffer.from(faker.string.alphanumeric(10));

      vi.mocked(readFileSync).mockReturnValueOnce(body);
      s3Service.send.mockResolvedValueOnce({});

      await service.upload(filePath);

      expect(s3Service.send).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          input: {
            Bucket: 'AWS_S3_BUCKET_NAME',
            Key: filePath,
            Body: body,
            ContentType: 'application/octet-stream',
          },
        }),
      );
    });

    it('Should use the explicit key when provided instead of the file path', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;
      const key = `${faker.string.alphanumeric(10)}-explicit.sql.gz`;
      const body = Buffer.from(faker.string.alphanumeric(10));

      vi.mocked(readFileSync).mockReturnValueOnce(body);
      s3Service.send.mockResolvedValueOnce({});

      await service.upload(filePath, key);

      expect(s3Service.send).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          input: expect.objectContaining({Key: key}),
        }),
      );
    });

    it('Should log the exact upload success message', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(readFileSync).mockReturnValueOnce(
        Buffer.from(faker.string.alphanumeric(10)),
      );
      s3Service.send.mockResolvedValueOnce({});

      await service.upload(filePath);

      expect(loggerService.log).toHaveBeenCalledWith('Uploaded file to S3');
    });

    it('Should return ok true when upload succeeds', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(readFileSync).mockReturnValueOnce(
        Buffer.from(faker.string.alphanumeric(10)),
      );
      s3Service.send.mockResolvedValueOnce({});

      const result = await service.upload(filePath);

      expect(result).toEqual({ok: true});
    });

    it('Should return ok false with the original error when send rejects with an Error', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;
      const error = new Error(faker.lorem.words());

      vi.mocked(readFileSync).mockReturnValueOnce(
        Buffer.from(faker.string.alphanumeric(10)),
      );
      s3Service.send.mockRejectedValueOnce(error);

      const result = await service.upload(filePath);

      expect(result).toEqual({ok: false, error});
    });

    it('Should return ok false with generic upload error when thrown value is not an Error', async () => {
      const filePath = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(readFileSync).mockReturnValueOnce(
        Buffer.from(faker.string.alphanumeric(10)),
      );
      s3Service.send.mockImplementationOnce(() => {
        throw faker.lorem.word();
      });

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

      s3Service.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(new Uint8Array()),
        },
      });

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

      s3Service.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(new Uint8Array()),
        },
      });

      await service.download(key);

      expect(loggerService.log).toHaveBeenCalledWith('Downloaded file from S3');
    });

    it('Should return ok true when download succeeds', async () => {
      const key = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(new Uint8Array()),
        },
      });

      const result = await service.download(key);

      expect(result).toEqual({ok: true});
    });

    it('Should write the downloaded bytes to disk under the same key', async () => {
      const key = `${faker.string.alphanumeric(10)}.sql.gz`;
      const bytes = new Uint8Array([1, 2, 3]);

      s3Service.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(bytes),
        },
      });

      await service.download(key);

      expect(writeFileSync).toHaveBeenCalledWith(key, bytes);
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
