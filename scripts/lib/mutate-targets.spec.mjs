import { describe, expect, it } from 'vitest';
import { MUTATION_PACKAGES, mutateTargets } from './mutate-targets.mjs';

/** Files kept for one package dir, or undefined when the package is omitted. */
const filesOf = (targets, dir) => targets.find((t) => t.dir === dir)?.files;

describe('mutateTargets', () => {
  it('groups by package in package order, with paths relative to the package', () => {
    const targets = mutateTargets([
      'packages/shared/src/schemas/evaluation.ts',
      'apps/api/src/session/session.service.ts',
      'apps/web/lib/cefr.ts',
      'packages/db/src/exercise-bank.ts',
      'packages/importer/src/parse.ts',
    ]);
    expect(targets).toEqual([
      { dir: 'apps/api', files: ['src/session/session.service.ts'] },
      { dir: 'packages/db', files: ['src/exercise-bank.ts'] },
      { dir: 'packages/importer', files: ['src/parse.ts'] },
      { dir: 'packages/shared', files: ['src/schemas/evaluation.ts'] },
      { dir: 'apps/web', files: ['lib/cefr.ts'] },
    ]);
  });

  it('returns no targets for no changed files', () => {
    expect(mutateTargets([])).toEqual([]);
  });

  it('skips files that are not TypeScript sources', () => {
    expect(
      mutateTargets([
        'apps/api/src/app.js',
        'apps/api/src/config.yml',
        'apps/api/src/readme.md',
        'apps/web/lib/view.tsx',
        'apps/api/src/file.ts.bak',
        'packages/shared/src/index.mts',
      ])
    ).toEqual([]);
  });

  it('skips .d.ts declaration files', () => {
    expect(mutateTargets(['apps/api/src/types.d.ts', 'packages/shared/src/env.d.ts'])).toEqual([]);
  });

  it('keeps only files under the package roots', () => {
    expect(
      mutateTargets([
        'apps/api/test/integration/create-test-app.ts',
        'apps/api/scripts/tool.ts',
        'apps/api/vitest.config.ts',
        'packages/db/drizzle.config.ts',
      ])
    ).toEqual([]);
  });

  it('takes only lib/ from the web app', () => {
    const targets = mutateTargets([
      'apps/web/app/(app)/page.ts',
      'apps/web/hooks/use-thing.ts',
      'apps/web/providers/x.ts',
      'apps/web/src/other.ts',
      'apps/web/next.config.ts',
      'apps/web/lib/fake-live.ts',
      'apps/web/lib/nested/helper.ts',
    ]);
    expect(targets).toEqual([
      { dir: 'apps/web', files: ['lib/fake-live.ts', 'lib/nested/helper.ts'] },
    ]);
  });

  it('requires the root at the start of the package-relative path', () => {
    expect(mutateTargets(['apps/web/app/lib/x.ts', 'apps/api/test/src/x.ts'])).toEqual([]);
  });

  describe('apps/api exclusions', () => {
    it('drops spec files, main.ts, modules, the contract and test helpers', () => {
      expect(
        mutateTargets([
          'apps/api/src/session/session.service.spec.ts',
          'apps/api/src/main.ts',
          'apps/api/src/app.module.ts',
          'apps/api/src/session/session.module.ts',
          'apps/api/src/contract/exam.contract.ts',
          'apps/api/src/contract/nested/x.ts',
          'apps/api/src/test-helpers.ts',
        ])
      ).toEqual([]);
    });

    it('keeps look-alikes of the excluded files', () => {
      const targets = mutateTargets([
        'apps/api/src/session/main.ts',
        'apps/api/src/mainly.ts',
        'apps/api/src/module.service.ts',
        'apps/api/src/session/contract/x.ts',
        'apps/api/src/contracts.ts',
        'apps/api/src/session/test-helpers.ts',
        'apps/api/src/spec.ts',
        'apps/api/src/session/session.test.ts',
      ]);
      expect(filesOf(targets, 'apps/api')).toEqual([
        'src/session/main.ts',
        'src/mainly.ts',
        'src/module.service.ts',
        'src/session/contract/x.ts',
        'src/contracts.ts',
        'src/session/test-helpers.ts',
        'src/spec.ts',
        'src/session/session.test.ts',
      ]);
    });
  });

  describe('packages/db exclusions', () => {
    it('drops test files and the schema', () => {
      expect(
        mutateTargets([
          'packages/db/src/exercise-bank.test.ts',
          'packages/db/src/schema/users.ts',
          'packages/db/src/schema/index.ts',
        ])
      ).toEqual([]);
    });

    it('drops the load-exercise-bank CLI entry (env, pool, exit codes)', () => {
      expect(mutateTargets(['packages/db/src/load-exercise-bank.ts'])).toEqual([]);
    });

    it('keeps the exercise bank loader and near-misses of the CLI name', () => {
      const targets = mutateTargets([
        'packages/db/src/load-exercise-bank.ts',
        'packages/db/src/exercise-bank-loader.ts',
        'packages/db/src/load-exercise-bank-helpers.ts',
        'packages/db/src/cli/load-exercise-bank.ts',
      ]);
      expect(filesOf(targets, 'packages/db')).toEqual([
        'src/exercise-bank-loader.ts',
        'src/load-exercise-bank-helpers.ts',
        'src/cli/load-exercise-bank.ts',
      ]);
    });

    it('keeps spec files, nested schema dirs and other sources', () => {
      const targets = mutateTargets([
        'packages/db/src/migrate.ts',
        'packages/db/src/x.spec.ts',
        'packages/db/src/testing/schema/x.ts',
        'packages/db/src/schema.ts',
      ]);
      expect(filesOf(targets, 'packages/db')).toEqual([
        'src/migrate.ts',
        'src/x.spec.ts',
        'src/testing/schema/x.ts',
        'src/schema.ts',
      ]);
    });
  });

  describe('packages/importer exclusions', () => {
    it('drops spec and test files and cli.ts', () => {
      expect(
        mutateTargets([
          'packages/importer/src/parse.spec.ts',
          'packages/importer/src/parse.test.ts',
          'packages/importer/src/cli.ts',
        ])
      ).toEqual([]);
    });

    it('keeps a nested cli.ts and other sources', () => {
      const targets = mutateTargets([
        'packages/importer/src/run/cli.ts',
        'packages/importer/src/client.ts',
        'packages/importer/src/parse.ts',
      ]);
      expect(filesOf(targets, 'packages/importer')).toEqual([
        'src/run/cli.ts',
        'src/client.ts',
        'src/parse.ts',
      ]);
    });
  });

  describe('packages/shared exclusions', () => {
    it('drops spec files only', () => {
      const targets = mutateTargets([
        'packages/shared/src/schemas/evaluation.spec.ts',
        'packages/shared/src/schemas/evaluation.test.ts',
        'packages/shared/src/index.ts',
      ]);
      expect(filesOf(targets, 'packages/shared')).toEqual([
        'src/schemas/evaluation.test.ts',
        'src/index.ts',
      ]);
    });
  });

  describe('apps/web exclusions', () => {
    it('drops test files only', () => {
      const targets = mutateTargets([
        'apps/web/lib/fake-live.test.ts',
        'apps/web/lib/fake-live.spec.ts',
        'apps/web/lib/fake-live.ts',
      ]);
      expect(filesOf(targets, 'apps/web')).toEqual(['lib/fake-live.spec.ts', 'lib/fake-live.ts']);
    });
  });

  it('removes duplicates and keeps the order of first appearance', () => {
    const targets = mutateTargets([
      'apps/api/src/b.ts',
      'apps/api/src/a.ts',
      'apps/api/src/b.ts',
      'apps/api/src/c.ts',
      'apps/api/src/a.ts',
    ]);
    expect(targets).toEqual([{ dir: 'apps/api', files: ['src/b.ts', 'src/a.ts', 'src/c.ts'] }]);
  });

  it('omits packages whose changed files were all filtered out', () => {
    const targets = mutateTargets([
      'apps/api/src/app.module.ts',
      'packages/shared/src/index.ts',
      'packages/db/src/schema/users.ts',
    ]);
    expect(targets).toEqual([{ dir: 'packages/shared', files: ['src/index.ts'] }]);
  });

  it('ignores paths of packages without a mutation config', () => {
    expect(
      mutateTargets([
        'packages/email-templates/src/verify.ts',
        'apps/e2e/tests/support.ts',
        'scripts/lib/mutate-targets.mjs',
        'src/index.ts',
      ])
    ).toEqual([]);
  });

  it('does not match packages whose dir only shares a prefix', () => {
    expect(
      mutateTargets([
        'apps/api-other/src/x.ts',
        'apps/apix/src/x.ts',
        'packages/db2/src/x.ts',
        'packages/shared-utils/src/x.ts',
        'apps/web-legacy/lib/x.ts',
        'apps/api',
        'xapps/api/src/x.ts',
      ])
    ).toEqual([]);
  });

  it('uses a custom package list when given', () => {
    const packages = [
      { dir: 'tools/one', roots: ['src/', 'bin/'], exclude: [/^bin\/skip\.ts$/] },
      { dir: 'tools/two', roots: ['lib/'], exclude: [] },
    ];
    const targets = mutateTargets(
      [
        'apps/api/src/session/session.service.ts',
        'tools/two/lib/x.ts',
        'tools/one/bin/run.ts',
        'tools/one/bin/skip.ts',
        'tools/one/src/a.ts',
        'tools/one/other/b.ts',
      ],
      packages
    );
    expect(targets).toEqual([
      { dir: 'tools/one', files: ['bin/run.ts', 'src/a.ts'] },
      { dir: 'tools/two', files: ['lib/x.ts'] },
    ]);
  });

  it('returns nothing for an empty package list', () => {
    expect(mutateTargets(['apps/api/src/a.ts'], [])).toEqual([]);
  });
});

describe('MUTATION_PACKAGES', () => {
  it('lists every package that has a Stryker config', () => {
    expect(MUTATION_PACKAGES.map((p) => p.dir)).toEqual([
      'apps/api',
      'packages/db',
      'packages/importer',
      'packages/shared',
      'apps/web',
    ]);
  });
});
