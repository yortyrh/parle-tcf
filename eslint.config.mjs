// Single ESLint config for the whole monorepo (packages run `eslint .` and pick it up).
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';

const TS = ['**/*.{ts,tsx,mts,cts}'];
const WEB = ['apps/web/**/*.{ts,tsx}'];
const TESTS = [
  '**/*.{test,spec}.{ts,tsx}',
  '**/test/**/*.ts',
  '**/*.spec.mjs',
  '**/test-helpers.ts',
];
const CONFIG_FILES = ['**/*.config.{ts,mts,cts}'];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/reports/**',
      '**/.stryker-tmp/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/next-env.d.ts',
      'apps/web/public/**',
      'packages/db/migrations/**',
    ],
  },

  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  // TypeScript, type-aware.
  ...tseslint.configs.recommendedTypeChecked.map((c) => ({ ...c, files: TS })),
  {
    files: TS,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        // JSX handlers may return a promise (React ignores it).
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
    },
  },

  // Import graph hygiene.
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
          noWarnOnMultipleProjects: true,
        },
        node: true,
      },
    },
    rules: {
      'import/no-cycle': ['error', { ignoreExternal: true }],
      'import/no-self-import': 'error',
      'import/no-duplicates': 'error',
    },
  },

  // A small, uncontroversial subset of unicorn.
  {
    plugins: { unicorn },
    rules: {
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/no-instanceof-array': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/no-useless-spread': 'error',
      'unicorn/no-useless-promise-resolve-reject': 'error',
      'unicorn/prefer-string-starts-ends-with': 'error',
      'unicorn/throw-new-error': 'error',
      'unicorn/error-message': 'error',
    },
  },

  // Registered globally so `next build` detects the Next.js plugin; its rules apply to web only.
  { plugins: { '@next/next': nextPlugin } },

  // Web: React, hooks, a11y and Next.js rules.
  {
    files: WEB,
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: { globals: { ...globals.browser } },
    settings: { react: { version: 'detect' }, next: { rootDir: 'apps/web' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react/prop-types': 'off',
      // App Router only: there is no pages/ directory.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },

  // Tests may use loose types for fixtures and mocks.
  {
    files: TESTS,
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
      // Fakes implement async interfaces without awaiting anything.
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
    },
  },

  // Tool configs live outside the tsconfig projects: lint them without type info.
  {
    files: CONFIG_FILES,
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { parserOptions: { projectService: false, project: null } },
  },

  // Formatting belongs to Prettier.
  prettier
);
