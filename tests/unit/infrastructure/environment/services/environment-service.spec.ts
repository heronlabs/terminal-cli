import {faker} from '@faker-js/faker';
import {readFileSync} from 'fs';
import {join} from 'path';

import {environmentModule} from '../../../../../src/infrastructure/environment/environment-module';
import {EnvironmentService} from '../../../../../src/infrastructure/environment/services/environment-service';
import {
  configService,
  createTestingModule,
  databaseConnection,
} from '../../../../__mocks__/create-testing-module';

vi.mock('fs', () => ({readFileSync: vi.fn()}));

describe('Given a service', () => {
  let service: EnvironmentService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(environmentModule).compile();

    service = moduleRef.get(EnvironmentService);
  });

  describe('Given database resolution', () => {
    it('Should delegate to the database URL parser', async () => {
      expect(await service.database()).toEqual({
        ok: true,
        connection: databaseConnection,
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

  describe('Given monitoring', () => {
    it('Should read the dsn from SENTRY_DSN', () => {
      const dsn = faker.internet.url();

      configService.get.mockImplementation((key: string) =>
        key === 'SENTRY_DSN' ? dsn : undefined,
      );

      expect(service.monitoring.dsn).toBe(dsn);
    });

    it('Should default the environment to production', () => {
      expect(service.monitoring.environment).toBe('production');
    });

    it('Should default the environment to production when SENTRY_ENVIRONMENT is empty', () => {
      configService.get.mockImplementation((key: string) =>
        key === 'SENTRY_ENVIRONMENT' ? '' : undefined,
      );

      expect(service.monitoring.environment).toBe('production');
    });

    it('Should read the environment from SENTRY_ENVIRONMENT', () => {
      const environment = faker.lorem.word();

      configService.get.mockImplementation((key: string) =>
        key === 'SENTRY_ENVIRONMENT' ? environment : undefined,
      );

      expect(service.monitoring.environment).toBe(environment);
    });
  });

  describe('Given release', () => {
    it('Should prefix the package version with terminal-cli@', () => {
      const version = faker.system.semver();

      vi.mocked(readFileSync).mockReturnValueOnce(JSON.stringify({version}));

      expect(service.release).toBe(`terminal-cli@${version}`);
    });

    it('Should read package.json five levels above the service as utf-8', () => {
      vi.mocked(readFileSync).mockReturnValueOnce(
        JSON.stringify({version: faker.system.semver()}),
      );

      void service.release;

      expect(readFileSync).toHaveBeenCalledWith(
        join(
          process.cwd(),
          'src/infrastructure/environment/services',
          '../../../../../package.json',
        ),
        'utf-8',
      );
    });
  });
});
