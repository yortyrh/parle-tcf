import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  asc,
  count,
  eq,
  exerciseOccurrences,
  exercises,
  importRuns,
  monthPageUrl,
} from "@parle-tcf/db";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import * as entry from "./index";
import { runImport } from "./run";

const INDEX_URL = "https://reussir-tcfcanada.com/expression-orale/";

// Synthetic subjects written for these tests.
const X = "Je suis votre voisin. Vous me posez des questions sur le quartier.";
const Y =
  "Je suis libraire. Vous cherchez un roman pour votre neveu de dix ans.";
const Z = "Faut-il interdire les voitures dans le centre des grandes villes ?";

const page = (t2: string[], t3: string[] = []) =>
  `<html><body><h2>Tâche 2</h2><h3>Partie 1</h3>${t2
    .map((s) => `<p><strong>${s}</strong></p>`)
    .join("")}<h2>Tâche 3</h2>${t3
    .map((s) => `<p><strong>${s}</strong></p>`)
    .join("")}</body></html>`;

const EMPTY_PAGE =
  "<html><body><h2>Tâche 2</h2><p>Pas encore de sujets.</p></body></html>";

const indexPage = (months: [number, number][]) =>
  `<html><body><ul>${months
    .map(([y, m]) => `<li><a href="${monthPageUrl(y, m)}">${m}/${y}</a></li>`)
    .join(
      "",
    )}<li><a href="https://example.com/">ailleurs</a></li></ul></body></html>`;

type Route = { status: number; body?: string } | Error;

function harness(routes: Record<string, Route>) {
  const events: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    events.push(`fetch ${url}`);
    const route = routes[url];
    if (route === undefined) throw new Error(`unexpected request ${url}`);
    if (route instanceof Error) throw route;
    return new Response(route.body ?? "", { status: route.status });
  }) as unknown as typeof fetch;
  const sleep = async (ms: number) => {
    events.push(`sleep ${ms}`);
  };
  return { events, fetchImpl, sleep };
}

const DEC = monthPageUrl(2025, 12);
const NOV = monthPageUrl(2025, 11);
const OCT = monthPageUrl(2025, 10);
const SEP = monthPageUrl(2025, 9);

const FIXED = new Date("2026-03-01T12:00:00.000Z");
const now = () => FIXED;

/** fetch/sleep events must alternate, starting and ending with a fetch. */
function expectSleepsOnlyBetweenRequests(events: string[], delayMs: number) {
  expect(events.length % 2).toBe(1);
  events.forEach((e, i) => {
    if (i % 2 === 0) expect(e.startsWith("fetch ")).toBe(true);
    else expect(e).toBe(`sleep ${delayMs}`);
  });
}

