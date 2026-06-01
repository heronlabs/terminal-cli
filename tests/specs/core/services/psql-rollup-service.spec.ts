import {faker} from '@faker-js/faker';
import {ParameterFactory} from '@heronlabs/env-ssm';
import {execSync} from 'child_process';
import {unlinkSync} from 'fs';

import {cliModule} from '../../../../src/application/cli/cli-module';
import {PsqlRollupService} from '../../../../src/core/services/psql-rollup-service';
import {
  createTestingModule,
  loggerService,
  s3Service,
  ssmGetOrThrow,
} from '../../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));
vi.mock('@heronlabs/env-ssm', () => ({ParameterFactory: {make: vi.fn()}}));

describe('Given a service', () => {
  let service: PsqlRollupService;

  beforeEach(async () => {
    vi.mocked(ParameterFactory.make).mockResolvedValue({
      getOrThrow: ssmGetOrThrow,
    } as never);

    const moduleRef = await createTestingModule(cliModule).compile();
    await moduleRef.init();
    service = moduleRef.get(PsqlRollupService);
  });

  describe('Given psql rollup', () => {
    it('Should call execSync with a constant gunzip|psql command and pass all dynamic values via env', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(execSync).toHaveBeenCalledWith(
        'set -o pipefail; gunzip -c "$BACKUP_FILE" | psql',
        {
          env: {
            ...process.env,
            PGHOST: 'db_host',
            PGPORT: '5432',
            PGDATABASE: 'db_name',
            PGUSER: 'db_user',
            PGPASSWORD: 'db_password',
            BACKUP_FILE: filename,
          },
          stdio: ['inherit', 'pipe', 'inherit'],
          shell: '/bin/bash',
        },
      );
    });

    it('Should pass a malicious filename through env, never into the command (injection safe)', async () => {
      const malicious = '$(touch /tmp/pwned).sql.gz';

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(malicious, true);

      expect(execSync).toHaveBeenCalledWith(
        'set -o pipefail; gunzip -c "$BACKUP_FILE" | psql',
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
        throw new Error('boom');
      });

      await service.run(filename, true);

      expect(loggerService.error).toHaveBeenCalledWith('psql restore failed');
    });
  });
});
