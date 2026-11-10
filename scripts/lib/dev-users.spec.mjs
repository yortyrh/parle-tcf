import { describe, expect, it, vi } from "vitest";
import { DEV_USERS, resolveCredentials } from "./dev-users.mjs";

const DEV = "developer@parle-tcf.local";
const E2E = "e2e-fixture@parle-tcf.local";

const counter = () => {
  let n = 0;
  return vi.fn(() => `generated-password-${++n}`);
};

describe("DEV_USERS", () => {
  it("lists exactly the developer and e2e users, in order", () => {
    expect(DEV_USERS).toEqual([
      { key: "developer", email: DEV, name: "Développeur" },
      { key: "e2e", email: E2E, name: "E2E Fixture" },
    ]);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(DEV_USERS)).toBe(true);
  });
});

describe("resolveCredentials", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "not an object"],
    ["a number", 42],
    ["an object without credentials", {}],
    ["null credentials", { credentials: null }],
    ["string credentials", { credentials: "nope" }],
    ["numeric credentials", { credentials: 7 }],
  ])("generates both passwords when previous is %s", (_label, previous) => {
    const generate = counter();
    expect(resolveCredentials(previous, generate)).toEqual({
      credentials: {
        [DEV]: "generated-password-1",
        [E2E]: "generated-password-2",
      },
      generated: [DEV, E2E],
    });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("keeps passwords of 12 characters or more without generating", () => {
    const generate = counter();
    const previous = {
      credentials: { [DEV]: "a".repeat(12), [E2E]: "b".repeat(40) },
    };
    expect(resolveCredentials(previous, generate)).toEqual({
      credentials: { [DEV]: "a".repeat(12), [E2E]: "b".repeat(40) },
      generated: [],
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("regenerates an 11-character password", () => {
    const generate = counter();
    const result = resolveCredentials(
      { credentials: { [DEV]: "a".repeat(11), [E2E]: "b".repeat(12) } },
      generate,
    );
    expect(result).toEqual({
      credentials: { [DEV]: "generated-password-1", [E2E]: "b".repeat(12) },
      generated: [DEV],
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("regenerates only the missing e2e password", () => {
    const generate = counter();
    const result = resolveCredentials(
      { credentials: { [DEV]: "kept-password-123" } },
      generate,
    );
    expect(result).toEqual({
      credentials: {
        [DEV]: "kept-password-123",
        [E2E]: "generated-password-1",
      },
      generated: [E2E],
    });
  });

  it.each([
    ["a number", 123456789012345],
    ["null", null],
    ["an object", { value: "long-enough-password" }],
    ["an array", ["long-enough-password"]],
    ["an empty string", ""],
  ])("regenerates a password stored as %s", (_label, stored) => {
    const generate = counter();
    const result = resolveCredentials(
      { credentials: { [DEV]: stored, [E2E]: "e2e-password-ok" } },
      generate,
    );
    expect(result.credentials[DEV]).toBe("generated-password-1");
    expect(result.credentials[E2E]).toBe("e2e-password-ok");
    expect(result.generated).toEqual([DEV]);
  });

  it("drops emails that are not dev users", () => {
    const result = resolveCredentials(
      {
        credentials: {
          [DEV]: "developer-password",
          [E2E]: "e2e-fixture-password",
          "someone@else.test": "another-password",
        },
      },
      counter(),
    );
    expect(Object.keys(result.credentials).sort()).toEqual([DEV, E2E].sort());
    expect(result.credentials).not.toHaveProperty("someone@else.test");
    expect(result.generated).toEqual([]);
  });

  it("is idempotent: resolving its own output generates nothing", () => {
    const first = resolveCredentials(null, counter());
    const generate = counter();
    const second = resolveCredentials(
      { credentials: first.credentials },
      generate,
    );
    expect(second).toEqual({ credentials: first.credentials, generated: [] });
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not mutate previous", () => {
    const previous = {
      credentials: { [DEV]: "short", "extra@test.local": "extra-password" },
    };
    const snapshot = structuredClone(previous);
    resolveCredentials(previous, counter());
    expect(previous).toEqual(snapshot);
  });
});
