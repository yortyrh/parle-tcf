/**
 * Which files `pnpm mutate` hands to Stryker: changed source files of the
 * packages that have a stryker.config.mjs, grouped by package. Keep the rules
 * in line with each package's `mutate` globs.
 */
export const MUTATION_PACKAGES = [
  {
    dir: 'apps/api',
    roots: ['src/'],
    exclude: [
      /\.spec\.ts$/,
      /^src\/main\.ts$/,
      /\.module\.ts$/,
      /^src\/contract\//,
      /^src\/test-helpers\.ts$/,
    ],
  },
  { dir: 'packages/db', roots: ['src/'], exclude: [/\.test\.ts$/, /^src\/schema\//] },
  { dir: 'packages/importer', roots: ['src/'], exclude: [/\.(spec|test)\.ts$/, /^src\/cli\.ts$/] },
  { dir: 'packages/shared', roots: ['src/'], exclude: [/\.spec\.ts$/] },
  { dir: 'apps/web', roots: ['lib/'], exclude: [/\.test\.ts$/] },
];

/** Source files Stryker can mutate: TypeScript, not declarations. */
const SOURCE = /\.ts$/;
const DECLARATION = /\.d\.ts$/;

/**
 * Groups repo-relative changed paths by package, keeping only mutable source
 * files, as paths relative to the package. Packages without files are omitted;
 * duplicates are removed and the order of first appearance is kept.
 */
export function mutateTargets(changedFiles, packages = MUTATION_PACKAGES) {
  const targets = [];
  for (const pkg of packages) {
    const prefix = `${pkg.dir}/`;
    const files = [];
    for (const path of changedFiles) {
      if (!path.startsWith(prefix)) continue;
      const rel = path.slice(prefix.length);
      if (!SOURCE.test(rel) || DECLARATION.test(rel)) continue;
      if (!pkg.roots.some((root) => rel.startsWith(root))) continue;
      if (pkg.exclude.some((re) => re.test(rel))) continue;
      if (!files.includes(rel)) files.push(rel);
    }
    if (files.length > 0) targets.push({ dir: pkg.dir, files });
  }
  return targets;
}
