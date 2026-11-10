/**
 * `pnpm exercises:import [--month YYYY-MM ...] [--all] [--file page.html --month YYYY-MM] [--dry-run]`
 *
 * - default: discovers the two newest months on the index page and imports them;
 * - `--month`: imports those months (repeatable); `--all`: every discovered month;
 * - `--file`: imports a page saved locally (for example from a browser) for `--month`;
 * - `--dry-run`: parses and prints counts without writing to the database.
 *
 * One plain request per page with a pause between them. When the site refuses the
 * request (401/403/429/503) the run stops and is recorded as `blocked`; it never
 * retries or tries to get around the refusal.
 * Exit codes: 0 success/partial, 1 failed, 2 blocked.
 */
import { readFileSync } from "node:fs";
import { createDb, monthPageUrl } from "@parle-tcf/db";
import { fetchPage } from "./fetch";
import { importSession } from "./import";
import { parseMonthPage } from "./parse";
import { runImport } from "./run";

interface Args {
  months: { year: number; month: number }[];
  all: boolean;
  file?: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { months: [], all: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") args.all = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--file") args.file = argv[++i];
    else if (arg === "--month") {
      const match = /^(\d{4})-(\d{2})$/.exec(argv[++i] ?? "");
      const month = match ? Number(match[2]) : 0;
      if (!match || month < 1 || month > 12)
        throw new Error("--month expects YYYY-MM");
      args.months.push({ year: Number(match[1]), month });
    } else if (arg !== "--") throw new Error(`Unknown argument ${arg}`);
  }
  if (args.file && args.months.length !== 1)
    throw new Error("--file needs exactly one --month");
  return args;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.dryRun) {
    const targets = args.months.length > 0 ? args.months : [];
    if (args.file) {
      const subjects = parseMonthPage(readFileSync(args.file, "utf8"));
      console.log(
        `${args.file}: ${subjects.length} subjects`,
        countByTask(subjects),
      );
      return 0;
    }
    if (targets.length === 0)
      throw new Error("--dry-run needs --file or --month");
    for (const { year, month } of targets) {
      const result = await fetchPage(monthPageUrl(year, month));
      if (result.kind !== "ok") {
        console.log(
          `${year}-${month}: ${result.kind}`,
          "status" in result ? result.status : "",
        );
        if (result.kind === "blocked") return 2;
        continue;
      }
      const subjects = parseMonthPage(result.html);
      console.log(
        `${year}-${month}: ${subjects.length} subjects`,
        countByTask(subjects),
      );
    }
    return 0;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const handle = createDb({ url, max: 2 });
  try {
    if (args.file) {
      const [{ year, month }] = args.months;
      const subjects = parseMonthPage(readFileSync(args.file, "utf8"));
      const result = await importSession(
        handle.db,
        { year, month, sourceUrl: monthPageUrl(year, month) },
        subjects,
      );
      console.log(`${args.file}: ${subjects.length} subjects`, result);
      return 0;
    }
    const summary = await runImport({
      db: handle.db,
      months: args.months.length > 0 ? args.months : undefined,
      all: args.all,
      trigger: process.env.RAILWAY_CRON_SCHEDULE ? "cron" : "cli",
    });
    console.log(JSON.stringify(summary, null, 2));
    return summary.status === "blocked"
      ? 2
      : summary.status === "failed"
        ? 1
        : 0;
  } finally {
    await handle.close();
  }
}

function countByTask(subjects: { task: number }[]) {
  return {
    tache2: subjects.filter((s) => s.task === 2).length,
    tache3: subjects.filter((s) => s.task === 3).length,
  };
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
