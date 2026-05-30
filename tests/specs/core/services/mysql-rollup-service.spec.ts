import {faker} from '@faker-js/faker';
import {execSync} from 'child_process';
import {unlinkSync} from 'fs';

import {cliModule} from '../../../../src/application/cli/cli-module';
import {MysqlRollupService} from '../../../../src/core/services/mysql-rollup-service';
import {
  createTestingModule,
  loggerService,
  s3Service,
} from '../../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('Given a service', () => {
  let service: MysqlRollupService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule).compile();
    service = moduleRef.get(MysqlRollupService);
  });

  describe('Given mysql rollup', () => {
    it('Should call execSync with a constant gunzip|mariadb command and pass all dynamic values via env', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(execSync).toHaveBeenCalledWith(
        'set -o pipefail; gunzip -c "$BACKUP_FILE" | mariadb -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME"',
        {
          env: {
            ...process.env,
            DB_USER: 'DB_USER',
            DB_HOST: 'DB_HOST',
            DB_PORT: 'DB_PORT',
            DB_NAME: 'DB_NAME',
            MYSQL_PWD: 'DB_PASSWORD',
            BACKUP_FILE: filename,
          },
          stdio: ['inherit', 'pipe', 'inherit'],
          shell: '/bin/bash',
        },
      );
    });

    it('Should not interpolate the filename into the command string (injection safe)', async () => {
      const malicious = '$(touch /tmp/pwned).sql.gz';

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(malicious, true);

      const [command, options] = vi.mocked(execSync).mock.calls[0]!;
      expect(command).toBe(
        'set -o pipefail; gunzip -c "$BACKUP_FILE" | mariadb -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME"',
      );
      expect(command).not.toContain(malicious);
      expect((options as {env: Record<string, string>}).env.BACKUP_FILE).toBe(
        malicious,
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
        throw new Error('boom');
      });

      await service.run(filename, true);

      expect(loggerService.error).toHaveBeenCalledWith(
        'mariadb restore failed',
      );
    });
  });
});
