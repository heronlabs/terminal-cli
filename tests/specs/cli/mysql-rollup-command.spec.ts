import {faker} from '@faker-js/faker';
import {execSync} from 'child_process';
import {writeFileSync} from 'fs';

import {cliModule} from '../../../src/application/cli/cli-module';
import {MysqlRollupCommand} from '../../../src/application/cli/commands/rollup/mysql-rollup-command';
import {RollupOptionsKeys} from '../../../src/application/cli/commands/rollup/types/rollup-options';
import {ScriptLoaderService} from '../../../src/core/services/script-loader-service';
import {
  createTestingModule,
  loggerService,
  s3Service,
} from '../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({writeFileSync: vi.fn(), unlinkSync: vi.fn()}));
describe('Given a CLI command', () => {
  let command: MysqlRollupCommand;

  const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

  const scriptLoader = {load: vi.fn(() => 'loaded-script')};

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule)
      .overrideProvider(ScriptLoaderService)
      .useValue(scriptLoader)
      .compile();
    command = moduleRef.get(MysqlRollupCommand);
  });

  describe('Given command mysql-rollup', () => {
    it('Should run the mysql rollup command without logging an error', async () => {
      s3Service.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(new Uint8Array()),
        },
      });

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.error).toHaveBeenCalledTimes(0);
    });

    it('Should log error when s3Service throws', async () => {
      const message = faker.lorem.words();

      s3Service.send.mockRejectedValueOnce(new Error(message));

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.error).toHaveBeenCalledWith(message);
    });

    it('Should log error when writeFileSync throws', async () => {
      s3Service.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(new Uint8Array()),
        },
      });

      const message = faker.lorem.words();

      vi.mocked(writeFileSync).mockImplementationOnce(() => {
        throw new Error(message);
      });

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.error).toHaveBeenCalledWith(message);
    });

    it('Should log error when execSync throws', async () => {
      s3Service.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(new Uint8Array()),
        },
      });

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('mariadb restore failed');
      });

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.error).toHaveBeenCalledWith(
        'mariadb restore failed',
      );
    });

    it('Should log generic error when s3Service throws a non-Error during download', async () => {
      s3Service.send.mockImplementationOnce(() => {
        throw faker.lorem.word();
      });

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

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
      });

      expect(loggerService.error).toHaveBeenCalledTimes(0);
    });

    it('Should return true when parsing local option', () => {
      expect(command.parseLocal()).toBeTruthy();
    });
  });
});
