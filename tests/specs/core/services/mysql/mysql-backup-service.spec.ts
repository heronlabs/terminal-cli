import {faker} from '@faker-js/faker';
import {execSync} from 'child_process';
import {readFileSync, unlinkSync} from 'fs';

import {cliModule} from '../../../../../src/application/cli/cli-module';
import {MysqlBackupService} from '../../../../../src/core/services/mysql/mysql-backup-service';
import {ScriptLoaderService} from '../../../../../src/core/services/script-loader-service';
import {
  createTestingModule,
  databaseConnection,
  loggerService,
  s3Service,
} from '../../../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({readFileSync: vi.fn(), unlinkSync: vi.fn()}));

const BACKUP_SCRIPT = `loaded-mysql-backup-${faker.string.alphanumeric(8)}.sh`;

describe('Given a service', () => {
  let service: MysqlBackupService;

  const scriptLoader = {load: vi.fn()};

  beforeEach(async () => {
    scriptLoader.load.mockReturnValue(BACKUP_SCRIPT);

    const moduleRef = await createTestingModule(cliModule)
      .overrideProvider(ScriptLoaderService)
      .useValue(scriptLoader)
      .compile();
    service = moduleRef.get(MysqlBackupService);
  });

  describe('Given mysql backup', () => {
    it('Should load the mysql-backup script from the mysql dir', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(scriptLoader.load).toHaveBeenCalledWith('mysql', 'mysql-backup');
    });

    it('Should keep the mysql-backup script constant with env-var indirection only', async () => {
      const {readFileSync: readActual} =
        await vi.importActual<typeof import('fs')>('fs');

      const script = readActual(
        'src/core/services/mysql/mysql-backup.sh',
        'utf8',
      );

      expect(script).toBe(
        'set -o pipefail\nmariadb-dump -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" | gzip > "$BACKUP_FILE"\n',
      );
    });

    it('Should call execSync with the loaded script and pass all dynamic values via env', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(execSync).toHaveBeenCalledWith(BACKUP_SCRIPT, {
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
      const malicious = '$(touch /tmp/pwned).sql.gz';

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, malicious);

      expect(execSync).toHaveBeenCalledWith(
        BACKUP_SCRIPT,
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
      vi.mocked(readFileSync).mockReturnValueOnce(
        Buffer.from(faker.string.alphanumeric(10)),
      );
      s3Service.send.mockResolvedValueOnce({});

      const result = await service.run(false, filename);

      expect(result).toEqual({ok: true});
    });

    it('Should upload the dumped backup file to S3 under its filename key', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());
      vi.mocked(readFileSync).mockReturnValueOnce(
        Buffer.from(faker.string.alphanumeric(10)),
      );
      s3Service.send.mockResolvedValueOnce({});

      await service.run(false, filename);

      expect(s3Service.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({Key: filename}),
        }),
      );
    });

    it('Should delete the local backup file after successful remote upload', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());
      vi.mocked(readFileSync).mockReturnValueOnce(
        Buffer.from(faker.string.alphanumeric(10)),
      );
      s3Service.send.mockResolvedValueOnce({});

      await service.run(false, filename);

      expect(unlinkSync).toHaveBeenCalledWith(filename);
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

    it('Should not invoke S3 send when local flag is true', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(s3Service.send).not.toHaveBeenCalled();
    });

    it('Should return undefined when dump fails', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      const result = await service.run(true);

      expect(result).toBeUndefined();
    });

    it('Should log the dump error message exactly', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(true);

      expect(loggerService.error).toHaveBeenCalledWith('mariadb-dump failed');
    });
  });
});
