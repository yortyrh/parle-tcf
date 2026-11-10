import { beforeAll, describe, expect, it } from 'vitest';
import {
  addApiRoute,
  addContractProcedure,
  addJsExtensions,
  addSharedExport,
} from './scaffold-transforms.mjs';

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

describe('addJsExtensions', () => {
  it('adds .js to a single-quoted relative named import', () => {
    expect(addJsExtensions("import { A } from './a';")).toBe("import { A } from './a.js';");
  });

  it('adds .js to a double-quoted parent-relative import', () => {
    expect(addJsExtensions('import { B } from "../b/b.service";')).toBe(
      'import { B } from "../b/b.service.js";'
    );
  });

  it('adds .js to an export-star specifier', () => {
    expect(addJsExtensions("export * from './x';")).toBe("export * from './x.js';");
  });

  it('adds .js to a named re-export specifier', () => {
    expect(addJsExtensions('export { X, Y as Z } from "./x/y";')).toBe(
      'export { X, Y as Z } from "./x/y.js";'
    );
  });

  it('adds .js to a side-effect import', () => {
    expect(addJsExtensions("import './side';")).toBe("import './side.js';");
    expect(addJsExtensions('import "../side";')).toBe('import "../side.js";');
  });

  it('adds .js to default, namespace and type-only imports', () => {
    expect(addJsExtensions('import a from "./a";')).toBe('import a from "./a.js";');
    expect(addJsExtensions('import * as ns from "./ns";')).toBe('import * as ns from "./ns.js";');
    expect(addJsExtensions('import type { T } from "./types";')).toBe(
      'import type { T } from "./types.js";'
    );
  });

  it('adds .js to a specifier whose name contains a dot but no real extension', () => {
    expect(addJsExtensions('import { M } from "./foo.module";')).toBe(
      'import { M } from "./foo.module.js";'
    );
    expect(addJsExtensions("import { G } from '../auth/session-auth.guard';")).toBe(
      "import { G } from '../auth/session-auth.guard.js';"
    );
  });

  it('rewrites multi-line import lists', () => {
    const source = [
      'import {',
      '  type AuthenticatedRequest,',
      '  SessionAuthGuard,',
      '} from "../auth/session-auth.guard";',
      '',
    ].join('\n');
    expect(addJsExtensions(source)).toBe(
      [
        'import {',
        '  type AuthenticatedRequest,',
        '  SessionAuthGuard,',
        '} from "../auth/session-auth.guard.js";',
        '',
      ].join('\n')
    );
  });

  it.each([
    "import { A } from './a.js';",
    'import { A } from "./a.mjs";',
    'import { A } from "./a.cjs";',
    "import data from './data.json';",
    'import { Controller } from "@nestjs/common";',
    "import { readFileSync } from 'node:fs';",
    'import { z } from "zod";',
    'export * from "@parle-tcf/shared";',
    "import 'reflect-metadata';",
  ])('leaves %s unchanged', (source) => {
    expect(addJsExtensions(source)).toBe(source);
  });

  it('does not touch relative-looking strings that are not module specifiers', () => {
    const source = [
      "const p = './a';",
      'const q = "../b/c";',
      "const msg = 'see ./docs from here';",
      '',
    ].join('\n');
    expect(addJsExtensions(source)).toBe(source);
  });

  it('rewrites a whole file and keeps every other line intact', () => {
    const source = [
      'import { Module } from "@nestjs/common";',
      'import {',
      '  ExerciseBankController,',
      '} from "./exercise-bank.controller";',
      'import { ExerciseBankService } from "./exercise-bank.service";',
      'import { DatabaseModule } from "../database/database.module.js";',
      "import config from './config.json';",
      "import './polyfill';",
      'export * from "./types";',
      '',
      "const relative = './not-an-import';",
      '',
      '@Module({',
      '  imports: [DatabaseModule],',
      '  controllers: [ExerciseBankController],',
      '  providers: [ExerciseBankService],',
      '})',
      'export class ExerciseBankModule {}',
      '',
    ].join('\n');
    const expected = [
      'import { Module } from "@nestjs/common";',
      'import {',
      '  ExerciseBankController,',
      '} from "./exercise-bank.controller.js";',
      'import { ExerciseBankService } from "./exercise-bank.service.js";',
      'import { DatabaseModule } from "../database/database.module.js";',
      "import config from './config.json';",
      "import './polyfill.js';",
      'export * from "./types.js";',
      '',
      "const relative = './not-an-import';",
      '',
      '@Module({',
      '  imports: [DatabaseModule],',
      '  controllers: [ExerciseBankController],',
      '  providers: [ExerciseBankService],',
      '})',
      'export class ExerciseBankModule {}',
      '',
    ].join('\n');
    expect(addJsExtensions(source)).toBe(expected);
  });

  it('is idempotent', () => {
    const source = [
      "import { A } from './a';",
      'import { B } from "../b/b.service";',
      "export * from './x';",
      "import './side';",
      'import { M } from "./foo.module";',
      '',
    ].join('\n');
    const once = addJsExtensions(source);
    expect(addJsExtensions(once)).toBe(once);
    expect(once).not.toContain('.js.js');
  });

  it('returns an empty string unchanged', () => {
    expect(addJsExtensions('')).toBe('');
  });
});

