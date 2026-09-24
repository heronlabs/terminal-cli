import {Injectable} from '@nestjs/common';
import {readFileSync, rmSync, writeFileSync} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';

const LOCK_PATH = join(tmpdir(), 'hcli.lock');

@Injectable()
export class JobLockService {
  acquire(): boolean {
    if (this.tryCreate()) {
      return true;
    }

    if (!this.isHeldByDeadProcess()) {
      return false;
    }

    this.release();

    return this.tryCreate();
  }

  release(): void {
    rmSync(LOCK_PATH, {force: true});
  }

  private tryCreate(): boolean {
    try {
      writeFileSync(LOCK_PATH, String(process.pid), {flag: 'wx'});
      return true;
    } catch {
      return false;
    }
  }

  private isHeldByDeadProcess(): boolean {
    try {
      process.kill(Number(readFileSync(LOCK_PATH, 'utf8')), 0);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ESRCH';
    }
  }
}
