import {faker} from '@faker-js/faker';

import {cliModule} from '../../../../../src/application/cli/cli-module';
import {JobLockService} from '../../../../../src/core/services/job/job-lock-service';
import {JobRunnerService} from '../../../../../src/core/services/job/job-runner-service';
import {JobOptions} from '../../../../../src/core/types/job';
import {JobContextService} from '../../../../../src/infrastructure/monitoring/services/job-context-service';
import {MonitoringService} from '../../../../../src/infrastructure/monitoring/services/monitoring-service';
import {
  createTestingModule,
  loggerService,
} from '../../../../__mocks__/create-testing-module';

describe('Given a job runner', () => {
  let runner: JobRunnerService;
  let jobContext: JobContextService;

  const lock = {acquire: vi.fn(() => true), release: vi.fn()};
  const monitoring = {
    captureError: vi.fn(),
    startCheckIn: vi.fn(),
    finishCheckIn: vi.fn(),
    log: vi.fn(),
    init: vi.fn(),
    onApplicationShutdown: vi.fn(),
  };
  const options: JobOptions = {
    command: 'psql-backup',
    job: 'backup',
    trigger: 'manual',
    lock: true,
  };
  const succeed = async () => ({ok: true as const});

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule)
      .overrideProvider(JobLockService)
      .useValue(lock)
      .overrideProvider(MonitoringService)
      .useValue(monitoring)
      .compile();

    runner = moduleRef.get(JobRunnerService);
    jobContext = moduleRef.get(JobContextService);
  });

  describe('Given a job that succeeds', () => {
    it('Should return ok', async () => {
      expect(await runner.run(options, succeed)).toBe('ok');
    });

    it('Should log the start of the job', async () => {
      await runner.run(options, succeed);

      expect(loggerService.log).toHaveBeenCalledWith('backup started');
    });

    it('Should log the end of the job', async () => {
      await runner.run(options, succeed);

      expect(loggerService.log).toHaveBeenCalledWith('backup finished');
    });

    it('Should not capture an error', async () => {
      await runner.run(options, succeed);

      expect(monitoring.captureError).not.toHaveBeenCalled();
    });

    it('Should expose the job attributes to the logs of the job', async () => {
      let seen: unknown;

      await runner.run(options, async () => {
        seen = jobContext.current();
        return {ok: true};
      });

      expect(seen).toEqual(
        expect.objectContaining({
          command: 'psql-backup',
          job: 'backup',
          trigger: 'manual',
        }),
      );
    });

    it('Should give every execution a job id', async () => {
      let seen: Record<string, string> | undefined;

      await runner.run(options, async () => {
        seen = jobContext.current();
        return {ok: true};
      });

      expect(seen?.['job.id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe('Given a job that fails', () => {
    it('Should return failed', async () => {
      expect(
        await runner.run(options, async () => ({
          ok: false,
          error: new Error(faker.lorem.word()),
        })),
      ).toBe('failed');
    });

    it('Should capture an unexpected failure', async () => {
      const error = new Error(faker.lorem.word());

      await runner.run(options, async () => ({ok: false, error}));

      expect(monitoring.captureError).toHaveBeenCalledWith(error);
    });

    it('Should not log the end of a failed job', async () => {
      await runner.run(options, async () => ({
        ok: false,
        error: new Error(faker.lorem.word()),
      }));

      expect(loggerService.log).not.toHaveBeenCalledWith('backup finished');
    });

    it('Should return failed for an expected refusal', async () => {
      expect(
        await runner.run(options, async () => ({
          ok: false,
          error: new Error(faker.lorem.sentence()),
          expected: true,
        })),
      ).toBe('failed');
    });

    it('Should not capture an expected refusal', async () => {
      await runner.run(options, async () => ({
        ok: false,
        error: new Error(faker.lorem.sentence()),
        expected: true,
      }));

      expect(monitoring.captureError).not.toHaveBeenCalled();
    });

    it('Should warn with the message of an expected refusal', async () => {
      const message = faker.lorem.sentence();

      await runner.run(options, async () => ({
        ok: false,
        error: new Error(message),
        expected: true,
      }));

      expect(loggerService.warn).toHaveBeenCalledWith(message);
    });

    it('Should not warn about an unexpected failure', async () => {
      await runner.run(options, async () => ({
        ok: false,
        error: new Error(faker.lorem.word()),
      }));

      expect(loggerService.warn).not.toHaveBeenCalled();
    });
  });

  describe('Given a job that throws', () => {
    it('Should return failed', async () => {
      expect(
        await runner.run(options, async () => {
          throw new Error(faker.lorem.word());
        }),
      ).toBe('failed');
    });

    it('Should log the message of a thrown error', async () => {
      const message = faker.lorem.sentence();

      await runner.run(options, async () => {
        throw new Error(message);
      });

      expect(loggerService.error).toHaveBeenCalledWith(message);
    });

    it('Should capture the thrown error', async () => {
      const error = new Error(faker.lorem.word());

      await runner.run(options, async () => {
        throw error;
      });

      expect(monitoring.captureError).toHaveBeenCalledWith(error);
    });

    it('Should wrap a thrown non-Error value in an Error', async () => {
      const value = faker.lorem.word();

      await runner.run(options, async () => {
        throw value;
      });

      expect(monitoring.captureError).toHaveBeenCalledWith(new Error(value));
    });

    it('Should release the lock after a thrown error', async () => {
      await runner.run(options, async () => {
        throw new Error(faker.lorem.word());
      });

      expect(lock.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('Given the lock', () => {
    it('Should skip when the lock is held', async () => {
      lock.acquire.mockReturnValueOnce(false);

      expect(await runner.run(options, succeed)).toBe('skipped');
    });

    it('Should not run the job when the lock is held', async () => {
      lock.acquire.mockReturnValueOnce(false);
      const job = vi.fn(succeed);

      await runner.run(options, job);

      expect(job).not.toHaveBeenCalled();
    });

    it('Should warn that a locked job was skipped', async () => {
      lock.acquire.mockReturnValueOnce(false);

      await runner.run(options, succeed);

      expect(loggerService.warn).toHaveBeenCalledWith(
        'backup skipped: another backup or rollup is running',
      );
    });

    it('Should not release a lock it did not acquire', async () => {
      lock.acquire.mockReturnValueOnce(false);

      await runner.run(options, succeed);

      expect(lock.release).not.toHaveBeenCalled();
    });

    it('Should release the lock after the job', async () => {
      await runner.run(options, succeed);

      expect(lock.release).toHaveBeenCalledTimes(1);
    });

    it('Should not acquire the lock when lock is false', async () => {
      await runner.run({...options, lock: false}, succeed);

      expect(lock.acquire).not.toHaveBeenCalled();
    });

    it('Should not release the lock when lock is false', async () => {
      await runner.run({...options, lock: false}, succeed);

      expect(lock.release).not.toHaveBeenCalled();
    });
  });

  describe('Given check-ins', () => {
    it('Should start a check-in for a monitored job', async () => {
      await runner.run({...options, monitored: true}, succeed);

      expect(monitoring.startCheckIn).toHaveBeenCalledTimes(1);
    });

    it('Should not start a check-in for an unmonitored job', async () => {
      await runner.run(options, succeed);

      expect(monitoring.startCheckIn).not.toHaveBeenCalled();
    });

    it('Should finish the check-in with the job result', async () => {
      const checkInId = faker.string.uuid();
      monitoring.startCheckIn.mockReturnValueOnce(checkInId);

      await runner.run({...options, monitored: true}, succeed);

      expect(monitoring.finishCheckIn).toHaveBeenCalledWith(checkInId, true);
    });

    it('Should finish the check-in as failed when the job fails', async () => {
      const checkInId = faker.string.uuid();
      monitoring.startCheckIn.mockReturnValueOnce(checkInId);

      await runner.run({...options, monitored: true}, async () => ({
        ok: false,
        error: new Error(faker.lorem.word()),
      }));

      expect(monitoring.finishCheckIn).toHaveBeenCalledWith(checkInId, false);
    });

    it('Should not check in a skipped job', async () => {
      lock.acquire.mockReturnValueOnce(false);

      await runner.run({...options, monitored: true}, succeed);

      expect(monitoring.startCheckIn).not.toHaveBeenCalled();
    });
  });
});
