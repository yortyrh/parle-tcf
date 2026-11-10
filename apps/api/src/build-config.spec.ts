import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The compiled entry point must be `dist/main.js`: `pnpm start`, the Dockerfile
 * CMD and the `.env` lookup in `src/main.ts` (`../.env` from the compiled file)
 * depend on it. Including anything outside `src` in the build (evals, scripts)
 * shifts the output to `dist/src/main.js`.
 */
const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(API_DIR, "src");
const DIST_DIR = join(API_DIR, "dist");
const BUILD_TSCONFIG = join(API_DIR, "tsconfig.build.json");

const readJson = (file: string) =>
  JSON.parse(readFileSync(join(API_DIR, file), "utf8")) as Record<
    string,
    unknown
  >;

const isUnder = (dir: string, file: string) => {
  const rel = relative(dir, resolve(file));
  return rel !== "" && !rel.startsWith("..") && !rel.startsWith(sep);
};

describe("api build config", () => {
  let parsed: ts.ParsedCommandLine;

  beforeAll(() => {
    const result = ts.getParsedCommandLineOfConfigFile(
      BUILD_TSCONFIG,
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (d) => {
          throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
        },
      },
    );
    if (!result) throw new Error("tsconfig.build.json could not be parsed");
    parsed = result;
  });

  describe("tsconfig.build.json", () => {
    it("parses without errors", () => {
      expect(
        parsed.errors.map((d) =>
          ts.flattenDiagnosticMessageText(d.messageText, "\n"),
        ),
      ).toEqual([]);
    });

    it("sets rootDir to the src folder", () => {
      expect(parsed.options.rootDir).toBeDefined();
      expect(resolve(parsed.options.rootDir!)).toBe(SRC_DIR);
    });

    it("emits into the dist folder", () => {
      expect(resolve(parsed.options.outDir!)).toBe(DIST_DIR);
    });

    it("declares an include that only covers src", () => {
      const raw = readJson("tsconfig.build.json");
      const include = raw.include as string[] | undefined;
      expect(include).toBeDefined();
      expect(include!.length).toBeGreaterThan(0);
      for (const pattern of include!) {
        expect(pattern.replace(/^\.\//, "")).toMatch(/^src(\/|$)/);
      }
    });

    it("compiles src/main.ts", () => {
      const files = parsed.fileNames.map((f) => resolve(f));
      expect(files).toContain(join(SRC_DIR, "main.ts"));
    });

    it("compiles only files under src", () => {
      const outside = parsed.fileNames.filter((f) => !isUnder(SRC_DIR, f));
      expect(outside).toEqual([]);
    });

    it("leaves evals and scripts out", () => {
      for (const dir of ["evals", "scripts"]) {
        const inDir = parsed.fileNames.filter((f) =>
          isUnder(join(API_DIR, dir), f),
        );
        expect(inDir).toEqual([]);
      }
    });

    it("excludes spec files, this one included", () => {
      const specs = parsed.fileNames.filter((f) => /\.spec\.ts$/.test(f));
      expect(specs).toEqual([]);
      const files = parsed.fileNames.map((f) => resolve(f));
      expect(files).not.toContain(fileURLToPath(import.meta.url));
    });

    it("maps src/main.ts to dist/main.js", () => {
      const rel = relative(
        resolve(parsed.options.rootDir!),
        join(SRC_DIR, "main.ts"),
      );
      const out = join(
        resolve(parsed.options.outDir!),
        rel.replace(/\.ts$/, ".js"),
      );
      expect(out).toBe(join(DIST_DIR, "main.js"));
      // src/main.ts loads `../.env` relative to the compiled file: apps/api/.env.
      expect(resolve(dirname(out), "..", ".env")).toBe(join(API_DIR, ".env"));
    });
  });

  it("builds with tsconfig.build.json (no other tsConfigPath in nest-cli.json)", () => {
    const nestCli = readJson("nest-cli.json");
    const options = (nestCli.compilerOptions ?? {}) as Record<string, unknown>;
    const tsConfigPath =
      (options.tsConfigPath as string | undefined) ?? "tsconfig.build.json";
    expect(tsConfigPath.replace(/^\.\//, "")).toBe("tsconfig.build.json");
  });

  describe("entry point", () => {
    it.each(["start", "start:prod"])(
      "runs dist/main.js in the %s script",
      (name) => {
        const scripts = readJson("package.json").scripts as Record<
          string,
          string
        >;
        expect(scripts[name]).toBeDefined();
        expect(scripts[name]).toMatch(
          /(^|\s)node\s+(\.\/)?dist\/main\.js(\s|$)/,
        );
      },
    );

    it("runs apps/api/dist/main.js in the Dockerfile CMD", () => {
      const dockerfile = readFileSync(join(API_DIR, "Dockerfile"), "utf8");
      const cmds = dockerfile
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^CMD\s/.test(l));
      expect(cmds).toHaveLength(1);
      expect(cmds[0]).toBe('CMD ["node", "apps/api/dist/main.js"]');
    });
  });
});
