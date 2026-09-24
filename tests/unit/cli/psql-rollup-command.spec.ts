import {faker} from '@faker-js/faker';
import {execSync} from 'child_process';
import {readFileSync, writeFileSync} from 'fs';
import {pipeline} from 'stream/promises';

import {cliModule} from '../../../src/application/cli/cli-module';
import {PsqlRollupCommand} from '../../../src/application/cli/commands/rollup/psql-rollup-command';
import {RollupOptionsKeys} from '../../../src/application/cli/commands/rollup/types/rollup-options';
import {JobRunnerService} from '../../../src/core/services/job/job-runner-service';
import {PsqlRollupService} from '../../../src/core/services/psql/psql-rollup-service';
import {
  createTestingModule,
  loggerService,
  s3Service,
} from '../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  createWriteStream: vi.fn(),
  rmSync: vi.fn(),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn(),
}));
vi.mock('stream/promises', () => ({pipeline: vi.fn()}));
describe('Given a CLI command', () => {
  let command: PsqlRollupCommand;
  let jobRunner: JobRunnerService;
  let rollupService: PsqlRollupService;

  const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule).compile();
    command = moduleRef.get(PsqlRollupCommand);
    jobRunner = moduleRef.get(JobRunnerService);
    rollupService = moduleRef.get(PsqlRollupService);
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  describe('Given command psql-rollup', () => {
    it('Should run the psql rollup command without logging an error', async () => {
      s3Service.send.mockResolvedValueOnce({Body: {}});

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {
        [RollupOptionsKeys.FILENAME]: filename,
        [RollupOptionsKeys.FORCE]: true,
      });

      expect(loggerService.error).toHaveBeenCalledTimes(0);
    });

    it('Should leave the exit code unset when the rollup succeeds', async () => {
      s3Service.send.mockResolvedValueOnce({Body: {}});

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {
        [RollupOptionsKeys.FILENAME]: filename,
        [RollupOptionsKeys.FORCE]: true,
      });

      expect(process.exitCode).toBeUndefined();
    });

    it('Should log error when s3Service throws', async () => {
      const message = faker.lorem.words();

      s3Service.send.mockRejectedValueOnce(new Error(message));

      await command.run([], {
        [RollupOptionsKeys.FILENAME]: filename,
        [RollupOptionsKeys.FORCE]: true,
      });

      expect(loggerService.error).toHaveBeenCalledWith(message);
    });

    it('Should set exit code 1 when the download fails', async () => {
      s3Service.send.mockRejectedValueOnce(new Error(faker.lorem.words()));

      await command.run([], {
        [RollupOptionsKeys.FILENAME]: filename,
        [RollupOptionsKeys.FORCE]: true,
      });

      expect(process.exitCode).toBe(1);
    });

    it('Should log error when writing the download to disk fails', async () => {
      s3Service.send.mockResolvedValueOnce({Body: {}});

      const message = faker.lorem.words();

      vi.mocked(pipeline).mockRejectedValueOnce(new Error(message));

      await command.run([], {
        [RollupOptionsKeys.FILENAME]: filename,
        [RollupOptionsKeys.FORCE]: true,
      });

      expect(loggerService.error).toHaveBeenCalledWith(message);
    });

    it('Should log error when execSync throws', async () => {
      s3Service.send.mockResolvedValueOnce({Body: {}});

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('psql restore failed');
      });

      await command.run([], {
        [RollupOptionsKeys.FILENAME]: filename,
        [RollupOptionsKeys.FORCE]: true,
      });

      expect(loggerService.error).toHaveBeenCalledWith('psql restore failed');
    });

    it('Should set exit code 1 when the restore fails', async () => {
      s3Service.send.mockResolvedValueOnce({Body: {}});

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('psql restore failed');
      });

      await command.run([], {
        [RollupOptionsKeys.FILENAME]: filename,
        [RollupOptionsKeys.FORCE]: true,
      });

      expect(process.exitCode).toBe(1);
    });

    it('Should log generic error when s3Service throws a non-Error during download', async () => {
      s3Service.send.mockImplementationOnce(() => {
        throw faker.lorem.word();
      });

      await command.run([], {
        [RollupOptionsKeys.FILENAME]: filename,
        [RollupOptionsKeys.FORCE]: true,
      });

      expect(loggerService.error).toHaveBeenCalledWith(
        'Error downloading file from S3',
      );
    });

    it('Should return the value passed when parsing filename option', () => {
      const value = `${faker.string.alphanumeric(10)}.sql.gz`;

      expect(command.parseFilename(value)).toBe(value);
    });

    it('Should skip S3 download when --local flag is passed', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {
        [RollupOptionsKeys.FILENAME]: filename,
        [RollupOptionsKeys.LOCAL]: true,
        [RollupOptionsKeys.FORCE]: true,
      });

      expect(loggerService.error).toHaveBeenCalledTimes(0);
    });

    it('Should return true when parsing local option', () => {
      expect(command.parseLocal()).toBeTruthy();
    });

    it('Should set exit code 1 when another job holds the lock', async () => {
      vi.mocked(writeFileSync).mockImplementationOnce(() => {
        throw Object.assign(new Error('EEXIST'), {code: 'EEXIST'});
      });
      vi.mocked(readFileSync).mockReturnValueOnce(
        String(faker.number.int({min: 2, max: 99999})),
      );
      vi.spyOn(process, 'kill').mockReturnValueOnce(true);

      await command.run([], {
        [RollupOptionsKeys.FILENAME]: filename,
        [RollupOptionsKeys.FORCE]: true,
      });

      expect(process.exitCode).toBe(1);
    });

    it('Should set exit code 1 when the database is not empty', async () => {
      vi.mocked(execSync).mockReturnValueOnce('5\n');

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(process.exitCode).toBe(1);
    });

    it('Should warn why a non-empty database was refused', async () => {
      vi.mocked(execSync).mockReturnValueOnce('5\n');

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.warn).toHaveBeenCalledWith(
        'Target database is not empty (5 tables). Restore into an empty database or pass --force',
      );
    });

    it('Should pass latest to the service', async () => {
      const run = vi
        .spyOn(rollupService, 'run')
        .mockResolvedValueOnce({ok: true});

      await command.run([], {[RollupOptionsKeys.LATEST]: true});

      expect(run).toHaveBeenCalledWith({
        filename: undefined,
        latest: true,
        local: false,
        force: false,
      });
    });

    it('Should pass force to the service', async () => {
      const run = vi
        .spyOn(rollupService, 'run')
        .mockResolvedValueOnce({ok: true});

      await command.run([], {
        [RollupOptionsKeys.FILENAME]: filename,
        [RollupOptionsKeys.LOCAL]: true,
        [RollupOptionsKeys.FORCE]: true,
      });

      expect(run).toHaveBeenCalledWith({
        filename,
        latest: false,
        local: true,
        force: true,
      });
    });

    it('Should default every flag to false', async () => {
      const run = vi
        .spyOn(rollupService, 'run')
        .mockResolvedValueOnce({ok: true});

      await command.run([], {});

      expect(run).toHaveBeenCalledWith({
        filename: undefined,
        latest: false,
        local: false,
        force: false,
      });
    });

    it('Should return true when parsing latest option', () => {
      expect(command.parseLatest()).toBe(true);
    });

    it('Should return true when parsing force option', () => {
      expect(command.parseForce()).toBe(true);
    });

    it('Should run as a manual, locked rollup job', async () => {
      const run = vi.spyOn(jobRunner, 'run');
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {
        [RollupOptionsKeys.FILENAME]: filename,
        [RollupOptionsKeys.FORCE]: true,
      });

      expect(run).toHaveBeenCalledWith(
        {command: 'psql-rollup', job: 'rollup', trigger: 'manual', lock: true},
        expect.any(Function),
      );
    });
  });
});
