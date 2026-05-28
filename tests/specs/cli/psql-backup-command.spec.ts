import {faker} from '@faker-js/faker';
import {execSync} from 'child_process';
import {readFileSync} from 'fs';

import {cliModule} from '../../../src/application/cli/cli-module';
import {PsqlBackupCommand} from '../../../src/application/cli/commands/backup/psql-backup-command';
import {BackupOptionsKeys} from '../../../src/application/cli/commands/backup/types/backup-options';
import {
  createTestingModule,
  loggerService,
  s3Service,
} from '../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({readFileSync: vi.fn(), unlinkSync: vi.fn()}));

describe('Given a CLI command', () => {
  let command: PsqlBackupCommand;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule).compile();
    command = moduleRef.get(PsqlBackupCommand);
  });

  describe('Given command psql-backup', () => {
    it('Should run the psql backup command without logging an error', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      vi.mocked(readFileSync).mockReturnValueOnce(
        Buffer.from(faker.string.alphanumeric(10)),
      );

      vi.spyOn(s3Service, 'send').mockImplementationOnce(vi.fn());

      await command.run();

      expect(loggerService.error).toHaveBeenCalledTimes(0);
    });

    it('Should log error when execSync throws', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('pg_dump failed');
      });

      await command.run();

      expect(loggerService.error).toHaveBeenCalledWith('pg_dump failed');
    });

    it('Should log error when readFileSync throws', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      vi.mocked(readFileSync).mockImplementationOnce(() => {
        throw new Error('read failed');
      });

      await command.run();

      expect(loggerService.error).toHaveBeenCalledWith('read failed');
    });

    it('Should log error when s3Service throws', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      vi.mocked(readFileSync).mockReturnValueOnce(
        Buffer.from(faker.string.alphanumeric(10)),
      );

      s3Service.send.mockRejectedValueOnce(new Error('s3 error'));

      await command.run();

      expect(loggerService.error).toHaveBeenCalledWith('s3 error');
    });

    it('Should log generic error when s3Service throws a non-Error', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      vi.mocked(readFileSync).mockReturnValueOnce(
        Buffer.from(faker.string.alphanumeric(10)),
      );

      s3Service.send.mockImplementationOnce(() => {
        throw 'upload error';
      });

      await command.run();

      expect(loggerService.error).toHaveBeenCalledWith(
        'Error uploading file to S3',
      );
    });

    it('Should skip S3 upload when --local flag is passed', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {[BackupOptionsKeys.LOCAL]: true});

      expect(s3Service.send).not.toHaveBeenCalled();
    });

    it('Should pass local true through to the service when the --local flag is passed', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {[BackupOptionsKeys.LOCAL]: true});

      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Backup PostgreSQL database successfully! Filename: /,
        ),
      );
    });

    it('Should use provided filename when --filename flag is passed', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {
        [BackupOptionsKeys.LOCAL]: true,
        [BackupOptionsKeys.FILENAME]: filename,
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining(`> "${filename}"`),
        expect.anything(),
      );
    });

    it('Should return the value passed when parsing filename option', () => {
      const value = `${faker.string.alphanumeric(10)}.sql.gz`;

      expect(command.parseFilename(value)).toBe(value);
    });

    it('Should return true when parsing local option', () => {
      expect(command.parseLocal()).toBeTruthy();
    });
  });
});
