import { describe, expect, it } from "vitest";
import { parseTefInstructionsStructuredOutput } from "./tef-generation-shared.js";

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
