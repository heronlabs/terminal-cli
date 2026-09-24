import {faker} from '@faker-js/faker';
import {Cron} from 'croner';

import {cliModule} from '../../../../../src/application/cli/cli-module';
import {JobRunnerService} from '../../../../../src/core/services/job/job-runner-service';
import {MysqlBackupService} from '../../../../../src/core/services/mysql/mysql-backup-service';
import {PsqlBackupService} from '../../../../../src/core/services/psql/psql-backup-service';
import {BackupScheduleService} from '../../../../../src/core/services/schedule/backup-schedule-service';
import {
  configService,
  createTestingModule,
  loggerService,
} from '../../../../__mocks__/create-testing-module';

const {stopCron} = vi.hoisted(() => ({stopCron: vi.fn()}));

vi.mock('croner', () => ({
  Cron: vi.fn(
    class {
      stop = stopCron;
    },
  ),
}));

describe('Given a backup schedule', () => {
  let service: BackupScheduleService;
  let psqlBackup: PsqlBackupService;
  let mysqlBackup: MysqlBackupService;

  const jobRunner = {
    run: vi.fn<
      (options: unknown, fn: () => Promise<unknown>) => Promise<string>
    >(async () => 'ok'),
  };

  const configure = (values: Record<string, string>) => {
    configService.get.mockImplementation((key: string) => values[key]);
  };

  const psqlEngine = () => configure({BACKUP_ENGINE: 'psql'});

  const runJobs = () => {
    jobRunner.run.mockImplementation(
      async (_options: unknown, fn: () => Promise<unknown>) => {
        await fn();
        return 'ok';
      },
    );
  };

  const throwingCron = (message: string) => {
    vi.mocked(Cron).mockImplementationOnce(function () {
      throw new TypeError(message);
    } as never);
  };

  const scheduledTask = () =>
    vi.mocked(Cron).mock.calls[0]![2] as () => Promise<void>;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule)
      .overrideProvider(JobRunnerService)
      .useValue(jobRunner)
      .compile();

    service = moduleRef.get(BackupScheduleService);
    psqlBackup = moduleRef.get(PsqlBackupService);
    mysqlBackup = moduleRef.get(MysqlBackupService);
  });

  describe('Given the engine', () => {
    it('Should refuse to start without an engine', async () => {
      expect(await service.start()).toBe(false);
    });

    it('Should refuse to start with an unknown engine', async () => {
      configure({BACKUP_ENGINE: faker.lorem.word()});

      expect(await service.start()).toBe(false);
    });

    it('Should log why it refused an engine', async () => {
      configure({BACKUP_ENGINE: 'oracle'});

      await service.start();

      expect(loggerService.error).toHaveBeenCalledWith(
        'BACKUP_ENGINE must be psql or mysql',
      );
    });

    it('Should not schedule anything without a valid engine', async () => {
      await service.start();

      expect(Cron).not.toHaveBeenCalled();
    });

    it('Should back up with the psql service for the psql engine', async () => {
      psqlEngine();
      runJobs();
      const run = vi.spyOn(psqlBackup, 'run').mockResolvedValue({ok: true});

      await service.start();

      expect(run).toHaveBeenCalledWith(false);
    });

    it('Should back up with the mysql service for the mysql engine', async () => {
      configure({BACKUP_ENGINE: 'mysql'});
      runJobs();
      const run = vi.spyOn(mysqlBackup, 'run').mockResolvedValue({ok: true});

      await service.start();

      expect(run).toHaveBeenCalledWith(false);
    });
  });

  describe('Given the schedule', () => {
    it('Should refuse an invalid schedule', async () => {
      configure({BACKUP_ENGINE: 'psql', BACKUP_SCHEDULE: 'every day'});
      throwingCron('invalid pattern');

      expect(await service.start()).toBe(false);
    });

    it('Should log the invalid schedule', async () => {
      configure({BACKUP_ENGINE: 'psql', BACKUP_SCHEDULE: 'every day'});
      throwingCron('invalid pattern');

      await service.start();

      expect(loggerService.error).toHaveBeenCalledWith(
        'Invalid BACKUP_SCHEDULE "every day": invalid pattern',
      );
    });

    it('Should not back up when the schedule is invalid', async () => {
      configure({BACKUP_ENGINE: 'psql', BACKUP_SCHEDULE: 'every day'});
      throwingCron('invalid pattern');

      await service.start();

      expect(jobRunner.run).not.toHaveBeenCalled();
    });

    it('Should start with a valid engine and schedule', async () => {
      psqlEngine();

      expect(await service.start()).toBe(true);
    });

    it('Should schedule with the configured pattern in UTC without overlap', async () => {
      psqlEngine();

      await service.start();

      expect(Cron).toHaveBeenCalledWith(
        '0 */12 * * *',
        {timezone: 'UTC', protect: true},
        expect.any(Function),
      );
    });

    it('Should back up on every tick of the schedule', async () => {
      configure({BACKUP_ENGINE: 'psql', BACKUP_ON_START: 'false'});
      await service.start();

      await scheduledTask()();

      expect(jobRunner.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('Given a backup', () => {
    it('Should back up on start by default', async () => {
      psqlEngine();

      await service.start();

      expect(jobRunner.run).toHaveBeenCalledTimes(1);
    });

    it('Should not back up on start when disabled', async () => {
      configure({BACKUP_ENGINE: 'psql', BACKUP_ON_START: 'false'});

      await service.start();

      expect(jobRunner.run).not.toHaveBeenCalled();
    });

    it('Should run the scheduled backup as a monitored, locked schedule job', async () => {
      psqlEngine();

      await service.start();

      expect(jobRunner.run).toHaveBeenCalledWith(
        {
          command: 'run',
          job: 'backup',
          trigger: 'schedule',
          lock: true,
          monitored: true,
        },
        expect.any(Function),
      );
    });
  });

  describe('Given stop', () => {
    it('Should stop the cron', async () => {
      psqlEngine();
      await service.start();

      await service.stop();

      expect(stopCron).toHaveBeenCalledTimes(1);
    });

    it('Should stop cleanly when it never started', async () => {
      await expect(service.stop()).resolves.toBeUndefined();
    });

    it('Should wait for the backup in flight before stopping', async () => {
      psqlEngine();
      const order: string[] = [];
      let finish = () => {};
      jobRunner.run.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finish = () => resolve('ok');
          }),
      );

      const started = service.start();
      const stopped = service.stop().then(() => order.push('stopped'));
      await new Promise(setImmediate);
      order.push('finished');
      finish();
      await Promise.all([started, stopped]);

      expect(order).toEqual(['finished', 'stopped']);
    });
  });
});
