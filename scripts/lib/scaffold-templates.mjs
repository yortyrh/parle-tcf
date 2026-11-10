/**
 * File templates for the scaffold scripts (scripts/scaffold.mjs).
 * API and shared code: double quotes, ESM relative imports ending in `.js`.
 * Web code: single quotes, `@/` alias. Prettier runs on every generated file afterwards.
 */

/** @param {{ pascal: string }} names */
export function sharedSchemaTemplate({ pascal }) {
  return `import { z } from "zod";

export const list${pascal}InputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
});

export const list${pascal}ItemSchema = z.object({
  id: z.string(),
});

export const list${pascal}OutputSchema = z.object({
  items: z.array(list${pascal}ItemSchema),
});

export type List${pascal}Input = z.infer<typeof list${pascal}InputSchema>;
export type List${pascal}Output = z.infer<typeof list${pascal}OutputSchema>;
`;
}

/** @param {{ kebab: string, camel: string, pascal: string }} names */
export function apiControllerTemplate({ kebab, camel, pascal }) {
  return `import { Controller, Req, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { currentUserId } from "../auth/current-user.js";
import {
  type AuthenticatedRequest,
  SessionAuthGuard,
} from "../auth/session-auth.guard.js";
import { ${camel}ListProcedure } from "../contract/exam.contract.js";
import { ${pascal}Service } from "./${kebab}.service.js";

@Controller()
@UseGuards(SessionAuthGuard)
export class ${pascal}Controller {
  constructor(private readonly ${camel}: ${pascal}Service) {}

  @Implement(${camel}ListProcedure)
  list(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(${camel}ListProcedure).handler(({ input }) =>
      this.${camel}.list(userId, input),
    );
  }
}
`;
}

/** @param {{ pascal: string }} names */
export function apiServiceTemplate({ pascal }) {
  return `import { Injectable } from "@nestjs/common";
import type { List${pascal}Input, List${pascal}Output } from "@parle-tcf/shared";

@Injectable()
export class ${pascal}Service {
  // TODO: inject DATABASE and filter every query by userId (no RLS: isolation lives in the API).
  async list(userId: string, input: List${pascal}Input): Promise<List${pascal}Output> {
    void userId;
    void input;
    return { items: [] };
  }
}
`;
}

/** @param {{ pascal: string, title: string, fileBase: string }} opts */
export function webPageTemplate({ pascal, title, fileBase }) {
  return `import { ${pascal}View } from './${fileBase}-view';

export const metadata = { title: '${title.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' };

export default function ${pascal}Page() {
  return <${pascal}View />;
}
`;
}

/** @param {{ pascal: string, title: string }} opts */
export function webViewTemplate({ pascal, title }) {
  const attr = title.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `'use client';

import { PageShell } from '@/components/app/page-shell';

export function ${pascal}View() {
  return (
    <PageShell title="${attr}">
      <p className="text-muted-foreground">À compléter.</p>
    </PageShell>
  );
}
`;
}

/** @param {{ kebab: string }} names */
export function packageFiles({ kebab }) {
  const pkg = {
    name: `@parle-tcf/${kebab}`,
    version: "0.0.0",
    private: true,
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    files: ["dist"],
    scripts: {
      build: "tsc -p tsconfig.build.json",
      typecheck: "tsc --noEmit",
      lint: 'eslint "src/**/*.ts"',
      format: 'prettier --write "src/**/*.ts"',
      "format:check": 'prettier --check "src/**/*.ts"',
      test: "vitest run --passWithNoTests",
    },
  };
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "CommonJS",
      lib: ["ES2022"],
      declaration: true,
      outDir: "dist",
      rootDir: "src",
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ["src/**/*.ts"],
  };
  const tsconfigBuild = {
    extends: "./tsconfig.json",
    exclude: ["src/**/*.spec.ts", "src/**/*.test.ts"],
  };
  return {
    "package.json": `${JSON.stringify(pkg, null, 2)}\n`,
    "tsconfig.json": `${JSON.stringify(tsconfig, null, 2)}\n`,
    "tsconfig.build.json": `${JSON.stringify(tsconfigBuild, null, 2)}\n`,
    "eslint.config.mjs": `import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended, {
  ignores: ["dist/**", "node_modules/**", "coverage/**"],
});
`,
    "vitest.config.ts": `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{spec,test}.ts"],
  },
});
`,
    "src/index.ts": `export const PACKAGE_NAME = "@parle-tcf/${kebab}";
`,
  };
}