describe("runImport", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.truncateAll();
  });

  const runRows = () =>
    testDb.db.select().from(importRuns).orderBy(asc(importRuns.startedAt));

  it("exports the index URL and runImport from the package entry point", () => {
    expect(entry.INDEX_URL).toBe(INDEX_URL);
    expect(entry.runImport).toBe(runImport);
  });

  it("imports the given months, sleeping only between requests", async () => {
    const h = harness({
      [DEC]: { status: 200, body: page([X, Y], [Z]) },
      [NOV]: { status: 200, body: page([X], [Z]) },
    });
    const result = await runImport({
      db: testDb.db,
      fetchImpl: h.fetchImpl,
      months: [
        { year: 2025, month: 12 },
        { year: 2025, month: 11 },
      ],
      trigger: "cli",
      now,
      sleep: h.sleep,
      delayMs: 7,
    });

    expect(h.events).toEqual([`fetch ${DEC}`, "sleep 7", `fetch ${NOV}`]);
    expect(result).toMatchObject({
      status: "success",
      sessionsScanned: 2,
      inserted: 3,
      updated: 2,
      occurrences: 5,
      errors: [],
    });

    const rows = await runRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: result.id,
      status: "success",
      trigger: "cli",
      sessionsScanned: 2,
      inserted: 3,
      updated: 2,
      occurrences: 5,
      errors: [],
    });
    expect(rows[0]!.finishedAt?.getTime()).toBe(FIXED.getTime());

    const [ex] = await testDb.db.select({ n: count() }).from(exercises);
    const [occ] = await testDb.db
      .select({ n: count() })
      .from(exerciseOccurrences);
    expect(ex!.n).toBe(3);
    expect(occ!.n).toBe(5);
  });

  it("waits 3000 ms between requests by default", async () => {
    const h = harness({
      [DEC]: { status: 200, body: page([X]) },
      [NOV]: { status: 200, body: page([Y]) },
    });
    await runImport({
      db: testDb.db,
      fetchImpl: h.fetchImpl,
      months: [
        { year: 2025, month: 12 },
        { year: 2025, month: 11 },
      ],
      trigger: "cli",
      now,
      sleep: h.sleep,
    });
    expect(h.events).toEqual([`fetch ${DEC}`, "sleep 3000", `fetch ${NOV}`]);
  });

  it("does not sleep for a single request", async () => {
    const h = harness({ [DEC]: { status: 200, body: page([X]) } });
    const result = await runImport({
      db: testDb.db,
      fetchImpl: h.fetchImpl,
      months: [{ year: 2025, month: 12 }],
      trigger: "cli",
      now,
      sleep: h.sleep,
    });
    expect(h.events).toEqual([`fetch ${DEC}`]);
    expect(result.status).toBe("success");
  });

  it("records a running row while the import is in progress", async () => {
    const seen: { status: string; trigger: string }[] = [];
    const h = harness({ [DEC]: { status: 200, body: page([X]) } });
    const fetchImpl = (async (input: string | URL | Request) => {
      const rows = await testDb.db.select().from(importRuns);
      seen.push(...rows.map((r) => ({ status: r.status, trigger: r.trigger })));
      return h.fetchImpl(input);
    }) as unknown as typeof fetch;
    const result = await runImport({
      db: testDb.db,
      fetchImpl,
      months: [{ year: 2025, month: 12 }],
      trigger: "cron",
      now,
      sleep: h.sleep,
    });
    expect(seen).toEqual([{ status: "running", trigger: "cron" }]);
    const [row] = await testDb.db
      .select()
      .from(importRuns)
      .where(eq(importRuns.id, result.id));
    expect(row!.status).toBe("success");
    expect(row!.trigger).toBe("cron");
  });

  it("discovers months from the index and keeps the two newest by default", async () => {
    const h = harness({
      [INDEX_URL]: {
        status: 200,
        body: indexPage([
          [2025, 10],
          [2025, 12],
          [2025, 9],
          [2025, 11],
        ]),
      },
      [DEC]: { status: 200, body: page([X]) },
      [NOV]: { status: 200, body: page([Y]) },
    });
    const result = await runImport({
      db: testDb.db,
      fetchImpl: h.fetchImpl,
      trigger: "cron",
      now,
      sleep: h.sleep,
      delayMs: 5,
    });
    expect(h.events[0]).toBe(`fetch ${INDEX_URL}`);
    expectSleepsOnlyBetweenRequests(h.events, 5);
    expect(h.events).toHaveLength(5);
    expect(
      h.events
        .filter((e, i) => i > 0 && e.startsWith("fetch "))
        .map((e) => e.slice(6))
        .sort(),
    ).toEqual([DEC, NOV].sort());
    expect(result).toMatchObject({
      status: "success",
      sessionsScanned: 2,
      inserted: 2,
      updated: 0,
      occurrences: 2,
      errors: [],
    });
  });

  it("fetches every discovered month with all: true", async () => {
    const h = harness({
      [INDEX_URL]: {
        status: 200,
        body: indexPage([
          [2025, 10],
          [2025, 12],
          [2025, 9],
          [2025, 11],
          [2025, 12],
        ]),
      },
      [DEC]: { status: 200, body: page([X]) },
      [NOV]: { status: 200, body: page([Y]) },
      [OCT]: { status: 200, body: page([Z]) },
      [SEP]: { status: 200, body: page([X, Y]) },
    });
    const result = await runImport({
      db: testDb.db,
      fetchImpl: h.fetchImpl,
      all: true,
      trigger: "cli",
      now,
      sleep: h.sleep,
      delayMs: 1,
    });
    expectSleepsOnlyBetweenRequests(h.events, 1);
    expect(h.events[0]).toBe(`fetch ${INDEX_URL}`);
    expect(
      h.events
        .filter((e, i) => i > 0 && e.startsWith("fetch "))
        .map((e) => e.slice(6))
        .sort(),
    ).toEqual([DEC, NOV, OCT, SEP].sort());
    expect(result).toMatchObject({
      status: "success",
      sessionsScanned: 4,
      inserted: 3,
      updated: 2,
      occurrences: 5,
    });
  });

  it("stops at the first blocked month page without any further request", async () => {
    const h = harness({
      [DEC]: { status: 200, body: page([X]) },
      [NOV]: { status: 403, body: "challenge" },
      [OCT]: { status: 200, body: page([Y]) },
    });
    const result = await runImport({
      db: testDb.db,
      fetchImpl: h.fetchImpl,
      months: [
        { year: 2025, month: 12 },
        { year: 2025, month: 11 },
        { year: 2025, month: 10 },
      ],
      trigger: "cli",
      now,
      sleep: h.sleep,
      delayMs: 2,
    });
    expect(h.events).toEqual([`fetch ${DEC}`, "sleep 2", `fetch ${NOV}`]);
    expect(result.status).toBe("blocked");
    expect(result.sessionsScanned).toBe(1);
    expect(result.inserted).toBe(1);
    expect(result.occurrences).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.url).toBe(NOV);
    expect(result.errors[0]!.message).toContain("403");

    const [row] = await runRows();
    expect(row).toMatchObject({
      status: "blocked",
      sessionsScanned: 1,
      inserted: 1,
      occurrences: 1,
    });
    expect(row!.errors).toEqual(result.errors);
    expect(row!.finishedAt).not.toBeNull();
  });

  it.each([401, 403, 429, 503])(
    "reports blocked for status %i on the first page",
    async (status) => {
      const h = harness({
        [DEC]: { status },
        [NOV]: { status: 200, body: page([X]) },
      });
      const result = await runImport({
        db: testDb.db,
        fetchImpl: h.fetchImpl,
        months: [
          { year: 2025, month: 12 },
          { year: 2025, month: 11 },
        ],
        trigger: "cli",
        now,
        sleep: h.sleep,
      });
      expect(h.events).toEqual([`fetch ${DEC}`]);
      expect(result).toMatchObject({
        status: "blocked",
        sessionsScanned: 0,
        inserted: 0,
        updated: 0,
        occurrences: 0,
      });
      expect(result.errors[0]!.message).toContain(String(status));
    },
  );

  it("stops with blocked when the index is blocked", async () => {
    const h = harness({ [INDEX_URL]: { status: 429 } });
    const result = await runImport({
      db: testDb.db,
      fetchImpl: h.fetchImpl,
      trigger: "cron",
      now,
      sleep: h.sleep,
    });
    expect(h.events).toEqual([`fetch ${INDEX_URL}`]);
    expect(result.status).toBe("blocked");
    expect(result.sessionsScanned).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("429");
    const [row] = await runRows();
    expect(row!.status).toBe("blocked");
  });

  it("fails without month requests when the index cannot be read", async () => {
    const h = harness({ [INDEX_URL]: { status: 500 } });
    const result = await runImport({
      db: testDb.db,
      fetchImpl: h.fetchImpl,
      trigger: "cron",
      now,
      sleep: h.sleep,
    });
    expect(h.events).toEqual([`fetch ${INDEX_URL}`]);
    expect(result.status).toBe("failed");
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it("continues after not found and errors, ending partial", async () => {
    const h = harness({
      [DEC]: { status: 404 },
      [NOV]: { status: 200, body: page([X], [Z]) },
      [OCT]: { status: 500 },
      [SEP]: new Error("socket hang up"),
    });
    const result = await runImport({
      db: testDb.db,
      fetchImpl: h.fetchImpl,
      months: [
        { year: 2025, month: 12 },
        { year: 2025, month: 11 },
        { year: 2025, month: 10 },
        { year: 2025, month: 9 },
      ],
      trigger: "cli",
      now,
      sleep: h.sleep,
      delayMs: 3,
    });
    expect(h.events).toEqual([
      `fetch ${DEC}`,
      "sleep 3",
      `fetch ${NOV}`,
      "sleep 3",
      `fetch ${OCT}`,
      "sleep 3",
      `fetch ${SEP}`,
    ]);
    expect(result).toMatchObject({
      status: "partial",
      sessionsScanned: 1,
      inserted: 2,
      updated: 0,
      occurrences: 2,
    });
    expect(result.errors.map((e) => e.url)).toEqual([DEC, OCT, SEP]);
    expect(result.errors[1]!.message).toContain("500");
    expect(result.errors[2]!.message).toContain("socket hang up");

    const [row] = await runRows();
    expect(row!.status).toBe("partial");
    expect(row!.errors).toEqual(result.errors);
  });

  it("fails when every page errors", async () => {
    const h = harness({ [DEC]: { status: 404 }, [NOV]: { status: 410 } });
    const result = await runImport({
      db: testDb.db,
      fetchImpl: h.fetchImpl,
      months: [
        { year: 2025, month: 12 },
        { year: 2025, month: 11 },
      ],
      trigger: "cli",
      now,
      sleep: h.sleep,
    });
    expect(h.events).toHaveLength(3);
    expect(result).toMatchObject({
      status: "failed",
      sessionsScanned: 0,
      inserted: 0,
      updated: 0,
      occurrences: 0,
    });
    expect(result.errors.map((e) => e.url)).toEqual([DEC, NOV]);
    const [row] = await runRows();
    expect(row!.status).toBe("failed");
  });

  it("records a 'no subjects' error for a page without subjects", async () => {
    const h = harness({
      [DEC]: { status: 200, body: EMPTY_PAGE },
      [NOV]: { status: 200, body: page([X]) },
    });
    const result = await runImport({
      db: testDb.db,
      fetchImpl: h.fetchImpl,
      months: [
        { year: 2025, month: 12 },
        { year: 2025, month: 11 },
      ],
      trigger: "cli",
      now,
      sleep: h.sleep,
    });
    expect(result.status).toBe("partial");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.url).toBe(DEC);
    expect(result.errors[0]!.message).toContain("no subjects");
    expect(result.inserted).toBe(1);
    expect(result.occurrences).toBe(1);
  });

  it("counts updates on a second run and records each run", async () => {
    const routes = {
      [DEC]: { status: 200, body: page([X, Y]) },
      [NOV]: { status: 200, body: page([X]) },
    };
    const months = [
      { year: 2025, month: 12 },
      { year: 2025, month: 11 },
    ];
    const first = await runImport({
      db: testDb.db,
      fetchImpl: harness(routes).fetchImpl,
      months,
      trigger: "cli",
      now,
      sleep: async () => {},
    });
    const second = await runImport({
      db: testDb.db,
      fetchImpl: harness(routes).fetchImpl,
      months,
      trigger: "cli",
      now,
      sleep: async () => {},
    });
    expect(first).toMatchObject({ inserted: 2, updated: 1, occurrences: 3 });
    expect(second).toMatchObject({
      status: "success",
      inserted: 0,
      updated: 3,
      occurrences: 3,
    });
    expect(second.id).not.toBe(first.id);
    const rows = await testDb.db.select().from(importRuns);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.id))).toEqual(
      new Set([first.id, second.id]),
    );
  });
});
