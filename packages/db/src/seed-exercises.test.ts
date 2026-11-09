import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { exercises } from "./schema";
import { parseExerciseCsv, seedExercises } from "./seed-exercises";
import { createTestDb, type TestDb } from "./testing";

const CSV = `id,taskType,content,url,imageUrl,imagePath,isImageBased
a-1,Tâche 2,"Ligne un,
ligne deux avec ""guillemets"", et virgule",https://example.test/a,,,FALSE
a-2,Tâche 3,Sujet trois,,,,TRUE
a-1,Tâche 2,Doublon,,,,FALSE
a-3,Tâche 9,Tâche inconnue,,,,FALSE
a-4,Tâche 2,,,,,FALSE
`;

describe("parseExerciseCsv", () => {
  it("handles multi-line quoted fields, duplicates and invalid rows", () => {
    const report = parseExerciseCsv(CSV);
    expect(report.rows.map((r) => r.id)).toEqual(["a-1", "a-2"]);
    expect(report.rows[0]?.prompt).toBe(
      'Ligne un,\nligne deux avec "guillemets", et virgule',
    );
    expect(report.rows[0]?.task).toBe(2);
    expect(report.rows[1]?.isImageBased).toBe(true);
    expect(report.duplicateIds).toEqual(["a-1"]);
    expect(report.skipped).toBe(2);
  });

  it("parses the real exercise bank", () => {
    const csv = readFileSync(
      path.resolve(__dirname, "../../../apps/api/config/tcf-exercises.csv"),
      "utf-8",
    );
    const report = parseExerciseCsv(csv);
    expect(report.rows.filter((r) => r.task === 2).length).toBeGreaterThan(
      1000,
    );
    expect(report.rows.filter((r) => r.task === 3).length).toBeGreaterThan(
      1000,
    );
    expect(report.skipped).toBe(0);
  });
});

describe("seedExercises", () => {
  let testDb: TestDb;
  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(async () => {
    await testDb.close();
  });

  it("is idempotent and refreshes text without touching theme", async () => {
    const report = parseExerciseCsv(CSV);
    const first = await seedExercises(testDb.db, report);
    expect(first).toBe(3); // 2 CSV rows + the fixed tâche 1 row

    await testDb.db
      .update(exercises)
      .set({ theme: "famille" })
      .where(eq(exercises.id, "a-1"));

    report.rows[0]!.prompt = "Texte mis à jour";
    await seedExercises(testDb.db, report);

    const [{ n }] = await testDb.db.select({ n: count() }).from(exercises);
    expect(n).toBe(3);
    const [row] = await testDb.db
      .select()
      .from(exercises)
      .where(eq(exercises.id, "a-1"));
    expect(row?.prompt).toBe("Texte mis à jour");
    expect(row?.theme).toBe("famille");
  });
});
