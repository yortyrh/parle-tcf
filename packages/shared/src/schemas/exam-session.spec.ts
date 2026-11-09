import { describe, expect, it } from "vitest";
import { createExamSessionInputSchema, taskTypeSchema } from "./exam-session";

describe("taskTypeSchema", () => {
  it("accepts the three TCF speaking tasks", () => {
    for (const task of ["tache1", "tache2", "tache3"]) {
      expect(taskTypeSchema.parse(task)).toBe(task);
    }
  });

  it("rejects unknown task types", () => {
    expect(taskTypeSchema.safeParse("tache4").success).toBe(false);
  });
});

describe("createExamSessionInputSchema", () => {
  it("makes exerciseId optional", () => {
    expect(createExamSessionInputSchema.parse({ taskType: "tache1" })).toEqual({
      taskType: "tache1",
    });
  });
});
