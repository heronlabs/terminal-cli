export type JobName = 'backup' | 'rollup' | 'backups-list';

export type JobTrigger = 'schedule' | 'manual';

export type JobOutcome = 'ok' | 'failed' | 'skipped';

export type JobResult =
  | {ok: true}
  | {ok: false; error: Error; expected?: boolean};

export type JobOptions = {
  command: string;
  job: JobName;
  trigger: JobTrigger;
  lock: boolean;
  monitored?: boolean;
};
