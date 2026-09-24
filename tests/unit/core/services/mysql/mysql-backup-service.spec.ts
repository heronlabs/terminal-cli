import {Upload} from '@aws-sdk/lib-storage';
import {faker} from '@faker-js/faker';
import * as Sentry from '@sentry/node';
import {execSync} from 'child_process';
import {rmSync, unlinkSync} from 'fs';

import {cliModule} from '../../../../../src/application/cli/cli-module';
import {MysqlBackupService} from '../../../../../src/core/services/mysql/mysql-backup-service';
import {
  createTestingModule,
  databaseConnection,
  loggerService,
  scriptLoaderService,
  ssmConfigService,
} from '../../../../__mocks__/create-testing-module';

const {uploadDone} = vi.hoisted(() => ({uploadDone: vi.fn()}));

vi.mock('@aws-sdk/lib-storage', () => ({
  Upload: vi.fn(
    class {
      done = uploadDone;
    },
  ),
}));
vi.mock('@sentry/node', () => ({
  captureCheckIn: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({
  createReadStream: vi.fn(),
  rmSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('Given a service', () => {
  let service: MysqlBackupService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule).compile();
    service = moduleRef.get(MysqlBackupService);
  });

  describe('Given mysql backup', () => {
    it('Should load the mysql-backup script from the mysql dir', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(scriptLoaderService.load).toHaveBeenCalledWith(
        'mysql',
        'mysql-backup',
      );
    });

    it('Should call execSync with the loaded script and pass all dynamic values via env', async () => {
      const LOADED_SCRIPT = `loaded-mysql-backup-${faker.string.alphanumeric(8)}`;
      scriptLoaderService.load.mockReturnValue(LOADED_SCRIPT);

      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(execSync).toHaveBeenCalledWith(LOADED_SCRIPT, {
        env: {
          ...process.env,
          DB_USER: databaseConnection.user,
          DB_HOST: databaseConnection.host,
          DB_PORT: databaseConnection.port,
          DB_NAME: databaseConnection.name,
          MYSQL_PWD: databaseConnection.password,
          BACKUP_FILE: filename,
        },
        stdio: ['inherit', 'pipe', 'inherit'],
        shell: '/bin/bash',
      });
    });

    it('Should pass a malicious filename through env, never into the command (injection safe)', async () => {
      const LOADED_SCRIPT = `loaded-mysql-backup-${faker.string.alphanumeric(8)}`;
      scriptLoaderService.load.mockReturnValue(LOADED_SCRIPT);

      const malicious = '$(touch /tmp/pwned).sql.gz';

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, malicious);

      expect(execSync).toHaveBeenCalledWith(
        LOADED_SCRIPT,
        expect.objectContaining({
          env: expect.objectContaining({BACKUP_FILE: malicious}),
        }),
      );
    });

    it('Should log the exact success message including the filename', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(loggerService.log).toHaveBeenCalledWith(
        `Backup MySQL database successfully! Filename: ${filename}`,
      );
    });

    it('Should generate the default filename using database name and UTC timestamp pattern', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true);

      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(
            `^Backup MySQL database successfully! Filename: ${databaseConnection.name}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}Z\\.sql\\.gz$`,
          ),
        ),
      );
    });

    it('Should return ok true when local backup completes successfully', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      const result = await service.run(true, filename);

      expect(result).toEqual({ok: true});
    });

    it('Should return ok true when remote backup uploads successfully', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      const result = await service.run(false, filename);

      expect(result).toEqual({ok: true});
    });

    it('Should upload the dumped backup file to S3 under its filename key', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(false, filename);

      expect(Upload).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({Key: filename}),
        }),
      );
    });

    it('Should delete the local backup file after successful remote upload', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(false, filename);

      expect(unlinkSync).toHaveBeenCalledWith(filename);
    });

    it('Should log the local backup file deletion after successful remote upload', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(false, filename);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Deleted local backup file',
      );
    });

    it('Should not delete the local backup file when local flag is true', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(unlinkSync).not.toHaveBeenCalled();
    });

    it('Should not upload to S3 when local flag is true', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(Upload).not.toHaveBeenCalled();
    });

    it('Should not invoke execSync when database resolution fails', async () => {
      ssmConfigService.getOrThrow.mockRejectedValueOnce(
        new Error(faker.lorem.word()),
      );

      await service.run(true);

      expect(execSync).not.toHaveBeenCalled();
    });

    it('Should log the database resolution error message exactly', async () => {
      const message = faker.lorem.sentence();

      ssmConfigService.getOrThrow.mockRejectedValueOnce(new Error(message));

      await service.run(true);

      expect(loggerService.error).toHaveBeenCalledWith(message);
    });

    it('Should return ok false when dump fails', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      const result = await service.run(true);

      expect(result).toEqual({ok: false});
    });

    it('Should remove the partial backup file when dump fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(true, filename);

      expect(rmSync).toHaveBeenCalledWith(filename, {force: true});
    });

    it('Should not remove any file when dump succeeds', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(rmSync).not.toHaveBeenCalled();
    });

    it('Should return ok false when database resolution fails', async () => {
      ssmConfigService.getOrThrow.mockRejectedValueOnce(
        new Error(faker.lorem.word()),
      );

      const result = await service.run(true);

      expect(result).toEqual({ok: false});
    });

    it('Should not remove any file when database resolution fails', async () => {
      ssmConfigService.getOrThrow.mockRejectedValueOnce(
        new Error(faker.lorem.word()),
      );

      await service.run(true);

      expect(rmSync).not.toHaveBeenCalled();
    });

    it('Should not upload when dump fails', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(false);

      expect(Upload).not.toHaveBeenCalled();
    });

    it('Should return ok false when the upload fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());
      uploadDone.mockRejectedValueOnce(new Error(faker.lorem.words()));

      const result = await service.run(false, filename);

      expect(result).toEqual({ok: false});
    });

    it('Should log the upload error message exactly when the upload fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;
      const message = faker.lorem.sentence();

      vi.mocked(execSync).mockImplementationOnce(vi.fn());
      uploadDone.mockRejectedValueOnce(new Error(message));

      await service.run(false, filename);

      expect(loggerService.error).toHaveBeenCalledWith(message);
    });

    it('Should delete the local backup file when the upload fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());
      uploadDone.mockRejectedValueOnce(new Error(faker.lorem.words()));

      await service.run(false, filename);

      expect(unlinkSync).toHaveBeenCalledWith(filename);
    });

    it('Should log the local backup file deletion when the upload fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());
      uploadDone.mockRejectedValueOnce(new Error(faker.lorem.words()));

      await service.run(false, filename);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Deleted local backup file',
      );
    });

    it('Should log the dump error message exactly', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(true);

      expect(loggerService.error).toHaveBeenCalledWith('mariadb-dump failed');
    });
  });

  describe('Given monitoring', () => {
    it('Should capture the dump error', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(true);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        new Error('mariadb-dump failed'),
      );
    });

    it('Should capture the upload error', async () => {
      const error = new Error(faker.lorem.sentence());

      vi.mocked(execSync).mockImplementationOnce(vi.fn());
      uploadDone.mockRejectedValueOnce(error);

      await service.run(false);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('Should not capture when the backup succeeds', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true);

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });

  describe('Given a cron monitor', () => {
    const monitorSlug = faker.string.alphanumeric(10);

    beforeEach(() => {
      vi.stubEnv('SENTRY_MONITOR_SLUG', monitorSlug);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('Should not check in when the monitor slug is unset', async () => {
      vi.stubEnv('SENTRY_MONITOR_SLUG', undefined);
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true);

      expect(Sentry.captureCheckIn).not.toHaveBeenCalled();
    });

    it('Should not check in when the monitor slug is empty', async () => {
      vi.stubEnv('SENTRY_MONITOR_SLUG', '');
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true);

      expect(Sentry.captureCheckIn).not.toHaveBeenCalled();
    });

    it('Should check in as in progress before the backup', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true);

      expect(Sentry.captureCheckIn).toHaveBeenNthCalledWith(1, {
        monitorSlug,
        status: 'in_progress',
      });
    });

    it('Should check in as ok when the backup succeeds', async () => {
      const checkInId = faker.string.uuid();

      vi.mocked(Sentry.captureCheckIn).mockReturnValueOnce(checkInId);
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true);

      expect(Sentry.captureCheckIn).toHaveBeenLastCalledWith({
        checkInId,
        monitorSlug,
        status: 'ok',
      });
    });

    it('Should check in as error when the backup fails', async () => {
      const checkInId = faker.string.uuid();

      vi.mocked(Sentry.captureCheckIn).mockReturnValueOnce(checkInId);
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(true);

      expect(Sentry.captureCheckIn).toHaveBeenLastCalledWith({
        checkInId,
        monitorSlug,
        status: 'error',
      });
    });

    it('Should return the backup result', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      expect(await service.run(true)).toEqual({ok: true});
    });
  });
});
