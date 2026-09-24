import {faker} from '@faker-js/faker';
import {readFileSync, writeFileSync} from 'fs';

import {cliModule} from '../../../src/application/cli/cli-module';
import {BackupsListCommand} from '../../../src/application/cli/commands/backups-list/backups-list-command';
import {BackupListService} from '../../../src/core/services/backup-list/backup-list-service';
import {JobRunnerService} from '../../../src/core/services/job/job-runner-service';
import {
  createTestingModule,
  loggerService,
} from '../../__mocks__/create-testing-module';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('Given a CLI command', () => {
  let command: BackupsListCommand;
  let jobRunner: JobRunnerService;
  let stdout: ReturnType<typeof vi.spyOn>;

  const backupList = {list: vi.fn()};
  const name = faker.string.alphanumeric(10);

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule)
      .overrideProvider(BackupListService)
      .useValue(backupList)
      .compile();

    command = moduleRef.get(BackupsListCommand);
    jobRunner = moduleRef.get(JobRunnerService);
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  describe('Given command backups-list', () => {
    it('Should print one line per backup with date, key and size in MB', async () => {
      backupList.list.mockResolvedValueOnce({
        ok: true,
        name: 'app',
        backups: [
          {
            key: 'app-2026-09-24T12-17-03Z.sql.gz',
            size: 43_830_067,
            lastModified: new Date('2026-09-24T12:17:03Z'),
          },
        ],
      });

      await command.run();

      expect(stdout).toHaveBeenCalledWith(
        '2026-09-24T12:17:03.000Z  app-2026-09-24T12-17-03Z.sql.gz  41.8 MB\n',
      );
    });

    it('Should print every backup', async () => {
      backupList.list.mockResolvedValueOnce({
        ok: true,
        name,
        backups: [
          {key: 'a', size: 1, lastModified: faker.date.past()},
          {key: 'b', size: 1, lastModified: faker.date.past()},
        ],
      });

      await command.run();

      expect(stdout).toHaveBeenCalledTimes(2);
    });

    it('Should say so when there are no backups', async () => {
      backupList.list.mockResolvedValueOnce({ok: true, name, backups: []});

      await command.run();

      expect(stdout).toHaveBeenCalledWith(`No backups found for ${name}\n`);
    });

    it('Should leave the exit code unset when listing succeeds', async () => {
      backupList.list.mockResolvedValueOnce({ok: true, name, backups: []});

      await command.run();

      expect(process.exitCode).toBeUndefined();
    });

    it('Should set exit code 1 when listing fails', async () => {
      backupList.list.mockResolvedValueOnce({
        ok: false,
        error: new Error(faker.lorem.sentence()),
      });

      await command.run();

      expect(process.exitCode).toBe(1);
    });

    it('Should log the listing error', async () => {
      const message = faker.lorem.sentence();

      backupList.list.mockResolvedValueOnce({
        ok: false,
        error: new Error(message),
      });

      await command.run();

      expect(loggerService.error).toHaveBeenCalledWith(message);
    });

    it('Should run as a manual backups-list job without the lock', async () => {
      const run = vi.spyOn(jobRunner, 'run');
      backupList.list.mockResolvedValueOnce({ok: true, name, backups: []});

      await command.run();

      expect(run).toHaveBeenCalledWith(
        {
          command: 'backups-list',
          job: 'backups-list',
          trigger: 'manual',
          lock: false,
        },
        expect.any(Function),
      );
    });

    it('Should list while another job holds the lock', async () => {
      vi.mocked(writeFileSync).mockImplementationOnce(() => {
        throw Object.assign(new Error('EEXIST'), {code: 'EEXIST'});
      });
      vi.mocked(readFileSync).mockReturnValueOnce(
        String(faker.number.int({min: 2, max: 99999})),
      );
      vi.spyOn(process, 'kill').mockReturnValueOnce(true);
      backupList.list.mockResolvedValueOnce({ok: true, name, backups: []});

      await command.run();

      expect(process.exitCode).toBeUndefined();
    });
  });
});