const SHARED_INDEX = `export type { TaskType } from "./task-types";
export { TCF_TASK_TYPES, TASK_DURATIONS } from "./task-types";

export * from "./schemas/exam-session";
export * from "./schemas/provider-settings";
export * from "./schemas/attempts";
export * from "./schemas/evaluation";
export * from "./schemas/audio";
export * from "./pricing";

/** HTTP route of every API procedure (all POST + JSON, cookie session). */
export const API_ROUTES = {
  sessionCreate: "/exam/session/create",
  settingsGet: "/settings/get",
  settingsUpsert: "/settings/upsert",
  settingsDelete: "/settings/delete",
  settingsTest: "/settings/test",
  attemptsCheckpoint: "/attempts/checkpoint",
  attemptsComplete: "/attempts/complete",
  attemptsList: "/attempts/list",
  attemptsGet: "/attempts/get",
  attemptsDelete: "/attempts/delete",
  attemptsReevaluate: "/attempts/reevaluate",
  usageGet: "/usage/get",
  audioStatus: "/audio/status",
  audioSetConsent: "/audio/consent",
  audioUploadUrl: "/audio/upload-url",
  audioDownloadUrl: "/audio/download-url",
} as const;
`;

describe('addSharedExport', () => {
  it('inserts the export right after the last schemas export', () => {
    const expected = SHARED_INDEX.replace(
      'export * from "./schemas/audio";\n',
      'export * from "./schemas/audio";\nexport * from "./schemas/exercise-bank";\n'
    );
    expect(addSharedExport(SHARED_INDEX, 'exercise-bank')).toBe(expected);
  });

  it('uses the last schemas line even when it is the last line of the file', () => {
    const source = 'export * from "./schemas/a";\nexport * from "./schemas/b";\n';
    expect(addSharedExport(source, 'c')).toBe(
      'export * from "./schemas/a";\nexport * from "./schemas/b";\nexport * from "./schemas/c";\n'
    );
  });

  it('inserts after the last schemas line, not after the first one', () => {
    const source = [
      'export * from "./schemas/a";',
      'export * from "./other";',
      'export * from "./schemas/b";',
      'export const X = 1;',
      '',
    ].join('\n');
    expect(addSharedExport(source, 'c')).toBe(
      [
        'export * from "./schemas/a";',
        'export * from "./other";',
        'export * from "./schemas/b";',
        'export * from "./schemas/c";',
        'export const X = 1;',
        '',
      ].join('\n')
    );
  });

  it('is a no-op when the export already exists', () => {
    const once = addSharedExport(SHARED_INDEX, 'exercise-bank');
    expect(addSharedExport(once, 'exercise-bank')).toBe(once);
    expect(addSharedExport(SHARED_INDEX, 'audio')).toBe(SHARED_INDEX);
  });

  it('does not treat a different schema name with the same prefix as existing', () => {
    const source = 'export * from "./schemas/audio-extra";\n';
    expect(addSharedExport(source, 'audio')).toBe(
      'export * from "./schemas/audio-extra";\nexport * from "./schemas/audio";\n'
    );
  });

  it('throws when there is no schemas export line', () => {
    const source = 'export * from "./pricing";\nexport const API_ROUTES = {} as const;\n';
    expect(() => addSharedExport(source, 'exercise-bank')).toThrow(Error);
    expect(() => addSharedExport('', 'exercise-bank')).toThrow(Error);
  });
});

