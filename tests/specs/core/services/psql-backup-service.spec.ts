import {faker} from '@faker-js/faker';
import {execSync} from 'child_process';
import {readFileSync, unlinkSync} from 'fs';

import {cliModule} from '../../../../src/application/cli/cli-module';
import {PsqlBackupService} from '../../../../src/core/services/psql-backup-service';
import {
  createTestingModule,
  loggerService,
  s3Service,
} from '../../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({readFileSync: vi.fn(), unlinkSync: vi.fn()}));

describe('Given a service', () => {
  let service: PsqlBackupService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule).compile();
    service = moduleRef.get(PsqlBackupService);
  });

  describe('Given psql backup', () => {
    it('Should call execSync with a constant pg_dump command and pass all dynamic values via env', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(execSync).toHaveBeenCalledWith(
        'set -o pipefail; pg_dump | gzip > "$BACKUP_FILE"',
        {
          env: {
            ...process.env,
            PGHOST: 'DB_HOST',
            PGPORT: 'DB_PORT',
            PGDATABASE: 'DB_NAME',
            PGUSER: 'DB_USER',
            PGPASSWORD: 'DB_PASSWORD',
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

      await service.run(true, malicious);

      const [command, options] = vi.mocked(execSync).mock.calls[0]!;
      expect(command).toBe('set -o pipefail; pg_dump | gzip > "$BACKUP_FILE"');
      expect(command).not.toContain(malicious);
      expect((options as {env: Record<string, string>}).env.BACKUP_FILE).toBe(
        malicious,
      );
    });

    it('Should log the exact success message including the filename', async () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(loggerService.log).toHaveBeenCalledWith(
        `Backup PostgreSQL database successfully! Filename: ${filename}`,
      );
    });

    it('Should generate the default filename using database name and UTC timestamp pattern', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true);

      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Backup PostgreSQL database successfully! Filename: DB_NAME-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.sql\.gz$/,
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
        throw new Error('boom');
      });

      const result = await service.run(true);

      expect(result).toBeUndefined();
    });

    it('Should log the dump error message exactly', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('boom');
      });

      await service.run(true);

      expect(loggerService.error).toHaveBeenCalledWith('pg_dump failed');
    });
  });
});
