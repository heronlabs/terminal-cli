import {faker} from '@faker-js/faker';
import {execSync} from 'child_process';
import {pipeline} from 'stream/promises';

import {cliModule} from '../../../src/application/cli/cli-module';
import {MysqlRollupCommand} from '../../../src/application/cli/commands/rollup/mysql-rollup-command';
import {RollupOptionsKeys} from '../../../src/application/cli/commands/rollup/types/rollup-options';
import {
  createTestingModule,
  loggerService,
  s3Service,
} from '../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({
  createWriteStream: vi.fn(),
  rmSync: vi.fn(),
  unlinkSync: vi.fn(),
}));
vi.mock('stream/promises', () => ({pipeline: vi.fn()}));
describe('Given a CLI command', () => {
  let command: MysqlRollupCommand;

  const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule).compile();
    command = moduleRef.get(MysqlRollupCommand);
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  describe('Given command mysql-rollup', () => {
    it('Should run the mysql rollup command without logging an error', async () => {
      s3Service.send.mockResolvedValueOnce({Body: {}});

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.error).toHaveBeenCalledTimes(0);
    });

    it('Should leave the exit code unset when the rollup succeeds', async () => {
      s3Service.send.mockResolvedValueOnce({Body: {}});

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(process.exitCode).toBeUndefined();
    });

    it('Should log error when s3Service throws', async () => {
      const message = faker.lorem.words();

      s3Service.send.mockRejectedValueOnce(new Error(message));

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.error).toHaveBeenCalledWith(new Error(message));
    });

    it('Should set exit code 1 when the download fails', async () => {
      s3Service.send.mockRejectedValueOnce(new Error(faker.lorem.words()));

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(process.exitCode).toBe(1);
    });

    it('Should log error when writing the download to disk fails', async () => {
      s3Service.send.mockResolvedValueOnce({Body: {}});

      const message = faker.lorem.words();

      vi.mocked(pipeline).mockRejectedValueOnce(new Error(message));

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.error).toHaveBeenCalledWith(new Error(message));
    });

    it('Should log error when execSync throws', async () => {
      s3Service.send.mockResolvedValueOnce({Body: {}});

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('mariadb restore failed');
      });

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.error).toHaveBeenCalledWith(
        new Error('mariadb restore failed'),
      );
    });

    it('Should set exit code 1 when the restore fails', async () => {
      s3Service.send.mockResolvedValueOnce({Body: {}});

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('mariadb restore failed');
      });

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(process.exitCode).toBe(1);
    });

    it('Should log generic error when s3Service throws a non-Error during download', async () => {
      s3Service.send.mockImplementationOnce(() => {
        throw faker.lorem.word();
      });

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.error).toHaveBeenCalledWith(
        new Error('Error downloading file from S3'),
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
      });

      expect(loggerService.error).toHaveBeenCalledTimes(0);
    });

    it('Should return true when parsing local option', () => {
      expect(command.parseLocal()).toBeTruthy();
    });
  });
});
