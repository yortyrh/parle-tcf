import { beforeAll, describe, expect, it } from 'vitest';
import {
  apiControllerTemplate,
  apiServiceTemplate,
  packageFiles,
  sharedSchemaTemplate,
  webPageTemplate,
  webViewTemplate,
} from './scaffold-templates.mjs';

const EXERCISE_BANK = {
  kebab: 'exercise-bank',
  camel: 'exerciseBank',
  pascal: 'ExerciseBank',
};

const SUJETS_DU_MOIS = {
  kebab: 'sujets-du-mois',
  camel: 'sujetsDuMois',
  pascal: 'SujetsDuMois',
};

const escapeRegExp = (text) => text.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');

/** Matches `import { ...name... } from "<from>";` (optionally `import type`). */
const namedImport = (name, from) =>
  new RegExp(
    `import\\s+(?:type\\s+)?\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*"${escapeRegExp(from)}";`
  );

/** Every relative specifier in a `from "..."` clause. */
const relativeSpecifiers = (source) =>
  [...source.matchAll(/from\s+["'](\.\.?\/[^"']*)["']/g)].map((m) => m[1]);

describe('sharedSchemaTemplate', () => {
  let source;
  beforeAll(() => {
    source = sharedSchemaTemplate(EXERCISE_BANK);
  });

  it('returns a non-empty string', () => {
    expect(typeof source).toBe('string');
    expect(source.trim()).not.toBe('');
  });

  it('imports zod with double quotes', () => {
    expect(source).toContain('import { z } from "zod";');
    expect(source).not.toMatch(/from '/);
  });

  it('exports the list input schema as a zod object', () => {
    expect(source).toMatch(/export const listExerciseBankInputSchema\s*=\s*z\s*\.object\(/);
  });

  it('exports the list output schema as a zod object with an items array', () => {
    expect(source).toMatch(
      /export const listExerciseBankOutputSchema\s*=\s*z\s*\.object\(\s*\{[\s\S]*\bitems:\s*z\s*\.array\(/
    );
  });

  it('exports the inferred input and output types', () => {
    expect(source).toMatch(
      /export type ListExerciseBankInput\s*=\s*z\.infer<\s*typeof listExerciseBankInputSchema\s*>/
    );
    expect(source).toMatch(
      /export type ListExerciseBankOutput\s*=\s*z\.infer<\s*typeof listExerciseBankOutputSchema\s*>/
    );
  });

  it('uses the given names, not hard-coded ones', () => {
    const other = sharedSchemaTemplate(SUJETS_DU_MOIS);
    expect(other).toMatch(/export const listSujetsDuMoisInputSchema\b/);
    expect(other).toMatch(/export const listSujetsDuMoisOutputSchema\b/);
    expect(other).toMatch(/export type ListSujetsDuMoisInput\b/);
    expect(other).toMatch(/export type ListSujetsDuMoisOutput\b/);
    expect(other).not.toContain('ExerciseBank');
  });
});

describe('apiControllerTemplate', () => {
  let source;
  beforeAll(() => {
    source = apiControllerTemplate(EXERCISE_BANK);
  });

  it('declares the controller class with its decorators', () => {
    expect(source).toMatch(
      /@Controller\(\)\s*@UseGuards\(SessionAuthGuard\)\s*export class ExerciseBankController\b/
    );
  });

  it('imports the Nest decorators from @nestjs/common', () => {
    expect(source).toMatch(namedImport('Controller', '@nestjs/common'));
    expect(source).toMatch(namedImport('Req', '@nestjs/common'));
    expect(source).toMatch(namedImport('UseGuards', '@nestjs/common'));
  });

  it('imports Implement and implement from @orpc/nest', () => {
    expect(source).toMatch(namedImport('Implement', '@orpc/nest'));
    expect(source).toMatch(namedImport('implement', '@orpc/nest'));
  });

  it('imports the procedure from the contract with a .js extension', () => {
    expect(source).toMatch(
      namedImport('exerciseBankListProcedure', '../contract/exam.contract.js')
    );
  });

  it('imports the guard and request type from the session guard', () => {
    expect(source).toMatch(namedImport('SessionAuthGuard', '../auth/session-auth.guard.js'));
    expect(source).toMatch(namedImport('AuthenticatedRequest', '../auth/session-auth.guard.js'));
  });

  it('imports currentUserId and the service', () => {
    expect(source).toMatch(namedImport('currentUserId', '../auth/current-user.js'));
    expect(source).toMatch(namedImport('ExerciseBankService', './exercise-bank.service.js'));
  });

  it('injects the service under the camel name', () => {
    expect(source).toMatch(
      /constructor\(\s*private readonly exerciseBank: ExerciseBankService,?\s*\)/
    );
  });

  it('implements the list procedure on a list method', () => {
    expect(source).toMatch(
      /@Implement\(exerciseBankListProcedure\)\s*list\(@Req\(\) req: AuthenticatedRequest\)/
    );
  });

  it('resolves the user and delegates to the service', () => {
    expect(source).toMatch(/currentUserId\(req\)/);
    expect(source).toMatch(/implement\(exerciseBankListProcedure\)/);
    expect(source).toContain('this.exerciseBank.list(userId, input)');
  });

  it('uses only double quotes and .js relative imports', () => {
    expect(source).not.toMatch(/from '/);
    const relative = relativeSpecifiers(source);
    expect(relative.length).toBeGreaterThanOrEqual(4);
    for (const specifier of relative) expect(specifier).toMatch(/\.js$/);
  });

  it('uses the given names, not hard-coded ones', () => {
    const other = apiControllerTemplate(SUJETS_DU_MOIS);
    expect(other).toMatch(/export class SujetsDuMoisController\b/);
    expect(other).toMatch(namedImport('SujetsDuMoisService', './sujets-du-mois.service.js'));
    expect(other).toMatch(/@Implement\(sujetsDuMoisListProcedure\)/);
    expect(other).toContain('this.sujetsDuMois.list(userId, input)');
    expect(other).not.toMatch(/exercise|Exercise/);
  });
});

describe('apiServiceTemplate', () => {
  let source;
  beforeAll(() => {
    source = apiServiceTemplate(EXERCISE_BANK);
  });

  it('declares an injectable service class', () => {
    expect(source).toMatch(/@Injectable\(\)\s*export class ExerciseBankService\b/);
    expect(source).toMatch(namedImport('Injectable', '@nestjs/common'));
  });

  it('declares the typed list method without async (nothing to await yet)', () => {
    expect(source).toMatch(
      /(^|[^\w])list\(\s*userId: string,\s*input: ListExerciseBankInput,?\s*\):\s*Promise<ListExerciseBankOutput>/m
    );
    expect(source).not.toMatch(/\basync\s+list\s*\(/);
  });

  it('returns an empty list of items as a resolved promise', () => {
    expect(source).toMatch(/return Promise\.resolve\(\{ items: \[\] \}\);?/);
    expect(source).not.toMatch(/return \{ items: \[\] \};?/);
  });

  it('imports the input and output types from @parle-tcf/shared', () => {
    expect(source).toMatch(namedImport('ListExerciseBankInput', '@parle-tcf/shared'));
    expect(source).toMatch(namedImport('ListExerciseBankOutput', '@parle-tcf/shared'));
  });

  it('contains a TODO about filtering every query by userId', () => {
    expect(source).toMatch(/TODO[\s\S]{0,200}userId/);
  });

  it('uses only double quotes', () => {
    expect(source).not.toMatch(/from '/);
    for (const specifier of relativeSpecifiers(source)) {
      expect(specifier).toMatch(/\.js$/);
    }
  });

  it('uses the given names, not hard-coded ones', () => {
    const other = apiServiceTemplate(SUJETS_DU_MOIS);
    expect(other).toMatch(/export class SujetsDuMoisService\b/);
    expect(other).toMatch(/Promise<ListSujetsDuMoisOutput>/);
    expect(other).toMatch(/input: ListSujetsDuMoisInput\b/);
    expect(other).not.toMatch(/exercise|Exercise/);
  });
});

describe('webPageTemplate', () => {
  let source;
  beforeAll(() => {
    source = webPageTemplate({
      pascal: 'SujetsDuMois',
      title: 'Sujets du mois',
      fileBase: 'du-mois',
    });
  });

  it('imports the view from the sibling view file with single quotes', () => {
    expect(source).toContain("import { SujetsDuMoisView } from './du-mois-view';");
  });

  it('exports the page metadata title', () => {
    expect(source).toContain("export const metadata = { title: 'Sujets du mois' };");
  });

  it('leaves the site suffix to the root layout title template', () => {
    expect(source).not.toContain('parle-tcf');
    expect(source).not.toContain(' · ');
  });

  it('escapes single quotes and backslashes in the metadata title', () => {
    const quoted = webPageTemplate({
      pascal: 'Ete',
      title: "L'été",
      fileBase: 'ete',
    });
    expect(quoted).toContain("export const metadata = { title: 'L\\'été' };");
    const slashed = webPageTemplate({
      pascal: 'Slash',
      title: "A\\B'C",
      fileBase: 'slash',
    });
    expect(slashed).toContain("export const metadata = { title: 'A\\\\B\\'C' };");
  });

  it('keeps a title with a middle dot as given', () => {
    const other = webPageTemplate({
      pascal: 'Preparation',
      title: 'Préparation · Tâche 2',
      fileBase: 'preparation',
    });
    expect(other).toContain("export const metadata = { title: 'Préparation · Tâche 2' };");
  });

  it('default-exports the page component rendering the view', () => {
    expect(source).toMatch(/export default function SujetsDuMoisPage\(/);
    expect(source).toContain('<SujetsDuMoisView />');
  });

  it('does not use double-quoted imports', () => {
    expect(source).not.toMatch(/from "/);
  });

  it('uses the given fileBase, pascal and title', () => {
    const other = webPageTemplate({
      pascal: 'Historique',
      title: 'Historique',
      fileBase: 'historique',
    });
    expect(other).toContain("import { HistoriqueView } from './historique-view';");
    expect(other).toContain("export const metadata = { title: 'Historique' };");
    expect(other).toMatch(/export default function HistoriquePage\(/);
    expect(other).toContain('<HistoriqueView />');
    expect(other).not.toMatch(/SujetsDuMois|du-mois/);
  });
});

describe('webViewTemplate', () => {
  let source;
  beforeAll(() => {
    source = webViewTemplate({
      pascal: 'SujetsDuMois',
      title: 'Sujets du mois',
    });
  });

  it('starts with the use client directive', () => {
    expect(source.split('\n')[0]).toBe("'use client';");
  });

  it('imports PageShell through the @/ alias with single quotes', () => {
    expect(source).toMatch(/import \{ PageShell \} from '@\/components\/app\/page-shell';/);
    expect(source).not.toMatch(/from "/);
  });

  it('exports the view component rendering PageShell with the title', () => {
    expect(source).toMatch(/export function SujetsDuMoisView\(/);
    expect(source).toContain('<PageShell title="Sujets du mois">');
  });

  it('escapes double quotes in the title for the JSX attribute', () => {
    const other = webViewTemplate({
      pascal: 'Quotes',
      title: 'Le "grand" test',
    });
    expect(other).toContain('<PageShell title="Le &quot;grand&quot; test">');
    expect(other).not.toContain('"grand"');
  });

  it('leaves a title without double quotes unescaped', () => {
    const other = webViewTemplate({
      pascal: 'Prep',
      title: 'Préparation · Tâche 2',
    });
    expect(other).toContain('<PageShell title="Préparation · Tâche 2">');
    expect(other).not.toContain('&quot;');
    expect(other).toMatch(/export function PrepView\(/);
  });
});

describe('packageFiles', () => {
  let files;
  beforeAll(() => {
    files = packageFiles({ kebab: 'exam-utils' });
  });

  it('returns exactly the expected file paths', () => {
    expect(Object.keys(files).sort()).toEqual(
      [
        'package.json',
        'tsconfig.json',
        'tsconfig.build.json',
        'eslint.config.mjs',
        'vitest.config.ts',
        'src/index.ts',
      ].sort()
    );
  });

  it('returns non-empty string contents for every file', () => {
    for (const contents of Object.values(files)) {
      expect(typeof contents).toBe('string');
      expect(contents.trim()).not.toBe('');
    }
  });

  it('writes a package.json with the required fields', () => {
    const pkg = JSON.parse(files['package.json']);
    expect(pkg.name).toBe('@parle-tcf/exam-utils');
    expect(pkg.private).toBe(true);
    expect(pkg.main).toBe('./dist/index.js');
    expect(pkg.types).toBe('./dist/index.d.ts');
    for (const script of ['build', 'typecheck', 'lint', 'format', 'format:check', 'test']) {
      expect(typeof pkg.scripts[script]).toBe('string');
      expect(pkg.scripts[script].trim()).not.toBe('');
    }
  });

  it('writes a strict tsconfig.json', () => {
    const tsconfig = JSON.parse(files['tsconfig.json']);
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('names the package after the given kebab', () => {
    const other = packageFiles({ kebab: 'scoring' });
    expect(JSON.parse(other['package.json']).name).toBe('@parle-tcf/scoring');
  });
});