const API_ROUTES_EXERCISE_BANK = SHARED_INDEX.replace(
  '  audioDownloadUrl: "/audio/download-url",\n} as const;',
  '  audioDownloadUrl: "/audio/download-url",\n  exerciseBankList: "/exercise-bank/list",\n} as const;'
);

describe('addApiRoute', () => {
  it('appends the list route as the last API_ROUTES entry', () => {
    expect(addApiRoute(SHARED_INDEX, EXERCISE_BANK)).toBe(API_ROUTES_EXERCISE_BANK);
  });

  it('builds the key from camel and the path from kebab', () => {
    const source = 'export const API_ROUTES = {\n  usageGet: "/usage/get",\n} as const;\n';
    expect(addApiRoute(source, SUJETS_DU_MOIS)).toBe(
      'export const API_ROUTES = {\n  usageGet: "/usage/get",\n  sujetsDuMoisList: "/sujets-du-mois/list",\n} as const;\n'
    );
  });

  it('inserts into API_ROUTES even when other `as const` objects surround it', () => {
    const source = [
      'export const BEFORE = {',
      '  a: "a",',
      '} as const;',
      '',
      'export const API_ROUTES = {',
      '  usageGet: "/usage/get",',
      '} as const;',
      '',
      'export const AFTER = {',
      '  b: "b",',
      '} as const;',
      '',
    ].join('\n');
    expect(addApiRoute(source, EXERCISE_BANK)).toBe(
      [
        'export const BEFORE = {',
        '  a: "a",',
        '} as const;',
        '',
        'export const API_ROUTES = {',
        '  usageGet: "/usage/get",',
        '  exerciseBankList: "/exercise-bank/list",',
        '} as const;',
        '',
        'export const AFTER = {',
        '  b: "b",',
        '} as const;',
        '',
      ].join('\n')
    );
  });

  it('is idempotent', () => {
    const once = addApiRoute(SHARED_INDEX, EXERCISE_BANK);
    expect(addApiRoute(once, EXERCISE_BANK)).toBe(once);
  });

  it('is a no-op when the list key already exists, whatever its value', () => {
    const source =
      'export const API_ROUTES = {\n  exerciseBankList: "/custom/path",\n  usageGet: "/usage/get",\n} as const;\n';
    expect(addApiRoute(source, EXERCISE_BANK)).toBe(source);
  });

  it('does not mistake a key with the same suffix for an existing one', () => {
    const source =
      'export const API_ROUTES = {\n  otherExerciseBankList: "/other/list",\n} as const;\n';
    expect(addApiRoute(source, EXERCISE_BANK)).toBe(
      'export const API_ROUTES = {\n  otherExerciseBankList: "/other/list",\n  exerciseBankList: "/exercise-bank/list",\n} as const;\n'
    );
  });

  it('throws when API_ROUTES is missing', () => {
    expect(() =>
      addApiRoute(
        'export const ROUTES = {\n  usageGet: "/usage/get",\n} as const;\n',
        EXERCISE_BANK
      )
    ).toThrow(Error);
    expect(() => addApiRoute('', EXERCISE_BANK)).toThrow(Error);
  });
});

