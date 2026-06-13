import {faker} from '@faker-js/faker';

import {environmentModule} from '../../../../../src/infrastructure/environment/environment-module';
import {EnvironmentService} from '../../../../../src/infrastructure/environment/services/environment-service';
import {
  configService,
  createTestingModule,
  databaseUrl,
  ssmConfigService,
} from '../../../../__mocks__/create-testing-module';

describe('Given a service', () => {
  let service: EnvironmentService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(environmentModule).compile();

    service = moduleRef.get(EnvironmentService);
  });

  describe('Given database resolution', () => {
    it('Should resolve DB_URL through env-ssm getOrThrow', async () => {
      ssmConfigService.getOrThrow.mockResolvedValueOnce(databaseUrl);

      await service.database();

      expect(ssmConfigService.getOrThrow).toHaveBeenCalledWith('DB_URL');
    });

    it('Should parse the connection URL into the database connection parts', async () => {
      const host = faker.internet.domainName();
      const port = faker.number.int({min: 1024, max: 65535}).toString();
      const name = faker.string.alphanumeric(10);
      const user = faker.string.alphanumeric(10);
      const password = faker.string.alphanumeric(10);

      ssmConfigService.getOrThrow.mockResolvedValueOnce(
        `postgres://${user}:${password}@${host}:${port}/${name}`,
      );

      expect(await service.database()).toEqual({
        ok: true,
        connection: {host, port, name, user, password},
      });
    });

    it('Should parse a mysql connection URL into the database connection parts', async () => {
      const host = faker.internet.domainName();
      const port = faker.number.int({min: 1024, max: 65535}).toString();
      const name = faker.string.alphanumeric(10);
      const user = faker.string.alphanumeric(10);
      const password = faker.string.alphanumeric(10);

      ssmConfigService.getOrThrow.mockResolvedValueOnce(
        `mysql://${user}:${password}@${host}:${port}/${name}`,
      );

      expect(await service.database()).toEqual({
        ok: true,
        connection: {host, port, name, user, password},
      });
    });

    it('Should decode percent-encoded credentials in the connection URL', async () => {
      const host = faker.internet.domainName();
      const port = faker.number.int({min: 1024, max: 65535}).toString();
      const name = faker.string.alphanumeric(10);
      const user = `${faker.string.alpha(6)}@acme`;
      const password = `${faker.string.alpha(6)}:word`;

      ssmConfigService.getOrThrow.mockResolvedValueOnce(
        `postgres://${encodeURIComponent(user)}:${encodeURIComponent(
          password,
        )}@${host}:${port}/${name}`,
      );

      expect(await service.database()).toEqual({
        ok: true,
        connection: {host, port, name, user, password},
      });
    });

    it('Should return the original error when DB_URL cannot be resolved', async () => {
      const error = new Error(faker.lorem.sentence());

      ssmConfigService.getOrThrow.mockRejectedValueOnce(error);

      expect(await service.database()).toEqual({ok: false, error});
    });

    it('Should fail when the resolved DB_URL is not a valid connection URL', async () => {
      ssmConfigService.getOrThrow.mockResolvedValueOnce(faker.string.alpha(12));

      const result = await service.database();

      expect(result).toEqual({
        ok: false,
        error: new Error('Invalid DB_URL'),
      });
    });

    it('Should fail when the connection URL is missing the host', async () => {
      const name = faker.string.alphanumeric(10);

      ssmConfigService.getOrThrow.mockResolvedValueOnce(`postgres:///${name}`);

      const result = await service.database();

      expect(result).toEqual({
        ok: false,
        error: new Error('Invalid DB_URL: missing host, user'),
      });
    });

    it('Should fail when the connection URL is missing the name', async () => {
      const host = faker.internet.domainName();
      const port = faker.number.int({min: 1024, max: 65535}).toString();
      const user = faker.string.alphanumeric(10);
      const password = faker.string.alphanumeric(10);

      ssmConfigService.getOrThrow.mockResolvedValueOnce(
        `postgres://${user}:${password}@${host}:${port}/`,
      );

      const result = await service.database();

      expect(result).toEqual({
        ok: false,
        error: new Error('Invalid DB_URL: missing name'),
      });
    });

    it('Should fail when the connection URL is missing the user', async () => {
      const host = faker.internet.domainName();
      const port = faker.number.int({min: 1024, max: 65535}).toString();
      const name = faker.string.alphanumeric(10);

      ssmConfigService.getOrThrow.mockResolvedValueOnce(
        `postgres://${host}:${port}/${name}`,
      );

      const result = await service.database();

      expect(result).toEqual({
        ok: false,
        error: new Error('Invalid DB_URL: missing user'),
      });
    });

    it('Should list every missing field in host, name, user order', async () => {
      ssmConfigService.getOrThrow.mockResolvedValueOnce('postgres:///');

      const result = await service.database();

      expect(result).toEqual({
        ok: false,
        error: new Error('Invalid DB_URL: missing host, name, user'),
      });
    });
  });

  describe('Given storage resolution', () => {
    it('Should expose the storage settings as a deep-equal object', () => {
      const bucketName = faker.string.alpha();

      configService.getOrThrow.mockImplementation((key: string) =>
        key === 'AWS_S3_BUCKET_NAME' ? bucketName : key,
      );

      expect(service.storage).toEqual({bucketName});
    });
  });
});
