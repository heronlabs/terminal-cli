// Architecture rules for terminal-cli (dependency-cruiser).
//
// Hexagonal layering (NestJS):
//   application/   — apps CLI surface: nest-commander commands, modules (composition root)
//   core/          — domain services + abstract base services (backup/rollup)
//   infrastructure/— adapters: environment (config), storage (S3), log (pino)
//
// Invariants:
//   1. core/ must NEVER import application/ — domain logic stays unaware of the CLI surface.
//   2. infrastructure/ must NEVER import application/ or core/ — adapters depend on nothing inward.
//   3. No circular dependencies anywhere under src/.
//
// Note: core/ (services + abstract base services under interfaces/) MAY import
// infrastructure/ — the backup/rollup base services depend on the S3 adapter by design.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make code unpredictable and hard to test.',
      from: {},
      to: {circular: true},
    },
    {
      name: 'core-no-application',
      severity: 'error',
      comment:
        'core/ must not know how it is triggered (no commands, no modules). ' +
        'Invert the dependency or move shared shapes to core/.',
      from: {path: '^src/core/'},
      to: {path: '^src/application/'},
    },
    {
      name: 'infrastructure-no-upward-deps',
      severity: 'error',
      comment:
        'infrastructure/ adapters must not import application/ or core/ — they sit at the edge.',
      from: {path: '^src/infrastructure/'},
      to: {path: '^src/(application|core)/'},
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Orphan modules are dead-code candidates.',
      from: {
        orphan: true,
        pathNot: ['\\.d\\.ts$', '(^|/)main\\.ts$'],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: {path: 'node_modules'},
    tsPreCompilationDeps: true,
    tsConfig: {fileName: 'tsconfig.json'},
    reporterOptions: {
      dot: {collapsePattern: 'node_modules/[^/]+'},
      archi: {
        collapsePattern: '^(src/application|src/core|src/infrastructure)/[^/]+',
      },
    },
  },
};
