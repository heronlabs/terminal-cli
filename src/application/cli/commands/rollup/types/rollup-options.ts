export enum RollupOptionsKeys {
  FILENAME = 'filename',
  LATEST = 'latest',
  LOCAL = 'local',
}

export type RollupOptions = {
  [RollupOptionsKeys.FILENAME]?: string;
  [RollupOptionsKeys.LATEST]?: boolean;
  [RollupOptionsKeys.LOCAL]?: boolean;
};
