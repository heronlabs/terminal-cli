export enum BackupOptionsKeys {
  FILENAME = 'filename',
  LOCAL = 'local',
}

export type BackupOptions = {
  [BackupOptionsKeys.FILENAME]?: string;
  [BackupOptionsKeys.LOCAL]?: boolean;
};
