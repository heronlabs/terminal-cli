import {Upload} from '@aws-sdk/lib-storage';
import {faker} from '@faker-js/faker';
import * as Sentry from '@sentry/node';
import {execSync} from 'child_process';
import {rmSync, unlinkSync} from 'fs';

import {cliModule} from '../../../../../src/application/cli/cli-module';
import {PsqlBackupService} from '../../../../../src/core/services/psql/psql-backup-service';
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
vi.mock('@sentry/node', () => ({captureCheckIn: vi.fn()}));
vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({
  createReadStream: vi.fn(),
  rmSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('Given a service', () => {
  let service: PsqlBackupService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule).compile();
    service = moduleRef.get(PsqlBackupService);
  });

  describe('Given psql backup', () => {
    it('Should load the psql-backup script from the psql dir', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(scriptLoaderService.load).toHaveBeenCalledWith(
        'psql',
        'psql-backup',
      );
    });

    it('Should call execSync with the loaded script and pass all dynamic values via env', async () => {
      const LOADED_SCRIPT = `loaded-psql-backup-${faker.string.alphanumeric(8)}`;
      scriptLoaderService.load.mockReturnValue(LOADED_SCRIPT);

      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(execSync).toHaveBeenCalledWith(LOADED_SCRIPT, {
        env: {
          ...process.env,
          PGHOST: databaseConnection.host,
          PGPORT: databaseConnection.port,
          PGDATABASE: databaseConnection.name,
          PGUSER: databaseConnection.user,
          PGPASSWORD: databaseConnection.password,
          BACKUP_FILE: filename,
        },
        stdio: ['inherit', 'pipe', 'inherit'],
        shell: '/bin/bash',
      });
    });

    it('Should pass a malicious filename through env, never into the command (injection safe)', async () => {
      const LOADED_SCRIPT = `loaded-psql-backup-${faker.string.alphanumeric(8)}`;
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
        {
          logId: 'backup.dump-completed',
          engine: 'postgres',
          filename,
        },
        'backup.dump-completed',
        'PsqlBackupService',
      );
    });

    it('Should generate the default filename using database name and UTC timestamp pattern', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true);

      expect(loggerService.log).toHaveBeenCalledWith(
        {
          logId: 'backup.dump-completed',
          engine: 'postgres',
          filename: expect.stringMatching(
            new RegExp(
              `^${databaseConnection.name}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}Z\\.sql\\.gz$`,
            ),
          ),
        },
        'backup.dump-completed',
        'PsqlBackupService',
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
        {
          logId: 'backup.local-file-deleted',
          engine: 'postgres',
          filename,
        },
        'backup.local-file-deleted',
        'BackupService',
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

      expect(loggerService.error).toHaveBeenCalledWith(
        {
          logId: 'backup.dump-failed',
          engine: 'postgres',
          err: new Error(message),
          errorName: 'Error',
          errorMessage: message,
        },
        'backup.dump-failed',
        'BackupService',
      );
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

      expect(loggerService.error).toHaveBeenCalledWith(
        {
          logId: 'backup.upload-failed',
          engine: 'postgres',
          filename,
          err: new Error(message),
          errorName: 'Error',
          errorMessage: message,
        },
        'backup.upload-failed',
        'BackupService',
      );
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
        {
          logId: 'backup.local-file-deleted',
          engine: 'postgres',
          filename,
        },
        'backup.local-file-deleted',
        'BackupService',
      );
    });

    it('Should log the dump error message exactly', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(true);

      expect(loggerService.error).toHaveBeenCalledWith(
        {
          logId: 'backup.dump-failed',
          engine: 'postgres',
          err: new Error('pg_dump failed'),
          errorName: 'Error',
          errorMessage: 'pg_dump failed',
        },
        'backup.dump-failed',
        'BackupService',
      );
    });
  });

  describe('Given a cron monitor', () => {
    it('Should check in as in progress before the backup', async () => {
      const monitorSlug = 'terminal-cli-backup';

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true);

      expect(Sentry.captureCheckIn).toHaveBeenNthCalledWith(1, {
        monitorSlug,
        status: 'in_progress',
      });
    });

    it('Should check in as ok when the backup succeeds', async () => {
      const monitorSlug = 'terminal-cli-backup';
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
      const monitorSlug = 'terminal-cli-backup';
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
