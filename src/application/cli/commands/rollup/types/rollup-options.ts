export enum RollupOptionsKeys {
  FILENAME = 'filename',
  LATEST = 'latest',
  LOCAL = 'local',
  FORCE = 'force',
}

export type RollupOptions = {
  [RollupOptionsKeys.FILENAME]?: string;
  [RollupOptionsKeys.LATEST]?: boolean;
  [RollupOptionsKeys.LOCAL]?: boolean;
  [RollupOptionsKeys.FORCE]?: boolean;
};
