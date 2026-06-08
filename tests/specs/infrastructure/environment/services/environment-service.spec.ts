import {faker} from '@faker-js/faker';

import {environmentModule} from '../../../../../src/infrastructure/environment/environment-module';
import {EnvironmentService} from '../../../../../src/infrastructure/environment/services/environment-service';
import {
  configService,
  createTestingModule,
  ssmGetOrThrow,
} from '../../../../__mocks__/create-testing-module';

describe('Given a service', () => {
  let service: EnvironmentService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(environmentModule).compile();

    service = moduleRef.get(EnvironmentService);
  });

  describe('Given database resolution', () => {
    it('Should resolve DB_URL through env-ssm getOrThrow', async () => {
      ssmGetOrThrow.mockResolvedValueOnce(
        'postgres://user:pass@host:5432/dbname',
      );

      await service.database();

      expect(ssmGetOrThrow).toHaveBeenCalledWith('DB_URL');
    });

    it('Should parse the connection URL into the database connection parts', async () => {
      ssmGetOrThrow.mockResolvedValueOnce(
        'postgres://alice:s3cret@db.internal:6543/analytics',
      );

      expect(await service.database()).toEqual({
        host: 'db.internal',
        port: '6543',
        name: 'analytics',
        user: 'alice',
        password: 's3cret',
      });
    });

    it('Should parse a mysql connection URL into the database connection parts', async () => {
      ssmGetOrThrow.mockResolvedValueOnce(
        'mysql://bob:hunter2@mysql.host:3306/store',
      );

      expect(await service.database()).toEqual({
        host: 'mysql.host',
        port: '3306',
        name: 'store',
        user: 'bob',
        password: 'hunter2',
      });
    });

    it('Should decode percent-encoded credentials in the connection URL', async () => {
      ssmGetOrThrow.mockResolvedValueOnce(
        'postgres://user%40acme:p%40ss%3Aword@host:5432/dbname',
      );

      expect(await service.database()).toEqual({
        host: 'host',
        port: '5432',
        name: 'dbname',
        user: 'user@acme',
        password: 'p@ss:word',
      });
    });

    it('Should throw when the resolved DB_URL is not a valid connection URL', async () => {
      ssmGetOrThrow.mockResolvedValueOnce('not-a-valid-url');

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
