export enum RollupOptionsKeys {
  FILENAME = 'filename',
  LOCAL = 'local',
}

export type RollupOptions = {
  [RollupOptionsKeys.FILENAME]: string;
  [RollupOptionsKeys.LOCAL]?: boolean;
};
