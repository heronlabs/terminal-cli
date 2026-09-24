import {faker} from '@faker-js/faker';
import {readFileSync, rmSync, writeFileSync} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';

import {JobLockService} from '../../../../../src/core/services/job/job-lock-service';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const lockPath = join(tmpdir(), 'hcli.lock');

const failWith = (code: string) => () => {
  throw Object.assign(new Error(code), {code});
};

describe('Given a job lock', () => {
  let service: JobLockService;
  let pid: number;

  const heldBy = (killResult: () => true) => {
    vi.mocked(writeFileSync).mockImplementationOnce(failWith('EEXIST'));
    vi.mocked(readFileSync).mockReturnValueOnce(String(pid));
    vi.spyOn(process, 'kill').mockImplementationOnce(killResult);
  };

  beforeEach(() => {
    service = new JobLockService();
    pid = faker.number.int({min: 2, max: 99999});
  });

  describe('Given acquire', () => {
    it('Should acquire the lock when no lock file exists', () => {
      expect(service.acquire()).toBe(true);
    });

    it('Should create the lock exclusively with the current pid', () => {
      service.acquire();

      expect(writeFileSync).toHaveBeenCalledWith(
        lockPath,
        String(process.pid),
        {flag: 'wx'},
      );
    });

    it('Should refuse the lock when a live process holds it', () => {
      heldBy(() => true);

      expect(service.acquire()).toBe(false);
    });

    it('Should keep the lock file of a live process', () => {
      heldBy(() => true);

      service.acquire();

      expect(rmSync).not.toHaveBeenCalled();
    });

    it('Should read the pid of the holder as utf8', () => {
      heldBy(() => true);

      service.acquire();

      expect(readFileSync).toHaveBeenCalledWith(lockPath, 'utf8');
    });

    it('Should probe the holder pid as a number with signal 0', () => {
      heldBy(() => true);

      service.acquire();

      expect(process.kill).toHaveBeenCalledWith(pid, 0);
    });

    it('Should take over a lock left by a dead process', () => {
      heldBy(failWith('ESRCH'));

      expect(service.acquire()).toBe(true);
    });

    it('Should remove the lock file left by a dead process', () => {
      heldBy(failWith('ESRCH'));

      service.acquire();

      expect(rmSync).toHaveBeenCalledWith(lockPath, {force: true});
    });

    it('Should refuse the lock when another process takes it over first', () => {
      heldBy(failWith('ESRCH'));
      vi.mocked(writeFileSync).mockImplementationOnce(failWith('EEXIST'));

      expect(service.acquire()).toBe(false);
    });

    it('Should treat a process owned by another user as alive', () => {
      heldBy(failWith('EPERM'));

      expect(service.acquire()).toBe(false);
    });

    it('Should treat a lock file that vanished while reading as held', () => {
      vi.mocked(writeFileSync).mockImplementationOnce(failWith('EEXIST'));
      vi.mocked(readFileSync).mockImplementationOnce(failWith('ENOENT'));

      expect(service.acquire()).toBe(false);
    });
  });

  describe('Given release', () => {
    it('Should remove the lock file on release', () => {
      service.release();

      expect(rmSync).toHaveBeenCalledWith(lockPath, {force: true});
    });
  });
});
