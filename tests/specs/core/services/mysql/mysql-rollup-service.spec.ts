import {faker} from '@faker-js/faker';
import {execSync} from 'child_process';
import {unlinkSync} from 'fs';

import {cliModule} from '../../../../../src/application/cli/cli-module';
import {MysqlRollupService} from '../../../../../src/core/services/mysql/mysql-rollup-service';
import {ScriptLoaderService} from '../../../../../src/core/services/script-loader-service';
import {
  createTestingModule,
  databaseConnection,
  loggerService,
  s3Service,
} from '../../../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

const RESTORE_SCRIPT = `loaded-mysql-rollup-${faker.string.alphanumeric(8)}.sh`;

describe('Given a service', () => {
  let service: MysqlRollupService;

  const scriptLoader = {load: vi.fn()};

  beforeEach(async () => {
    scriptLoader.load.mockReturnValue(RESTORE_SCRIPT);

    const moduleRef = await createTestingModule(cliModule)
      .overrideProvider(ScriptLoaderService)
      .useValue(scriptLoader)
      .compile();
    service = moduleRef.get(MysqlRollupService);
  });

  describe('Given mysql rollup', () => {
    it('Should load the mysql-rollup script from the mysql dir', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(scriptLoader.load).toHaveBeenCalledWith('mysql', 'mysql-rollup');
    });

    it('Should keep the mysql-rollup script constant with env-var indirection only', async () => {
      const {readFileSync: readActual} =
        await vi.importActual<typeof import('fs')>('fs');

      const script = readActual(
        'src/core/services/mysql/mysql-rollup.sh',
        'utf8',
      );

      expect(script).toBe(
        'set -o pipefail\ngunzip -c "$BACKUP_FILE" | mariadb -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME"\n',
      );
    });

    it('Should call execSync with the loaded script and pass all dynamic values via env', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(execSync).toHaveBeenCalledWith(RESTORE_SCRIPT, {
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

      await service.run(malicious, true);

      expect(execSync).toHaveBeenCalledWith(
        RESTORE_SCRIPT,
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

      s3Service.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(new Uint8Array()),
        },
      });
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, false);

      expect(execSync).toHaveBeenCalledTimes(1);
    });

    it('Should delete the downloaded file after successful remote restore', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      s3Service.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(new Uint8Array()),
        },
      });
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, false);

      expect(unlinkSync).toHaveBeenCalledWith(filename);
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

    it('Should log the restore error message exactly when execSync fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error(faker.lorem.word());
      });

      await service.run(filename, true);

      expect(loggerService.error).toHaveBeenCalledWith(
        'mariadb restore failed',
      );
    });
  });
});
