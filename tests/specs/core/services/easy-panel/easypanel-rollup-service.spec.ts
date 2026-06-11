import {faker} from '@faker-js/faker';
import {execSync} from 'child_process';
import {unlinkSync} from 'fs';

import {cliModule} from '../../../../../src/application/cli/cli-module';
import {EasypanelRollupService} from '../../../../../src/core/services/easy-panel/easypanel-rollup-service';
import {ScriptLoaderService} from '../../../../../src/core/services/script-loader-service';
import {
  createTestingModule,
  loggerService,
  s3Service,
} from '../../../../__mocks__/create-testing-module';

vi.mock('child_process', () => ({execSync: vi.fn()}));
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

const RESTORE_SCRIPT = `loaded-easypanel-rollup-${faker.string.alphanumeric(8)}.sh`;

describe('Given a service', () => {
  let service: EasypanelRollupService;

  const scriptLoader = {load: vi.fn()};

  const originalGetuid = process.getuid;

  beforeEach(async () => {
    process.getuid = vi.fn(() => 0);
    scriptLoader.load.mockReturnValue(RESTORE_SCRIPT);

    const moduleRef = await createTestingModule(cliModule)
      .overrideProvider(ScriptLoaderService)
      .useValue(scriptLoader)
      .compile();
    service = moduleRef.get(EasypanelRollupService);
  });

  afterEach(() => {
    process.getuid = originalGetuid;
  });

  describe('Given easypanel rollup', () => {
    it('Should load the easypanel-rollup script from the easy-panel dir', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(scriptLoader.load).toHaveBeenCalledWith('easy-panel', 'easypanel-rollup');
    });

    it('Should call execSync with the loaded script and pass the archive path via env', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(execSync).toHaveBeenCalledWith(RESTORE_SCRIPT, {
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

      await service.run(malicious, true);

      expect(execSync).toHaveBeenCalledWith(
        RESTORE_SCRIPT,
        expect.objectContaining({
          env: expect.objectContaining({ARCHIVE: malicious}),
        }),
      );
    });

    it('Should log the restore success message with the backup filename', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(loggerService.log).toHaveBeenCalledWith(`Restored ${filename}`);
    });

    it('Should not invoke S3 send when local flag is true', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(s3Service.send).not.toHaveBeenCalled();
    });

    it('Should download from S3 then restore when local flag is false', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

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
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

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
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      vi.mocked(execSync).mockImplementationOnce(vi.fn());

      await service.run(filename, true);

      expect(unlinkSync).not.toHaveBeenCalled();
    });

    it('Should log the restore error message exactly when execSync fails', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('boom');
      });

      await service.run(filename, true);

      expect(loggerService.error).toHaveBeenCalledWith(
        'easypanel restore failed',
      );
    });

    it('Should not invoke execSync when not running as root', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      process.getuid = vi.fn(() => 1000);

      await service.run(filename, true);

      expect(execSync).not.toHaveBeenCalled();
    });

    it('Should log the root-guard error when not running as root', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      process.getuid = vi.fn(() => 1000);

      await service.run(filename, true);

      expect(loggerService.error).toHaveBeenCalledWith(
        'easypanel-rollup must run as root (needs systemctl + /var/lib/docker access)',
      );
    });

    it('Should log the root-guard error when getuid is unavailable', async () => {
      const filename = `${faker.string.alphanumeric(10)}.tar.gz`;

      process.getuid = undefined;

      await service.run(filename, true);

      expect(loggerService.error).toHaveBeenCalledWith(
        'easypanel-rollup must run as root (needs systemctl + /var/lib/docker access)',
      );
      expect(execSync).not.toHaveBeenCalled();
    });
  });
});
