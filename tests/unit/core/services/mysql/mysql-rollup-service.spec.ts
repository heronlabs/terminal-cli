import {faker} from '@faker-js/faker';
import {execSync} from 'child_process';
import {rmSync, unlinkSync} from 'fs';
import {pipeline} from 'stream/promises';

import {cliModule} from '../../../../../src/application/cli/cli-module';
import {MysqlRollupService} from '../../../../../src/core/services/mysql/mysql-rollup-service';
import {
  createTestingModule,
  databaseConnection,
  loggerService,
  s3Service,
  scriptLoaderService,
  ssmConfigService,
} from '../../../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({
  createWriteStream: vi.fn(),
  rmSync: vi.fn(),
  unlinkSync: vi.fn(),
}));
vi.mock('stream/promises', () => ({pipeline: vi.fn()}));

describe('Given a service', () => {
  let service: MysqlRollupService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule).compile();
    service = moduleRef.get(MysqlRollupService);
  });

  describe('Given mysql rollup', () => {
    it('Should load the mysql-rollup script from the mysql dir', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(scriptLoaderService.load).toHaveBeenCalledWith(
        'mysql',
        'mysql-rollup',
      );
    });

    it('Should call execSync with the loaded script and pass all dynamic values via env', async () => {
      const LOADED_SCRIPT = `loaded-mysql-rollup-${faker.string.alphanumeric(8)}`;
      scriptLoaderService.load.mockReturnValue(LOADED_SCRIPT);

      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

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
      const LOADED_SCRIPT = `loaded-mysql-rollup-${faker.string.alphanumeric(8)}`;
      scriptLoaderService.load.mockReturnValue(LOADED_SCRIPT);

      const malicious = '$(touch /tmp/pwned).sql.gz';

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(malicious, true);

      expect(execSync).toHaveBeenCalledWith(
        LOADED_SCRIPT,
        expect.objectContaining({
          env: expect.objectContaining({BACKUP_FILE: malicious}),
        }),
      );
    });

    it('Should log the restore success message with the backup filename', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(loggerService.log).toHaveBeenCalledWith(`Restored ${filename}`);
    });

    it('Should not invoke S3 send when local flag is true', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(s3Service.send).not.toHaveBeenCalled();
    });

    it('Should download from S3 then restore when local flag is false', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, false);

      expect(execSync).toHaveBeenCalledTimes(1);
    });

    it('Should delete the downloaded file after successful remote restore', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, false);

      expect(unlinkSync).toHaveBeenCalledWith(filename);
    });

    it('Should log the downloaded file deletion after successful remote restore', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, false);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Deleted downloaded backup file',
      );
    });

    it('Should not delete the file after successful local restore', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(unlinkSync).not.toHaveBeenCalled();
    });

    it('Should not invoke execSync when database resolution fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      ssmConfigService.getOrThrow.mockRejectedValueOnce(
        new Error(faker.lorem.word()),
      );

      await service.run(filename, true);

      expect(execSync).not.toHaveBeenCalled();
    });

    it('Should log the database resolution error message exactly', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;
      const message = faker.lorem.sentence();

      ssmConfigService.getOrThrow.mockRejectedValueOnce(new Error(message));

      await service.run(filename, true);

      expect(loggerService.error).toHaveBeenCalledWith(new Error(message));
    });

    it('Should log the restore error message exactly when execSync fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(filename, true);

      expect(loggerService.error).toHaveBeenCalledWith(
        new Error('mariadb restore failed'),
      );
    });

    it('Should return ok true when the restore succeeds', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      const result = await service.run(filename, true);

      expect(result).toEqual({ok: true});
    });

    it('Should return ok false when the restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      const result = await service.run(filename, true);

      expect(result).toEqual({ok: false});
    });

    it('Should return ok false when database resolution fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      ssmConfigService.getOrThrow.mockRejectedValueOnce(
        new Error(faker.lorem.word()),
      );

      const result = await service.run(filename, true);

      expect(result).toEqual({ok: false});
    });

    it('Should return ok false when the download fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockRejectedValueOnce(new Error(faker.lorem.sentence()));

      const result = await service.run(filename, false);

      expect(result).toEqual({ok: false});
    });

    it('Should log the download error message exactly when the download fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;
      const message = faker.lorem.sentence();

      s3Service.send.mockRejectedValueOnce(new Error(message));

      await service.run(filename, false);

      expect(loggerService.error).toHaveBeenCalledWith(new Error(message));
    });

    it('Should not restore when the download fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockRejectedValueOnce(new Error(faker.lorem.sentence()));

      await service.run(filename, false);

      expect(execSync).not.toHaveBeenCalled();
    });

    it('Should remove the partial file when the S3 request fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockRejectedValueOnce(new Error(faker.lorem.word()));

      await service.run(filename, false);

      expect(rmSync).toHaveBeenCalledWith(filename, {force: true});
    });

    it('Should not delete a downloaded file when the S3 request fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockRejectedValueOnce(new Error(faker.lorem.word()));

      await service.run(filename, false);

      expect(unlinkSync).not.toHaveBeenCalled();
    });

    it('Should return ok false when writing the download fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(pipeline).mockRejectedValueOnce(new Error(faker.lorem.word()));

      const result = await service.run(filename, false);

      expect(result).toEqual({ok: false});
    });

    it('Should remove the partial file when writing the download fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(pipeline).mockRejectedValueOnce(new Error(faker.lorem.word()));

      await service.run(filename, false);

      expect(rmSync).toHaveBeenCalledWith(filename, {force: true});
    });

    it('Should not restore when writing the download fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(pipeline).mockRejectedValueOnce(new Error(faker.lorem.word()));

      await service.run(filename, false);

      expect(execSync).not.toHaveBeenCalled();
    });

    it('Should not remove any file when the download succeeds', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, false);

      expect(rmSync).not.toHaveBeenCalled();
    });

    it('Should return ok false when the remote restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      const result = await service.run(filename, false);

      expect(result).toEqual({ok: false});
    });

    it('Should delete the downloaded file when the remote restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(filename, false);

      expect(unlinkSync).toHaveBeenCalledWith(filename);
    });

    it('Should log the downloaded file deletion when the remote restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(filename, false);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Deleted downloaded backup file',
      );
    });

    it('Should not delete the file when the local restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(filename, true);

      expect(unlinkSync).not.toHaveBeenCalled();
    });

    it('Should not remove any file when the local restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(filename, true);

      expect(rmSync).not.toHaveBeenCalled();
    });

    it('Should not log the downloaded file deletion when the local restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(filename, true);

      expect(loggerService.log).not.toHaveBeenCalledWith(
        'Deleted downloaded backup file',
      );
    });
  });
});