// Copied from apps/api/src/contract/exam.contract.ts.
const CONTRACT = `import { oc, populateContractRouterPaths } from "@orpc/contract";
import {
  API_ROUTES,
  attemptDetailSchema,
  attemptIdInputSchema,
  audioDownloadOutputSchema,
  audioStatusSchema,
  audioUploadInputSchema,
  audioUploadOutputSchema,
  setAudioConsentInputSchema,
  checkpointAttemptInputSchema,
  completeAttemptInputSchema,
  createExamSessionInputSchema,
  createExamSessionOutputSchema,
  listAttemptsInputSchema,
  listAttemptsOutputSchema,
  okOutputSchema,
  providerSettingsSchema,
  usageSchema,
  testProviderSettingsOutputSchema,
  upsertProviderSettingsInputSchema,
} from "@parle-tcf/shared";
import { z } from "zod";

const post = (path: \`/\${string}\`) => oc.route({ method: "POST", path });

export const createExamSessionProcedure = post(API_ROUTES.sessionCreate)
  .input(createExamSessionInputSchema)
  .output(createExamSessionOutputSchema);

export const settingsGetProcedure = post(API_ROUTES.settingsGet)
  .input(z.object({}).optional())
  .output(providerSettingsSchema);
export const settingsUpsertProcedure = post(API_ROUTES.settingsUpsert)
  .input(upsertProviderSettingsInputSchema)
  .output(providerSettingsSchema);
export const settingsDeleteProcedure = post(API_ROUTES.settingsDelete)
  .input(z.object({}).optional())
  .output(okOutputSchema);
export const settingsTestProcedure = post(API_ROUTES.settingsTest)
  .input(z.object({}).optional())
  .output(testProviderSettingsOutputSchema);

export const attemptsCheckpointProcedure = post(API_ROUTES.attemptsCheckpoint)
  .input(checkpointAttemptInputSchema)
  .output(okOutputSchema);
export const attemptsCompleteProcedure = post(API_ROUTES.attemptsComplete)
  .input(completeAttemptInputSchema)
  .output(okOutputSchema);
export const attemptsListProcedure = post(API_ROUTES.attemptsList)
  .input(listAttemptsInputSchema)
  .output(listAttemptsOutputSchema);
export const attemptsGetProcedure = post(API_ROUTES.attemptsGet)
  .input(attemptIdInputSchema)
  .output(attemptDetailSchema);
export const attemptsDeleteProcedure = post(API_ROUTES.attemptsDelete)
  .input(attemptIdInputSchema)
  .output(okOutputSchema);

export const attemptsReevaluateProcedure = post(API_ROUTES.attemptsReevaluate)
  .input(attemptIdInputSchema)
  .output(okOutputSchema);
export const usageGetProcedure = post(API_ROUTES.usageGet)
  .input(z.object({}).optional())
  .output(usageSchema);

export const audioStatusProcedure = post(API_ROUTES.audioStatus)
  .input(z.object({}).optional())
  .output(audioStatusSchema);
export const audioSetConsentProcedure = post(API_ROUTES.audioSetConsent)
  .input(setAudioConsentInputSchema)
  .output(audioStatusSchema);
export const audioUploadUrlProcedure = post(API_ROUTES.audioUploadUrl)
  .input(audioUploadInputSchema)
  .output(audioUploadOutputSchema);
export const audioDownloadUrlProcedure = post(API_ROUTES.audioDownloadUrl)
  .input(attemptIdInputSchema)
  .output(audioDownloadOutputSchema);

export const examContract = populateContractRouterPaths({
  exam: { session: { create: createExamSessionProcedure } },
  settings: {
    get: settingsGetProcedure,
    upsert: settingsUpsertProcedure,
    delete: settingsDeleteProcedure,
    test: settingsTestProcedure,
  },
  attempts: {
    checkpoint: attemptsCheckpointProcedure,
    complete: attemptsCompleteProcedure,
    list: attemptsListProcedure,
    get: attemptsGetProcedure,
    delete: attemptsDeleteProcedure,
    reevaluate: attemptsReevaluateProcedure,
  },
  usage: { get: usageGetProcedure },
  audio: {
    status: audioStatusProcedure,
    setConsent: audioSetConsentProcedure,
    uploadUrl: audioUploadUrlProcedure,
    downloadUrl: audioDownloadUrlProcedure,
  },
});
`;

const CONTRACT_SHARED_NAMES = [
  'API_ROUTES',
  'attemptDetailSchema',
  'attemptIdInputSchema',
  'audioDownloadOutputSchema',
  'audioStatusSchema',
  'audioUploadInputSchema',
  'audioUploadOutputSchema',
  'setAudioConsentInputSchema',
  'checkpointAttemptInputSchema',
  'completeAttemptInputSchema',
  'createExamSessionInputSchema',
  'createExamSessionOutputSchema',
  'listAttemptsInputSchema',
  'listAttemptsOutputSchema',
  'okOutputSchema',
  'providerSettingsSchema',
  'usageSchema',
  'testProviderSettingsOutputSchema',
  'upsertProviderSettingsInputSchema',
];

