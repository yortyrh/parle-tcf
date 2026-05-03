import { describe, it, expect } from "vitest";
import {
  EXERCICE_MARKER,
  extractExerciseBodyFromInstructionsFile,
} from "./tef-generation-shared.js";

describe("extractExerciseBodyFromInstructionsFile", () => {
  it("returns text after EXERCICE À UTILISER when marker is present", () => {
    const prefix = "YAML block\n\nmore rules";
    const body = "# TEF-A-01\n\n## Rôle\nHello";
    const raw = `${prefix}${EXERCICE_MARKER}${body}`;
    expect(extractExerciseBodyFromInstructionsFile(raw)).toBe(body.trim());
  });

  it("returns full trimmed content when marker is absent", () => {
    const raw = "  only body  \n";
    expect(extractExerciseBodyFromInstructionsFile(raw)).toBe("only body");
  });
});
