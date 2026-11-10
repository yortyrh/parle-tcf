#!/usr/bin/env node
/**
 * Project scaffolds. Generate first with the real tools, then edit (see CLAUDE.md "Tooling first").
 *
 *   pnpm scaffold:api-feature <kebab-name>         Nest module/service/controller + oRPC contract + shared schemas
 *   pnpm scaffold:web-page <route> [--title "…"]   Next.js App Router page + client view in app/(app)/<route>
 *   pnpm scaffold:package <kebab-name>             New workspace package in packages/<name>
 *   pnpm scaffold:smoke                            Runs every scaffold on a throw-away name, typechecks, reverts
 *
 * Generators never write tests: tests come from the test agent (CLAUDE.md "Tests, agents").
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { routeToNames, toNames } from "./lib/scaffold-names.mjs";
import {
  apiControllerTemplate,
  apiServiceTemplate,
  packageFiles,
  sharedSchemaTemplate,
  webPageTemplate,
  webViewTemplate,
} from "./lib/scaffold-templates.mjs";
import {
  addApiRoute,
  addContractProcedure,
  addJsExtensions,
  addSharedExport,
} from "./lib/scaffold-transforms.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = join(ROOT, "apps/api");
const WEB = join(ROOT, "apps/web");
const SHARED = join(ROOT, "packages/shared");

function fail(message) {
  console.error(`\nscaffold: ${message}`);
  process.exit(1);
}

function run(command, args, cwd = ROOT) {
  console.log(
    `$ ${command} ${args.join(" ")}${cwd === ROOT ? "" : `   (in ${relative(ROOT, cwd)})`}`,
  );
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  // Throw (not exit) so scaffold:smoke's `finally` still reverts the tree.
  if (result.error)
    throw new Error(`could not run ${command}: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} exited with ${result.status}`,
    );
}

const read = (path) => readFileSync(path, "utf8");
function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}
const edit = (path, transform) => write(path, transform(read(path)));

function format(paths) {
  run("pnpm", ["exec", "prettier", "--write", "--log-level", "warn", ...paths]);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--") continue;
    if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i];
    else positional.push(argv[i]);
  }
  return { positional, flags };
}

function apiFeature(name) {
  const names = toNames(name);
  const dir = join(API, "src", names.kebab);
  if (existsSync(dir)) fail(`${relative(ROOT, dir)} already exists.`);

  // 1. Nest CLI: module (registered in AppModule), then service and controller (registered in the module).
  for (const schematic of ["module", "service", "controller"]) {
    run(
      "pnpm",
      ["exec", "nest", "g", schematic, names.kebab, "--no-spec"],
      API,
    );
  }
  // 2. Schematics emit extensionless imports; the API is ESM (Node16) and needs `.js`.
  const moduleFile = join(dir, `${names.kebab}.module.ts`);
  const appModule = join(API, "src/app.module.ts");
  edit(moduleFile, addJsExtensions);
  edit(appModule, addJsExtensions);
  // 3. oRPC wiring: shared schemas + route, contract procedure, controller implementing it.
  write(
    join(dir, `${names.kebab}.controller.ts`),
    apiControllerTemplate(names),
  );
  write(join(dir, `${names.kebab}.service.ts`), apiServiceTemplate(names));
  const schemaFile = join(SHARED, "src/schemas", `${names.kebab}.ts`);
  write(schemaFile, sharedSchemaTemplate(names));
  const sharedIndex = join(SHARED, "src/index.ts");
  edit(sharedIndex, (s) => addApiRoute(addSharedExport(s, names.kebab), names));
  const contract = join(API, "src/contract/exam.contract.ts");
  edit(contract, (s) => addContractProcedure(s, names));

  const touched = [
    moduleFile,
    appModule,
    join(dir, `${names.kebab}.controller.ts`),
    join(dir, `${names.kebab}.service.ts`),
    schemaFile,
    sharedIndex,
    contract,
  ];
  format(touched);
  console.log(
    `\nCreated feature "${names.kebab}" (POST /${names.kebab}/list).`,
  );
  console.log(
    "Next: pnpm --filter @parle-tcf/shared build, then let the test agent write specs (test commit first).",
  );
  return touched;
}

function webPage(route, title) {
  const names = routeToNames(route);
  const dir = join(WEB, "app/(app)", ...names.segments);
  if (existsSync(join(dir, "page.tsx")))
    fail(`${relative(ROOT, dir)}/page.tsx already exists.`);
  const fileBase = names.segments.at(-1);
  const pageTitle = title ?? names.pascal;
  const page = join(dir, "page.tsx");
  const view = join(dir, `${fileBase}-view.tsx`);
  write(
    page,
    webPageTemplate({ pascal: names.pascal, title: pageTitle, fileBase }),
  );
  write(view, webViewTemplate({ pascal: names.pascal, title: pageTitle }));
  format([page, view]);
  console.log(
    `\nCreated /${names.route}. Add it to the navigation in components/app/page-shell.tsx if needed.`,
  );
  return [page, view];
}

function workspacePackage(name) {
  const names = toNames(name);
  const dir = join(ROOT, "packages", names.kebab);
  if (existsSync(dir)) fail(`${relative(ROOT, dir)} already exists.`);
  const files = Object.entries(packageFiles(names)).map(([file, contents]) => {
    write(join(dir, file), contents);
    return join(dir, file);
  });
  // Dev tooling through pnpm, never by editing package.json by hand.
  run("pnpm", [
    "--filter",
    `@parle-tcf/${names.kebab}`,
    "add",
    "-D",
    "@eslint/js@^9.21.0",
    "eslint@^9.21.0",
    "prettier@^3.4.2",
    "typescript@^5.9.3",
    "typescript-eslint@^8.25.0",
    "vitest@^3.2.4",
  ]);
  format(files);
  console.log(
    `\nCreated packages/${names.kebab}. Depend on it with: pnpm --filter <pkg> add @parle-tcf/${names.kebab}@workspace:*`,
  );
  return files;
}

function gitClean() {
  const out = spawnSync("git", ["status", "--porcelain"], {
    cwd: ROOT,
    encoding: "utf8",
  }).stdout;
  return out.trim() === "";
}

function revert() {
  run("git", ["checkout", "--", "."]);
  run("git", ["clean", "-fdq", "--", "apps", "packages"]);
}

function smoke() {
  if (!gitClean())
    fail(
      "scaffold:smoke needs a clean working tree (it reverts everything afterwards).",
    );
  try {
    apiFeature("scaffold-smoke");
    webPage("scaffold-smoke/demo", 'Démo "smoke"');
    run("pnpm", ["--filter", "@parle-tcf/shared", "build"]);
    run("pnpm", ["--filter", "@parle-tcf/api", "typecheck"]);
    run("pnpm", ["--filter", "@parle-tcf/api", "lint"]);
    run("pnpm", ["--filter", "@parle-tcf/web", "typecheck"]);
    console.log("\nscaffold:smoke OK");
  } finally {
    revert();
    run("pnpm", ["--filter", "@parle-tcf/shared", "build"]);
  }
}

const [command, ...rest] = process.argv.slice(2);
const { positional, flags } = parseArgs(rest);
try {
  switch (command) {
    case "api-feature":
      if (!positional[0]) fail("usage: pnpm scaffold:api-feature <kebab-name>");
      apiFeature(positional[0]);
      break;
    case "web-page":
      if (!positional[0])
        fail('usage: pnpm scaffold:web-page <route> [--title "Titre"]');
      webPage(positional[0], flags.title);
      break;
    case "package":
      if (!positional[0]) fail("usage: pnpm scaffold:package <kebab-name>");
      workspacePackage(positional[0]);
      break;
    case "smoke":
      smoke();
      break;
    default:
      fail("unknown command. Use api-feature, web-page, package or smoke.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
