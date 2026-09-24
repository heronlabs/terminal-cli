import {cliModule} from '../../../src/application/cli/cli-module';
import {RunCommand} from '../../../src/application/cli/commands/run/run-command';
import {BackupScheduleService} from '../../../src/core/services/schedule/backup-schedule-service';
import {createTestingModule} from '../../__mocks__/create-testing-module';

describe('Given a CLI command', () => {
  let command: RunCommand;

  const schedule = {start: vi.fn(async () => true), stop: vi.fn()};

  const runUntil = async (signal: 'SIGTERM' | 'SIGINT') => {
    const running = command.run();
    await new Promise(setImmediate);
    process.emit(signal, signal);
    await running;
  };

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule)
      .overrideProvider(BackupScheduleService)
      .useValue(schedule)
      .compile();

    command = moduleRef.get(RunCommand);
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  describe('Given command run', () => {
    it('Should set exit code 1 when the schedule cannot start', async () => {
      schedule.start.mockResolvedValueOnce(false);

      await command.run();

      expect(process.exitCode).toBe(1);
    });

    it('Should not stop a schedule that never started', async () => {
      schedule.start.mockResolvedValueOnce(false);

      await command.run();

      expect(schedule.stop).not.toHaveBeenCalled();
    });

    it('Should stop the schedule on SIGTERM', async () => {
      await runUntil('SIGTERM');

      expect(schedule.stop).toHaveBeenCalledTimes(1);
    });

    it('Should stop the schedule on SIGINT', async () => {
      await runUntil('SIGINT');

      expect(schedule.stop).toHaveBeenCalledTimes(1);
    });

    it('Should leave the exit code unset after a clean stop', async () => {
      await runUntil('SIGTERM');

      expect(process.exitCode).toBeUndefined();
    });

    it('Should not stop the schedule before a signal arrives', async () => {
      const running = command.run();
      await new Promise(setImmediate);
      const stoppedEarly = schedule.stop.mock.calls.length;
      process.emit('SIGTERM', 'SIGTERM');
      await running;

      expect(stoppedEarly).toBe(0);
    });
  });
});
