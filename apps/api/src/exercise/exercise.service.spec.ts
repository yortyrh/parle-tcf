import { describe, it, expect } from "vitest";
import { splitTefPracticeGuide } from "./exercise.service.js";

describe("splitTefPracticeGuide", () => {
  it("returns full content as agentInstructions when marker is absent", () => {
    const raw = "Agent instructions here.\n\nMore content.";
    const { agentInstructions, practiceGuide } = splitTefPracticeGuide(raw);
    expect(agentInstructions).toBe(raw.trim());
    expect(practiceGuide).toBeNull();
  });

  it("splits on <<<GUIDE_CANDIDAT>>> and trims both sides", () => {
    const raw = "  Agent part.  \n<<<GUIDE_CANDIDAT>>>\n  Guide part.  ";
    const { agentInstructions, practiceGuide } = splitTefPracticeGuide(raw);
    expect(agentInstructions).toBe("Agent part.");
    expect(practiceGuide).toBe("Guide part.");
  });

  it("returns null practiceGuide when guide block is empty after marker", () => {
    const raw = "Agent part.\n<<<GUIDE_CANDIDAT>>>\n   ";
    const { agentInstructions, practiceGuide } = splitTefPracticeGuide(raw);
    expect(agentInstructions).toBe("Agent part.");
    expect(practiceGuide).toBeNull();
  });

  it("handles marker at start of string", () => {
    const raw = "<<<GUIDE_CANDIDAT>>>\nGuide only.";
    const { agentInstructions, practiceGuide } = splitTefPracticeGuide(raw);
    expect(agentInstructions).toBe("");
    expect(practiceGuide).toBe("Guide only.");
  });

  it("handles multiline agent instructions and guide", () => {
    const agentPart = "Line 1\nLine 2\nLine 3";
    const guidePart = "## Section\n- item 1\n- item 2";
    const raw = `${agentPart}\n<<<GUIDE_CANDIDAT>>>\n${guidePart}`;
    const { agentInstructions, practiceGuide } = splitTefPracticeGuide(raw);
    expect(agentInstructions).toBe(agentPart);
    expect(practiceGuide).toBe(guidePart);
  });

  it("only splits on the first occurrence of the marker", () => {
    const raw =
      "Agent part.\n<<<GUIDE_CANDIDAT>>>\nGuide part.\n<<<GUIDE_CANDIDAT>>>\nShould be in guide.";
    const { agentInstructions, practiceGuide } = splitTefPracticeGuide(raw);
    expect(agentInstructions).toBe("Agent part.");
    expect(practiceGuide).toContain("Guide part.");
    expect(practiceGuide).toContain("Should be in guide.");
  });
});
