import {ScriptLoaderService} from '../../../../../src/core/services/script-loader-service';

describe('Given the easy-panel scripts loaded by ScriptLoaderService', () => {
  let service: ScriptLoaderService;

  beforeEach(() => {
    service = new ScriptLoaderService();
  });

  describe('Given the easypanel-rollup script', () => {
    it('Should verify gzip integrity before extracting the archive', () => {
      const script = service.load('easy-panel', 'easypanel-rollup');

      expect(script).toContain('gzip -t "$ARCHIVE"');
    });

    it('Should assert the archive is non-empty before extracting', () => {
      const script = service.load('easy-panel', 'easypanel-rollup');

      expect(script).toContain('test -s "$ARCHIVE"');
    });
  });

  describe('Given the easypanel-backup script', () => {
    it('Should assert the produced archive is non-empty', () => {
      const script = service.load('easy-panel', 'easypanel-backup');

      expect(script).toContain('test -s "$ARCHIVE"');
    });

    it('Should include buildkit only when its directory exists', () => {
      const script = service.load('easy-panel', 'easypanel-backup');

      expect(script).toContain('[ -d /var/lib/docker/buildkit ]');
    });
  });
});
