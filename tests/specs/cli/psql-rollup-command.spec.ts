import {faker} from '@faker-js/faker';
import {ParameterFactory} from '@heronlabs/env-ssm';
import {execSync} from 'child_process';
import {writeFileSync} from 'fs';

import {cliModule} from '../../../src/application/cli/cli-module';
import {PsqlRollupCommand} from '../../../src/application/cli/commands/rollup/psql-rollup-command';
import {RollupOptionsKeys} from '../../../src/application/cli/commands/rollup/types/rollup-options';
import {
  createTestingModule,
  loggerService,
  s3Service,
  ssmGetOrThrow,
} from '../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({writeFileSync: vi.fn(), unlinkSync: vi.fn()}));
vi.mock('@heronlabs/env-ssm', () => ({ParameterFactory: {make: vi.fn()}}));

describe('Given a CLI command', () => {
  let command: PsqlRollupCommand;

  const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

  beforeEach(async () => {
    vi.mocked(ParameterFactory.make).mockResolvedValue({
      getOrThrow: ssmGetOrThrow,
    } as never);

    const moduleRef = await createTestingModule(cliModule).compile();
    await moduleRef.init();
    command = moduleRef.get(PsqlRollupCommand);
  });

  describe('Given command psql-rollup', () => {
    it('Should run the psql rollup command without logging an error', async () => {
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
      s3Service.send.mockRejectedValueOnce(new Error('s3 error'));

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.error).toHaveBeenCalledWith('s3 error');
    });

    it('Should log error when writeFileSync throws', async () => {
      s3Service.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(new Uint8Array()),
        },
      });

      vi.mocked(writeFileSync).mockImplementationOnce(() => {
        throw new Error('write failed');
      });

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.error).toHaveBeenCalledWith('write failed');
    });

    it('Should log error when execSync throws', async () => {
      s3Service.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(new Uint8Array()),
        },
      });

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('psql restore failed');
      });

      await command.run([], {[RollupOptionsKeys.FILENAME]: filename});

      expect(loggerService.error).toHaveBeenCalledWith('psql restore failed');
    });

    it('Should log generic error when s3Service throws a non-Error during download', async () => {
      s3Service.send.mockImplementationOnce(() => {
        throw 'download error';
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
