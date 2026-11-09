import { describe, expect, it } from "vitest";
import type { EvaluationOutput } from "@parle-tcf/shared";
import { summarize, type CaseRun, type EvalCase } from "./eval-metrics.js";

const crit = (l: "A2" | "B1" | "B2") => ({
  adequation: { level: l, comment: "x" },
  coherence: { level: l, comment: "x" },
  vocabulaire: { level: l, comment: "x" },
  grammaire: { level: l, comment: "x" },
  aisance: { level: l, comment: "x" },
});
const out = (l: "A2" | "B1" | "B2"): EvaluationOutput => ({
  globalLevel: l,
  criteria: crit(l),
  summary: "x",
  utterances: [],
});
const ref = (id: string, l: "A2" | "B1" | "B2"): EvalCase => ({
  id,
  task: 2,
  prompt: null,
  human: {
    globalLevel: l,
    criteria: {
      adequation: l,
      coherence: l,
      vocabulaire: l,
      grammaire: l,
      aisance: l,
    },
  },
  transcript: [],
});
const run = (caseId: string, levels: ("A2" | "B1" | "B2")[]): CaseRun => ({
  caseId,
  outputs: levels.map(out),
  inputTokens: 100,
  outputTokens: 50,
  latencyMs: 2000,
});

describe("summarize", () => {
  it("computes agreement, error and stability", () => {
    const s = summarize(
      [ref("a", "B1"), ref("b", "B1"), ref("c", "A2")],
      [run("a", ["B1", "B1"]), run("b", ["B2", "B1"]), run("c", ["B2", "B2"])],
    );
    expect(s.exactMatch).toBeCloseTo(1 / 3);
    expect(s.withinOne).toBeCloseTo(2 / 3);
    expect(s.meanAbsError).toBeCloseTo(1);
    expect(s.stability).toBeCloseTo(2 / 3);
    expect(s.perCriterionExact.grammaire).toBeCloseTo(1 / 3);
    expect(s.inputTokens).toBe(300);
    expect(s.meanLatencyMs).toBe(2000);
  });
});
