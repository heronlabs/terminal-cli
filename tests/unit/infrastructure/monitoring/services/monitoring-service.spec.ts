import {faker} from '@faker-js/faker';
import * as Sentry from '@sentry/node';

import {monitoringModule} from '../../../../../src/infrastructure/monitoring/monitoring-module';
import {MonitoringService} from '../../../../../src/infrastructure/monitoring/services/monitoring-service';
import {
  configService,
  createTestingModule,
} from '../../../../__mocks__/create-testing-module';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(),
}));
vi.mock('fs', () => ({
  readFileSync: vi.fn(() => JSON.stringify({version: '3.1.0'})),
}));

describe('Given a monitoring service', () => {
  let service: MonitoringService;

  const dsn = faker.internet.url();

  const enable = () => {
    configService.get.mockImplementation((key: string) =>
      key === 'SENTRY_DSN' ? dsn : undefined,
    );
    service.init();
  };

  beforeEach(async () => {
    const moduleRef = await createTestingModule(monitoringModule).compile();

    service = moduleRef.get(MonitoringService);
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

    it('Should initialise Sentry with the dsn, environment and release', () => {
      enable();

      expect(Sentry.init).toHaveBeenCalledWith({
        dsn,
        environment: 'production',
        release: 'terminal-cli@3.1.0',
        sendDefaultPii: false,
      });
    });
  });

  describe('Given captureError', () => {
    it('Should not capture when disabled', () => {
      service.captureError(new Error(faker.lorem.word()));

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('Should capture the error when enabled', () => {
      const error = new Error(faker.lorem.word());
      enable();

      service.captureError(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
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
