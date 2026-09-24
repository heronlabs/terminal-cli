import {Upload} from '@aws-sdk/lib-storage';
import {faker} from '@faker-js/faker';
import {execSync} from 'child_process';

import {CliModule} from '../../../src/application/cli/cli-module';
import {MysqlBackupCommand} from '../../../src/application/cli/commands/backup/mysql-backup-command';
import {BackupOptionsKeys} from '../../../src/application/cli/commands/backup/types/backup-options';
import {
  createTestingModule,
  loggerService,
  scriptLoaderService,
} from '../../__mocks__/create-testing-module';

const {uploadDone} = vi.hoisted(() => ({uploadDone: vi.fn()}));

vi.mock('@aws-sdk/lib-storage', () => ({
  Upload: vi.fn(
    class {
      done = uploadDone;
    },
  ),
}));
vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({
  createReadStream: vi.fn(),
  rmSync: vi.fn(),
  unlinkSync: vi.fn(),
}));
describe('Given a CLI command', () => {
  let command: MysqlBackupCommand;

  beforeEach(async () => {
    const moduleRef = await createTestingModule({
      imports: [CliModule],
    }).compile();
    command = moduleRef.get(MysqlBackupCommand);
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  describe('Given command mysql-backup', () => {
    it('Should run the mysql backup command without logging an error', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run();

      expect(loggerService.error).toHaveBeenCalledTimes(0);
    });

    it('Should leave the exit code unset when the backup succeeds', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run();

      expect(process.exitCode).toBeUndefined();
    });

    it('Should log error when execSync throws', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('mariadb-dump failed');
      });

      await command.run();

      expect(loggerService.error).toHaveBeenCalledWith(
        {err: new Error('mariadb-dump failed')},
        'Backup dump failed',
        'MysqlBackupService',
      );
    });

    it('Should set exit code 1 when the dump fails', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('mariadb-dump failed');
      });

      await command.run();

      expect(process.exitCode).toBe(1);
    });

    it('Should log error when the upload rejects', async () => {
      const message = faker.lorem.words();

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      uploadDone.mockRejectedValueOnce(new Error(message));

      await command.run();

      expect(loggerService.error).toHaveBeenCalledWith(
        {err: new Error(message), filename: expect.any(String)},
        'Backup upload failed',
        'MysqlBackupService',
      );
    });

    it('Should set exit code 1 when the upload fails', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      uploadDone.mockRejectedValueOnce(new Error(faker.lorem.words()));

      await command.run();

      expect(process.exitCode).toBe(1);
    });

    it('Should log generic error when the upload rejects with a non-Error', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      uploadDone.mockRejectedValueOnce(faker.lorem.word());

      await command.run();

      expect(loggerService.error).toHaveBeenCalledWith(
        {
          err: new Error('Error uploading file to S3'),
          filename: expect.any(String),
        },
        'Backup upload failed',
        'MysqlBackupService',
      );
    });

    it('Should skip S3 upload when --local flag is passed', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {[BackupOptionsKeys.LOCAL]: true});

      expect(Upload).not.toHaveBeenCalled();
    });

    it('Should pass local true through to the service when the --local flag is passed', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {[BackupOptionsKeys.LOCAL]: true});

      expect(loggerService.log).toHaveBeenCalledWith(
        {database: expect.any(String), filename: expect.any(String)},
        'Backup dump completed',
        'MysqlBackupService',
      );
    });

    it('Should use provided filename when --filename flag is passed', async () => {
      scriptLoaderService.load.mockReturnValue('loaded-script');

      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await command.run([], {
        [BackupOptionsKeys.LOCAL]: true,
        [BackupOptionsKeys.FILENAME]: filename,
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          env: expect.objectContaining({BACKUP_FILE: filename}),
        }),
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
