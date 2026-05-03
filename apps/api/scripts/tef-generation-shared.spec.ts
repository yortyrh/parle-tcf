import { describe, expect, it } from "vitest";
import {
  getTefInstructionsPrefixes,
  parseTefInstructionsStructuredOutput,
  primeTefInstructionsPrefixCache,
  wrapTefInstructionsMarkdown,
} from "./tef-generation-shared.js";

describe("TEF instructions prefix (INSTRUCTIONS_PREFIX.md)", () => {
  it("expose un préfixe Section A avec le rappel agent Section A", () => {
    primeTefInstructionsPrefixCache();
    const pre = getTefInstructionsPrefixes().A;
    expect(pre.length).toBeGreaterThan(0);
    expect(pre).toContain("RAPPEL FINAL");
  });

  it("concatène préfixe et corps pour wrapTefInstructionsMarkdown", () => {
    primeTefInstructionsPrefixCache();
    const wrapped = wrapTefInstructionsMarkdown("Ligne unique d’exercice.", "A");
    expect(wrapped.startsWith(getTefInstructionsPrefixes().A)).toBe(true);
    expect(wrapped.endsWith("Ligne unique d’exercice.")).toBe(true);
  });
});

describe("parseTefInstructionsStructuredOutput", () => {
  it("extrait le champ prompt d’un JSON brut", () => {
    expect(
      parseTefInstructionsStructuredOutput(`{"prompt":"Bonjour\\nLigne 2"}`),
    ).toBe("Bonjour\nLigne 2");
  });

  it("extrait le JSON depuis un bloc markdown", () => {
    const wrapped = `Voici du texte avant\n\`\`\`json\n{"prompt":"Contenu seul"}\n\`\`\``;
    expect(parseTefInstructionsStructuredOutput(wrapped)).toBe("Contenu seul");
  });

  it("rejette un prompt vide", () => {
    expect(() =>
      parseTefInstructionsStructuredOutput(`{"prompt":"  "}`),
    ).toThrow();
  });
});
