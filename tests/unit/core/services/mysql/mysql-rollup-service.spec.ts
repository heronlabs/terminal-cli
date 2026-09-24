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

      await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

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

      await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

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

      await service.run({
        filename: malicious,
        latest: false,
        local: true,
        force: true,
      });

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

      await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

      expect(loggerService.log).toHaveBeenCalledWith(`Restored ${filename}`);
    });

    it('Should not invoke S3 send when local flag is true', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

      expect(s3Service.send).not.toHaveBeenCalled();
    });

    it('Should download from S3 then restore when local flag is false', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(execSync).toHaveBeenCalledTimes(1);
    });

    it('Should delete the downloaded file after successful remote restore', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(unlinkSync).toHaveBeenCalledWith(filename);
    });

    it('Should log the downloaded file deletion after successful remote restore', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(loggerService.log).toHaveBeenCalledWith(
        'Deleted downloaded backup file',
      );
    });

    it('Should not delete the file after successful local restore', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

      expect(unlinkSync).not.toHaveBeenCalled();
    });

    it('Should not invoke execSync when database resolution fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      ssmConfigService.getOrThrow.mockRejectedValueOnce(
        new Error(faker.lorem.word()),
      );

      await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

      expect(execSync).not.toHaveBeenCalled();
    });

    it('Should log the database resolution error message exactly', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;
      const message = faker.lorem.sentence();

      ssmConfigService.getOrThrow.mockRejectedValueOnce(new Error(message));

      await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

      expect(loggerService.error).toHaveBeenCalledWith(message);
    });

    it('Should log the restore error message exactly when execSync fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

      expect(loggerService.error).toHaveBeenCalledWith(
        'mariadb restore failed',
      );
    });

    it('Should return ok true when the restore succeeds', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      const result = await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

      expect(result).toEqual({ok: true});
    });

    it('Should return ok false when the restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      const result = await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

      expect(result).toEqual({
        ok: false,
        error: new Error('mariadb restore failed'),
      });
    });

    it('Should return ok false when database resolution fails', async () => {
      const error = new Error(faker.lorem.word());
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      ssmConfigService.getOrThrow.mockRejectedValueOnce(error);

      const result = await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

      expect(result).toEqual({ok: false, error});
    });

    it('Should return ok false when the download fails', async () => {
      const error = new Error(faker.lorem.sentence());
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockRejectedValueOnce(error);

      const result = await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(result).toEqual({ok: false, error});
    });

    it('Should log the download error message exactly when the download fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;
      const message = faker.lorem.sentence();

      s3Service.send.mockRejectedValueOnce(new Error(message));

      await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(loggerService.error).toHaveBeenCalledWith(message);
    });

    it('Should not restore when the download fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockRejectedValueOnce(new Error(faker.lorem.sentence()));

      await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(execSync).not.toHaveBeenCalled();
    });

    it('Should remove the partial file when the S3 request fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockRejectedValueOnce(new Error(faker.lorem.word()));

      await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(rmSync).toHaveBeenCalledWith(filename, {force: true});
    });

    it('Should not delete a downloaded file when the S3 request fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockRejectedValueOnce(new Error(faker.lorem.word()));

      await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(unlinkSync).not.toHaveBeenCalled();
    });

    it('Should return ok false when writing the download fails', async () => {
      const error = new Error(faker.lorem.word());
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(pipeline).mockRejectedValueOnce(error);

      const result = await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(result).toEqual({ok: false, error});
    });

    it('Should remove the partial file when writing the download fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(pipeline).mockRejectedValueOnce(new Error(faker.lorem.word()));

      await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(rmSync).toHaveBeenCalledWith(filename, {force: true});
    });

    it('Should not restore when writing the download fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(pipeline).mockRejectedValueOnce(new Error(faker.lorem.word()));

      await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(execSync).not.toHaveBeenCalled();
    });

    it('Should not remove any file when the download succeeds', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(rmSync).not.toHaveBeenCalled();
    });

    it('Should return ok false when the remote restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      const result = await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(result).toEqual({
        ok: false,
        error: new Error('mariadb restore failed'),
      });
    });

    it('Should delete the downloaded file when the remote restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(unlinkSync).toHaveBeenCalledWith(filename);
    });

    it('Should log the downloaded file deletion when the remote restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({Body: {}});
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run({
        filename: filename,
        latest: false,
        local: false,
        force: true,
      });

      expect(loggerService.log).toHaveBeenCalledWith(
        'Deleted downloaded backup file',
      );
    });

    it('Should not delete the file when the local restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

      expect(unlinkSync).not.toHaveBeenCalled();
    });

    it('Should not remove any file when the local restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

      expect(rmSync).not.toHaveBeenCalled();
    });

    it('Should not log the downloaded file deletion when the local restore fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run({
        filename: filename,
        latest: false,
        local: true,
        force: true,
      });

      expect(loggerService.log).not.toHaveBeenCalledWith(
        'Deleted downloaded backup file',
      );
    });
  });

  describe('Given the rollup request', () => {
    const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

    it('Should refuse a request with both filename and latest', async () => {
      expect(
        await service.run({filename, latest: true, local: false, force: false}),
      ).toEqual({
        ok: false,
        error: new Error('Pass either --filename or --latest'),
        expected: true,
      });
    });

    it('Should refuse a request with neither filename nor latest', async () => {
      expect(
        await service.run({latest: false, local: false, force: false}),
      ).toEqual({
        ok: false,
        error: new Error('Pass either --filename or --latest'),
        expected: true,
      });
    });

    it('Should refuse latest with local', async () => {
      expect(
        await service.run({latest: true, local: true, force: false}),
      ).toEqual({
        ok: false,
        error: new Error(
          '--latest reads from S3 and cannot be combined with --local',
        ),
        expected: true,
      });
    });
  });

  describe('Given the empty-database guard', () => {
    const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

    it('Should refuse a database that already has tables', async () => {
      const count = faker.number.int({min: 1, max: 500});

      vi.mocked(execSync).mockReturnValueOnce(`${count}\n`);

      expect(
        await service.run({filename, latest: false, local: true, force: false}),
      ).toEqual({
        ok: false,
        error: new Error(
          `Target database is not empty (${count} tables). Restore into an empty database or pass --force`,
        ),
        expected: true,
      });
    });

    it('Should not download when the database has tables', async () => {
      vi.mocked(execSync).mockReturnValueOnce('37\n');

      await service.run({filename, latest: false, local: false, force: false});

      expect(s3Service.send).not.toHaveBeenCalled();
    });

    it('Should restore into an empty database', async () => {
      vi.mocked(execSync).mockReturnValueOnce('0\n');

      expect(
        await service.run({filename, latest: false, local: true, force: false}),
      ).toEqual({ok: true});
    });

    it('Should load the mysql-count-tables script from the mysql dir', async () => {
      vi.mocked(execSync).mockReturnValueOnce('0\n');

      await service.run({filename, latest: false, local: true, force: false});

      expect(scriptLoaderService.load).toHaveBeenCalledWith(
        'mysql',
        'mysql-count-tables',
      );
    });

    it('Should count the tables with the connection env and read the output as utf8', async () => {
      const LOADED_SCRIPT = `loaded-mysql-count-tables-${faker.string.alphanumeric(8)}`;
      scriptLoaderService.load.mockReturnValue(LOADED_SCRIPT);
      vi.mocked(execSync).mockReturnValueOnce('0\n');

      await service.run({filename, latest: false, local: true, force: false});

      expect(execSync).toHaveBeenNthCalledWith(1, LOADED_SCRIPT, {
        env: {
          ...process.env,
          DB_USER: databaseConnection.user,
          DB_HOST: databaseConnection.host,
          DB_PORT: databaseConnection.port,
          DB_NAME: databaseConnection.name,
          MYSQL_PWD: databaseConnection.password,
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
        shell: '/bin/bash',
      });
    });

    it('Should skip the table count with force', async () => {
      await service.run({filename, latest: false, local: true, force: true});

      expect(scriptLoaderService.load).not.toHaveBeenCalledWith(
        'mysql',
        'mysql-count-tables',
      );
    });

    it('Should fail when the table count fails', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      expect(
        await service.run({filename, latest: false, local: true, force: false}),
      ).toEqual({
        ok: false,
        error: new Error('Could not count the tables of the target database'),
      });
    });

    it('Should log the table count failure', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run({filename, latest: false, local: true, force: false});

      expect(loggerService.error).toHaveBeenCalledWith(
        'Could not count the tables of the target database',
      );
    });

    it('Should fail when the table count is not a number', async () => {
      vi.mocked(execSync).mockReturnValueOnce(faker.lorem.word());

      expect(
        await service.run({filename, latest: false, local: true, force: false}),
      ).toEqual({
        ok: false,
        error: new Error('Could not count the tables of the target database'),
      });
    });

    it('Should return the database error when counting the tables', async () => {
      const error = new Error(faker.lorem.sentence());

      ssmConfigService.getOrThrow.mockRejectedValueOnce(error);

      expect(
        await service.run({filename, latest: false, local: true, force: false}),
      ).toEqual({ok: false, error});
    });
  });

  describe('Given latest', () => {
    const key = `${databaseConnection.name}-2026-09-24T12-17-03Z.sql.gz`;

    it('Should restore the latest backup key', async () => {
      vi.mocked(execSync).mockReturnValueOnce('0\n');
      s3Service.send.mockResolvedValueOnce({
        Contents: [{Key: key, Size: 1, LastModified: faker.date.past()}],
      });
      s3Service.send.mockResolvedValueOnce({Body: {}});

      await service.run({latest: true, local: false, force: false});

      expect(s3Service.send.mock.calls[1]![0].input.Key).toBe(key);
    });

    it('Should fail when latest finds nothing', async () => {
      vi.mocked(execSync).mockReturnValueOnce('0\n');
      s3Service.send.mockResolvedValueOnce({Contents: []});

      expect(
        await service.run({latest: true, local: false, force: false}),
      ).toEqual({
        ok: false,
        error: new Error(`No backups found for ${databaseConnection.name}`),
      });
    });

    it('Should log why latest found nothing', async () => {
      vi.mocked(execSync).mockReturnValueOnce('0\n');
      s3Service.send.mockResolvedValueOnce({Contents: []});

      await service.run({latest: true, local: false, force: false});

      expect(loggerService.error).toHaveBeenCalledWith(
        `No backups found for ${databaseConnection.name}`,
      );
    });
  });
});
