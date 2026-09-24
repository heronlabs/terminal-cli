import {faker} from '@faker-js/faker';

import {BridgeLoggerService} from '../../../../../src/infrastructure/log/services/bridge-logger-service';

describe('Given a bridge logger', () => {
  const pino = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  };
  const monitoring = {log: vi.fn()};
  const logger = new BridgeLoggerService(pino as never, monitoring as never);

  describe('Given log', () => {
    it('Should write info lines to pino', () => {
      const message = faker.lorem.sentence();
      const context = faker.lorem.word();

      logger.log(message, context);

      expect(pino.log).toHaveBeenCalledWith(message, context);
    });

    it('Should send info lines to Sentry', () => {
      const message = faker.lorem.sentence();

      logger.log(message);

      expect(monitoring.log).toHaveBeenCalledWith('info', message);
    });
  });

  describe('Given warn', () => {
    it('Should write warn lines to pino', () => {
      const message = faker.lorem.sentence();
      const context = faker.lorem.word();

      logger.warn(message, context);

      expect(pino.warn).toHaveBeenCalledWith(message, context);
    });

    it('Should send warn lines to Sentry as warn', () => {
      const message = faker.lorem.sentence();

      logger.warn(message);

      expect(monitoring.log).toHaveBeenCalledWith('warn', message);
    });
  });

  describe('Given error', () => {
    it('Should write error lines to pino', () => {
      const message = faker.lorem.sentence();
      const context = faker.lorem.word();

      logger.error(message, context);

      expect(pino.error).toHaveBeenCalledWith(message, context);
    });

    it('Should send error lines to Sentry as error', () => {
      const message = faker.lorem.sentence();

      logger.error(message);

      expect(monitoring.log).toHaveBeenCalledWith('error', message);
    });

    it('Should send a non-string message to Sentry as text', () => {
      const code = faker.number.int();

      logger.error(code);

      expect(monitoring.log).toHaveBeenCalledWith('error', String(code));
    });
  });

  describe('Given debug', () => {
    it('Should write debug lines to pino', () => {
      const message = faker.lorem.sentence();
      const context = faker.lorem.word();

      logger.debug(message, context);

      expect(pino.debug).toHaveBeenCalledWith(message, context);
    });

    it('Should keep debug lines out of Sentry', () => {
      logger.debug(faker.lorem.sentence());

      expect(monitoring.log).not.toHaveBeenCalled();
    });
  });

  describe('Given verbose', () => {
    it('Should write verbose lines to pino', () => {
      const message = faker.lorem.sentence();
      const context = faker.lorem.word();

      logger.verbose(message, context);

      expect(pino.verbose).toHaveBeenCalledWith(message, context);
    });

    it('Should keep verbose lines out of Sentry', () => {
      logger.verbose(faker.lorem.sentence());

      expect(monitoring.log).not.toHaveBeenCalled();
    });
  });
});
