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
    it('Should leave the dsn undefined when SENTRY_DSN is empty', () => {
      configService.get.mockImplementation((key: string) =>
        key === 'SENTRY_DSN' ? '' : undefined,
      );

      expect(service.monitoring.dsn).toBeUndefined();
    });

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

    it('Should read the environment from SENTRY_ENVIRONMENT', () => {
      const environment = faker.lorem.word();

      configService.get.mockImplementation((key: string) =>
        key === 'SENTRY_ENVIRONMENT' ? environment : undefined,
      );

      expect(service.monitoring.environment).toBe(environment);
    });

    it('Should leave the monitor slug undefined when SENTRY_MONITOR_SLUG is empty', () => {
      configService.get.mockImplementation((key: string) =>
        key === 'SENTRY_MONITOR_SLUG' ? '' : undefined,
      );

      expect(service.monitoring.monitorSlug).toBeUndefined();
    });

    it('Should read the monitor slug from SENTRY_MONITOR_SLUG', () => {
      const slug = faker.lorem.slug();

      configService.get.mockImplementation((key: string) =>
        key === 'SENTRY_MONITOR_SLUG' ? slug : undefined,
      );

      expect(service.monitoring.monitorSlug).toBe(slug);
    });

    it('Should default the max runtime to 60 minutes', () => {
      expect(service.monitoring.maxRuntimeMinutes).toBe(60);
    });

    it('Should read the max runtime from SENTRY_MONITOR_MAX_RUNTIME', () => {
      const minutes = faker.number.int({min: 1, max: 600});

      configService.get.mockImplementation((key: string) =>
        key === 'SENTRY_MONITOR_MAX_RUNTIME' ? String(minutes) : undefined,
      );

      expect(service.monitoring.maxRuntimeMinutes).toBe(minutes);
    });
  });

  describe('Given schedule', () => {
    it('Should read the engine from BACKUP_ENGINE', () => {
      configService.get.mockImplementation((key: string) =>
        key === 'BACKUP_ENGINE' ? 'psql' : undefined,
      );

      expect(service.schedule.engine).toBe('psql');
    });

    it('Should default the backup schedule to every 12 hours', () => {
      expect(service.schedule.backup).toBe('0 */12 * * *');
    });

    it('Should read the backup schedule from BACKUP_SCHEDULE', () => {
      configService.get.mockImplementation((key: string) =>
        key === 'BACKUP_SCHEDULE' ? '17 */12 * * *' : undefined,
      );

      expect(service.schedule.backup).toBe('17 */12 * * *');
    });

    it('Should back up on start by default', () => {
      expect(service.schedule.backupOnStart).toBe(true);
    });

    it('Should not back up on start when BACKUP_ON_START is false', () => {
      configService.get.mockImplementation((key: string) =>
        key === 'BACKUP_ON_START' ? 'false' : undefined,
      );

      expect(service.schedule.backupOnStart).toBe(false);
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
