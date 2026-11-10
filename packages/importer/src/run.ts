import { type Database, eq, importRuns, monthPageUrl } from "@parle-tcf/db";
import { fetchPage } from "./fetch";
import { importSession } from "./import";
import { discoverMonthPages, INDEX_URL, parseMonthPage } from "./parse";

export type ImportStatus = "success" | "partial" | "blocked" | "failed";

export interface RunImportOptions {
  db: Database;
  fetchImpl?: typeof fetch;
  /** Explicit months; otherwise discovered from the index page. */
  months?: { year: number; month: number }[];
  /** With discovery: every month instead of the two newest. */
  all?: boolean;
  trigger: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  /** Pause between two requests (politeness). */
  delayMs?: number;
}

export interface ImportSummary {
  id: string;
  status: ImportStatus;
  sessionsScanned: number;
  inserted: number;
  updated: number;
  occurrences: number;
  errors: { url: string; message: string }[];
}

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Imports the monthly pages and records the run in `import_runs`. */
export async function runImport({
  db,
  fetchImpl = fetch,
  months,
  all = false,
  trigger,
  now = () => new Date(),
  sleep = realSleep,
  delayMs = 3000,
}: RunImportOptions): Promise<ImportSummary> {
  const [run] = await db
    .insert(importRuns)
    .values({ trigger, status: "running", startedAt: now() })
    .returning({ id: importRuns.id });

  const totals = {
    sessionsScanned: 0,
    inserted: 0,
    updated: 0,
    occurrences: 0,
  };
  const errors: { url: string; message: string }[] = [];
  let blocked = false;
  let requests = 0;

  const get = async (url: string) => {
    if (requests > 0) await sleep(delayMs);
    requests += 1;
    return fetchPage(url, { fetchImpl });
  };

  let targets: { year: number; month: number }[] = months ?? [];
  if (!months) {
    const index = await get(INDEX_URL);
    if (index.kind === "ok") {
      const discovered = discoverMonthPages(index.html);
      targets = all ? discovered : discovered.slice(0, 2);
    } else {
      if (index.kind === "blocked") blocked = true;
      errors.push({ url: INDEX_URL, message: describe(index) });
    }
  }

  for (const { year, month } of blocked ? [] : targets) {
    const url = monthPageUrl(year, month);
    const page = await get(url);
    if (page.kind === "ok") {
      totals.sessionsScanned += 1;
      const subjects = parseMonthPage(page.html);
      if (subjects.length === 0) {
        errors.push({ url, message: "no subjects found on the page" });
        continue;
      }
      const result = await importSession(
        db,
        { year, month, sourceUrl: url },
        subjects,
        {
          now: now(),
        },
      );
      totals.inserted += result.inserted;
      totals.updated += result.updated;
      totals.occurrences += result.occurrences;
      continue;
    }
    errors.push({ url, message: describe(page) });
    if (page.kind === "blocked") {
      blocked = true;
      break;
    }
  }

  const status: ImportStatus = blocked
    ? "blocked"
    : errors.length > 0 && totals.sessionsScanned === 0
      ? "failed"
      : errors.length > 0
        ? "partial"
        : "success";

  await db
    .update(importRuns)
    .set({ status, finishedAt: now(), ...totals, errors })
    .where(eq(importRuns.id, run.id));

  return { id: run.id, status, ...totals, errors };
}

function describe(result: Awaited<ReturnType<typeof fetchPage>>): string {
  switch (result.kind) {
    case "blocked":
      return `blocked by the site (HTTP ${result.status}); not retried`;
    case "not_found":
      return `page not found (HTTP ${result.status})`;
    case "error":
      return result.message;
    default:
      return "unexpected result";
  }
}