// Abridged fixture from the spec.
const ABRIDGED_CONTRACT = `import { oc, populateContractRouterPaths } from "@orpc/contract";
import {
  API_ROUTES,
  okOutputSchema,
  usageSchema,
} from "@parle-tcf/shared";
import { z } from "zod";

const post = (path: \`/\${string}\`) => oc.route({ method: "POST", path });

export const usageGetProcedure = post(API_ROUTES.usageGet)
  .input(z.object({}).optional())
  .output(usageSchema);

export const examContract = populateContractRouterPaths({
  exam: { session: { create: createExamSessionProcedure } },
  usage: { get: usageGetProcedure },
});
`;

const SHARED_IMPORT = /import\s*\{([^}]*)\}\s*from\s*"@parle-tcf\/shared";/;

/** Names listed in the `@parle-tcf/shared` import. */
function sharedImportNames(source) {
  const match = source.match(SHARED_IMPORT);
  if (!match) throw new Error('no @parle-tcf/shared import');
  return match[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/** The source with the `@parle-tcf/shared` import replaced by a placeholder. */
function withoutSharedImport(source) {
  return source.replace(SHARED_IMPORT, '<SHARED_IMPORT>');
}

/** Expected output for everything outside the shared import. */
function expectedBody(source, names, lastRouterLine) {
  const block = [
    `export const ${names.camel}ListProcedure = post(API_ROUTES.${names.camel}List)`,
    `  .input(list${names.pascal}InputSchema)`,
    `  .output(list${names.pascal}OutputSchema);`,
    '',
    '',
  ].join('\n');
  return withoutSharedImport(source)
    .replace('export const examContract', `${block}export const examContract`)
    .replace(
      `${lastRouterLine}\n});`,
      `${lastRouterLine}\n  ${names.camel}: { list: ${names.camel}ListProcedure },\n});`
    );
}

describe('addContractProcedure', () => {
  describe('on the real exam.contract.ts', () => {
    let result;
    beforeAll(() => {
      result = addContractProcedure(CONTRACT, EXERCISE_BANK);
    });

    it('adds both schemas to the shared import and keeps every existing name', () => {
      const names = sharedImportNames(result);
      expect([...names].sort()).toEqual(
        [
          ...CONTRACT_SHARED_NAMES,
          'listExerciseBankInputSchema',
          'listExerciseBankOutputSchema',
        ].sort()
      );
    });

    it('keeps the existing shared names in their original order', () => {
      const names = sharedImportNames(result).filter((name) =>
        CONTRACT_SHARED_NAMES.includes(name)
      );
      expect(names).toEqual(CONTRACT_SHARED_NAMES);
    });

    it('inserts the procedure before examContract and the router entry last, leaving the rest intact', () => {
      expect(withoutSharedImport(result)).toBe(
        expectedBody(CONTRACT, EXERCISE_BANK, '    downloadUrl: audioDownloadUrlProcedure,\n  },')
      );
    });

    it('places the procedure block right before examContract, followed by a blank line', () => {
      expect(result).toContain(
        [
          '  .output(audioDownloadOutputSchema);',
          '',
          'export const exerciseBankListProcedure = post(API_ROUTES.exerciseBankList)',
          '  .input(listExerciseBankInputSchema)',
          '  .output(listExerciseBankOutputSchema);',
          '',
          'export const examContract = populateContractRouterPaths({',
        ].join('\n')
      );
    });

    it('adds the router entry as the last property of the contract', () => {
      expect(
        result.endsWith(
          [
            '    downloadUrl: audioDownloadUrlProcedure,',
            '  },',
            '  exerciseBank: { list: exerciseBankListProcedure },',
            '});',
            '',
          ].join('\n')
        )
      ).toBe(true);
    });

    it('declares the procedure and the router entry exactly once', () => {
      expect(result.match(/export const exerciseBankListProcedure\b/g)).toHaveLength(1);
      expect(result.match(/exerciseBank: \{ list: exerciseBankListProcedure \},/g)).toHaveLength(1);
    });

    it('leaves the other imports untouched', () => {
      expect(
        result.startsWith('import { oc, populateContractRouterPaths } from "@orpc/contract";\n')
      ).toBe(true);
      expect(result).toContain('} from "@parle-tcf/shared";\nimport { z } from "zod";\n');
    });

    it('is idempotent', () => {
      expect(addContractProcedure(result, EXERCISE_BANK)).toBe(result);
    });
  });

  describe('on the abridged contract', () => {
    let result;
    beforeAll(() => {
      result = addContractProcedure(ABRIDGED_CONTRACT, SUJETS_DU_MOIS);
    });

    it('adds both schemas to the shared import and keeps every existing name', () => {
      expect([...sharedImportNames(result)].sort()).toEqual(
        [
          'API_ROUTES',
          'listSujetsDuMoisInputSchema',
          'listSujetsDuMoisOutputSchema',
          'okOutputSchema',
          'usageSchema',
        ].sort()
      );
    });

    it('produces the expected body', () => {
      expect(withoutSharedImport(result)).toBe(
        [
          'import { oc, populateContractRouterPaths } from "@orpc/contract";',
          '<SHARED_IMPORT>',
          'import { z } from "zod";',
          '',
          'const post = (path: `/${string}`) => oc.route({ method: "POST", path });',
          '',
          'export const usageGetProcedure = post(API_ROUTES.usageGet)',
          '  .input(z.object({}).optional())',
          '  .output(usageSchema);',
          '',
          'export const sujetsDuMoisListProcedure = post(API_ROUTES.sujetsDuMoisList)',
          '  .input(listSujetsDuMoisInputSchema)',
          '  .output(listSujetsDuMoisOutputSchema);',
          '',
          'export const examContract = populateContractRouterPaths({',
          '  exam: { session: { create: createExamSessionProcedure } },',
          '  usage: { get: usageGetProcedure },',
          '  sujetsDuMois: { list: sujetsDuMoisListProcedure },',
          '});',
          '',
        ].join('\n')
      );
    });

    it('is idempotent', () => {
      expect(addContractProcedure(result, SUJETS_DU_MOIS)).toBe(result);
    });

    it('can add two different procedures one after the other', () => {
      const both = addContractProcedure(result, EXERCISE_BANK);
      expect([...sharedImportNames(both)].sort()).toEqual(
        [
          'API_ROUTES',
          'listExerciseBankInputSchema',
          'listExerciseBankOutputSchema',
          'listSujetsDuMoisInputSchema',
          'listSujetsDuMoisOutputSchema',
          'okOutputSchema',
          'usageSchema',
        ].sort()
      );
      expect(withoutSharedImport(both)).toContain(
        [
          '  .output(listSujetsDuMoisOutputSchema);',
          '',
          'export const exerciseBankListProcedure = post(API_ROUTES.exerciseBankList)',
          '  .input(listExerciseBankInputSchema)',
          '  .output(listExerciseBankOutputSchema);',
          '',
          'export const examContract = populateContractRouterPaths({',
        ].join('\n')
      );
      expect(
        both.endsWith(
          [
            '  usage: { get: usageGetProcedure },',
            '  sujetsDuMois: { list: sujetsDuMoisListProcedure },',
            '  exerciseBank: { list: exerciseBankListProcedure },',
            '});',
            '',
          ].join('\n')
        )
      ).toBe(true);
    });
  });

  it('is a no-op when the procedure is already declared', () => {
    const source = ABRIDGED_CONTRACT.replace(
      'export const examContract',
      'export const exerciseBankListProcedure = post(API_ROUTES.exerciseBankList)\n  .input(z.object({}))\n  .output(okOutputSchema);\n\nexport const examContract'
    );
    expect(addContractProcedure(source, EXERCISE_BANK)).toBe(source);
  });

  it('throws when the @parle-tcf/shared import is missing', () => {
    const source = ABRIDGED_CONTRACT.replace(
      '} from "@parle-tcf/shared";',
      '} from "./local-schemas.js";'
    );
    expect(() => addContractProcedure(source, EXERCISE_BANK)).toThrow(Error);
  });

  it('throws when export const examContract is missing', () => {
    const source = ABRIDGED_CONTRACT.replace(
      'export const examContract',
      'export const otherContract'
    );
    expect(() => addContractProcedure(source, EXERCISE_BANK)).toThrow(Error);
  });

  it('throws when populateContractRouterPaths({ is missing', () => {
    const source = ABRIDGED_CONTRACT.replace(
      'export const examContract = populateContractRouterPaths({',
      'export const examContract = ({'
    );
    expect(() => addContractProcedure(source, EXERCISE_BANK)).toThrow(Error);
  });
});
