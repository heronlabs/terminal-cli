import {faker} from '@faker-js/faker';
import {execSync} from 'child_process';
import {readFileSync, unlinkSync} from 'fs';

import {cliModule} from '../../../../src/application/cli/cli-module';
import {EasypanelBackupService} from '../../../../src/core/services/easypanel-backup-service';
import {
  createTestingModule,
  loggerService,
  s3Service,
} from '../../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({readFileSync: vi.fn(), unlinkSync: vi.fn()}));

const BACKUP_COMMAND = `set -e
trap 'systemctl start docker' EXIT
systemctl stop docker.socket || true
systemctl stop docker
tar czf "$ARCHIVE" --warning=no-file-changed /etc/easypanel /var/lib/docker/volumes /var/lib/docker/buildkit 2>/dev/null || true
test -s "$ARCHIVE"`;

describe('Given a service', () => {
  let service: EasypanelBackupService;

  const originalGetuid = process.getuid;

  beforeEach(async () => {
    process.getuid = vi.fn(() => 0);

    const moduleRef = await createTestingModule(cliModule).compile();
    service = moduleRef.get(EasypanelBackupService);
  });

  afterEach(() => {
    process.getuid = originalGetuid;
  });

  describe('Given easypanel backup', () => {
    it('Should call execSync with a constant tar command and pass the archive path via env', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(execSync).toHaveBeenCalledWith(BACKUP_COMMAND, {
        env: {
          ...process.env,
          ARCHIVE: filename,
        },
        stdio: ['inherit', 'pipe', 'inherit'],
        shell: '/bin/bash',
      });
    });

    it('Should pass a malicious filename through env, never into the command (injection safe)', async () => {
      const malicious = '$(touch /tmp/pwned).tar.gz';

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, malicious);

      expect(execSync).toHaveBeenCalledWith(
        BACKUP_COMMAND,
        expect.objectContaining({
          env: expect.objectContaining({ARCHIVE: malicious}),
        }),
      );
    });

    it('Should log the exact success message including the filename', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(loggerService.log).toHaveBeenCalledWith(
        `Backup EasyPanel host successfully! Filename: ${filename}`,
      );
    });

    it('Should generate the default filename using the easypanel prefix and UTC timestamp pattern', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true);

      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Backup EasyPanel host successfully! Filename: easypanel-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.tar\.gz$/,
        ),
      );
    });

    it('Should pass the default filename through env to execSync', async () => {
      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true);

      expect(execSync).toHaveBeenCalledWith(
        BACKUP_COMMAND,
        expect.objectContaining({
          env: expect.objectContaining({
            ARCHIVE: expect.stringMatching(
              /^easypanel-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.tar\.gz$/,
            ),
          }),
        }),
      );
    });

    it('Should return ok true when local backup completes successfully', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      const result = await service.run(true, filename);

      expect(result).toEqual({ok: true});
    });

    it('Should return ok true when remote backup uploads successfully', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());
      vi.mocked(readFileSync).mockReturnValueOnce(
        Buffer.from(faker.string.alphanumeric(10)),
      );
      s3Service.send.mockResolvedValueOnce({});

      const result = await service.run(false, filename);

      expect(result).toEqual({ok: true});
    });

    it('Should upload the dumped backup file to S3 under its filename key', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

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
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

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
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(true, filename);

      expect(unlinkSync).not.toHaveBeenCalled();
    });

    it('Should not invoke S3 send when local flag is true', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

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

      expect(loggerService.error).toHaveBeenCalledWith(
        'easypanel backup failed',
      );
    });

    it('Should not invoke execSync when not running as root', async () => {
      process.getuid = vi.fn(() => 1000);

      await service.run(true);

      expect(execSync).not.toHaveBeenCalled();
    });

    it('Should log the root-guard error when not running as root', async () => {
      process.getuid = vi.fn(() => 1000);

      await service.run(true);

      expect(loggerService.error).toHaveBeenCalledWith(
        'easypanel-backup must run as root (needs systemctl + /var/lib/docker access)',
      );
    });

    it('Should log the root-guard error when getuid is unavailable', async () => {
      process.getuid = undefined;

      await service.run(true);

      expect(loggerService.error).toHaveBeenCalledWith(
        'easypanel-backup must run as root (needs systemctl + /var/lib/docker access)',
      );
      expect(execSync).not.toHaveBeenCalled();
    });
  });
});
