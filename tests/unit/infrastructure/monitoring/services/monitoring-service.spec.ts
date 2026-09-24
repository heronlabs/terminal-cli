import {faker} from '@faker-js/faker';
import * as Sentry from '@sentry/node';

import {monitoringModule} from '../../../../../src/infrastructure/monitoring/monitoring-module';
import {JobContextService} from '../../../../../src/infrastructure/monitoring/services/job-context-service';
import {MonitoringService} from '../../../../../src/infrastructure/monitoring/services/monitoring-service';
import {
  configService,
  createTestingModule,
} from '../../../../__mocks__/create-testing-module';

const {setTags} = vi.hoisted(() => ({setTags: vi.fn()}));

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  logger: {info: vi.fn(), warn: vi.fn(), error: vi.fn()},
  captureException: vi.fn(),
  withScope: vi.fn((callback: (scope: {setTags: typeof setTags}) => void) =>
    callback({setTags}),
  ),
  captureCheckIn: vi.fn(),
  flush: vi.fn(),
}));
vi.mock('fs', () => ({
  readFileSync: vi.fn(() => JSON.stringify({version: '3.1.0'})),
}));

describe('Given a monitoring service', () => {
  let service: MonitoringService;
  let jobContext: JobContextService;

  const dsn = faker.internet.url();
  const slug = faker.lorem.slug();
  const attributes = {
    command: 'psql-backup',
    job: 'backup',
    'job.id': faker.string.uuid(),
    trigger: 'schedule',
  };

  const enable = () => {
    configService.get.mockImplementation(
      (key: string) =>
        ({SENTRY_DSN: dsn, SENTRY_MONITOR_SLUG: slug})[key] as
          | string
          | undefined,
    );
    service.init();
  };

  const enableWithoutSlug = () => {
    configService.get.mockImplementation((key: string) =>
      key === 'SENTRY_DSN' ? dsn : undefined,
    );
    service.init();
  };

  const initOptions = () => vi.mocked(Sentry.init).mock.calls[0]![0]!;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(monitoringModule).compile();

    service = moduleRef.get(MonitoringService);
    jobContext = moduleRef.get(JobContextService);
  });

  describe('Given init', () => {
    it('Should not initialise Sentry without a dsn', () => {
      service.init();

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('Should not initialise Sentry when SENTRY_DSN is empty', () => {
      configService.get.mockImplementation((key: string) =>
        key === 'SENTRY_DSN' ? '' : undefined,
      );

      service.init();

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('Should return false without a dsn', () => {
      expect(service.init()).toBe(false);
    });

    it('Should return true with a dsn', () => {
      configService.get.mockImplementation((key: string) =>
        key === 'SENTRY_DSN' ? dsn : undefined,
      );

      expect(service.init()).toBe(true);
    });

    it('Should initialise Sentry with the dsn, environment and release', () => {
      enable();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn,
          environment: 'production',
          release: 'terminal-cli@3.1.0',
          sendDefaultPii: false,
          enableLogs: true,
        }),
      );
    });

    it('Should scrub events before sending', () => {
      enable();

      expect(
        initOptions().beforeSend!(
          {message: 'postgres://u:p@h/db'} as never,
          {} as never,
        ),
      ).toEqual({message: 'postgres://[redacted]@h/db'});
    });

    it('Should scrub logs before sending', () => {
      enable();

      expect(
        initOptions().beforeSendLog!({level: 'info', message: 'MYSQL_PWD=x'}),
      ).toEqual({level: 'info', message: 'MYSQL_PWD=[redacted]'});
    });
  });

  describe('Given log', () => {
    it('Should not send logs when disabled', () => {
      service.log('info', faker.lorem.sentence());

      expect(Sentry.logger.info).not.toHaveBeenCalled();
    });

    it('Should send the message with the current job attributes', async () => {
      enable();
      const message = faker.lorem.sentence();

      await jobContext.run(attributes, async () =>
        service.log('warn', message),
      );

      expect(Sentry.logger.warn).toHaveBeenCalledWith(message, attributes);
    });
  });

  describe('Given captureError', () => {
    it('Should not capture when disabled', () => {
      service.captureError(new Error(faker.lorem.word()));

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('Should capture the error when enabled', () => {
      enable();
      const error = new Error(faker.lorem.word());

      service.captureError(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('Should tag the error with the current job attributes', async () => {
      enable();

      await jobContext.run(attributes, async () =>
        service.captureError(new Error(faker.lorem.word())),
      );

      expect(setTags).toHaveBeenCalledWith(attributes);
    });

    it('Should tag the error with nothing outside a job', () => {
      enable();

      service.captureError(new Error(faker.lorem.word()));

      expect(setTags).toHaveBeenCalledWith({});
    });
  });

  describe('Given check-ins', () => {
    it('Should not start a check-in without a monitor slug', () => {
      enableWithoutSlug();

      service.startCheckIn();

      expect(Sentry.captureCheckIn).not.toHaveBeenCalled();
    });

    it('Should not start a check-in when disabled', () => {
      configService.get.mockImplementation((key: string) =>
        key === 'SENTRY_MONITOR_SLUG' ? slug : undefined,
      );

      service.startCheckIn();

      expect(Sentry.captureCheckIn).not.toHaveBeenCalled();
    });

    it('Should return undefined when no check-in starts', () => {
      expect(service.startCheckIn()).toBeUndefined();
    });

    it('Should start an in_progress check-in with the backup schedule', () => {
      enable();

      service.startCheckIn();

      expect(Sentry.captureCheckIn).toHaveBeenCalledWith(
        {monitorSlug: slug, status: 'in_progress'},
        {
          schedule: {type: 'crontab', value: '0 */12 * * *'},
          checkinMargin: 5,
          maxRuntime: 60,
          timezone: 'UTC',
        },
      );
    });

    it('Should return the check-in id', () => {
      const checkInId = faker.string.uuid();
      enable();
      vi.mocked(Sentry.captureCheckIn).mockReturnValueOnce(checkInId);

      expect(service.startCheckIn()).toBe(checkInId);
    });

    it('Should finish the check-in as error when the job failed', () => {
      const checkInId = faker.string.uuid();
      enable();

      service.finishCheckIn(checkInId, false);

      expect(Sentry.captureCheckIn).toHaveBeenCalledWith(
        {checkInId, monitorSlug: slug, status: 'error'},
        expect.anything(),
      );
    });

    it('Should finish the check-in as ok when the job succeeded', () => {
      const checkInId = faker.string.uuid();
      enable();

      service.finishCheckIn(checkInId, true);

      expect(Sentry.captureCheckIn).toHaveBeenCalledWith(
        {checkInId, monitorSlug: slug, status: 'ok'},
        expect.anything(),
      );
    });

    it('Should not finish a check-in that never started', () => {
      enable();

      service.finishCheckIn(undefined, true);

      expect(Sentry.captureCheckIn).not.toHaveBeenCalled();
    });

    it('Should not finish a check-in without a monitor slug', () => {
      enableWithoutSlug();

      service.finishCheckIn(faker.string.uuid(), true);

      expect(Sentry.captureCheckIn).not.toHaveBeenCalled();
    });
  });

  describe('Given shutdown', () => {
    it('Should flush when enabled', async () => {
      enable();

      await service.onApplicationShutdown();

      expect(Sentry.flush).toHaveBeenCalledWith(2000);
    });

    it('Should not flush when disabled', async () => {
      await service.onApplicationShutdown();

      expect(Sentry.flush).not.toHaveBeenCalled();
    });
  });
});
