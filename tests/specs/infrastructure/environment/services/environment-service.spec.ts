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
        host,
        port,
        name,
        user,
        password,
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
        host,
        port,
        name,
        user,
        password,
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
        host,
        port,
        name,
        user,
        password,
      });
    });

    it('Should throw when the resolved DB_URL is not a valid connection URL', async () => {
      ssmConfigService.getOrThrow.mockResolvedValueOnce(faker.string.alpha(12));

      await expect(service.database()).rejects.toThrow('Invalid DB_URL');
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
