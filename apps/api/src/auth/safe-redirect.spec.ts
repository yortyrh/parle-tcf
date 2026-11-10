import { describe, expect, it } from "vitest";
import { DEFAULT_REDIRECT, safeRedirectPath } from "./safe-redirect.js";

describe("safeRedirectPath", () => {
  it("defaults to /tcf", () => {
    expect(DEFAULT_REDIRECT).toBe("/tcf");
  });

  it.each([
    "/",
    "/tcf",
    "/tcf/tache2?x=1&y=2",
    "/a/b#c",
    "/a//b",
    "/a?next=//x",
  ])("keeps the app-relative path %j", (value) => {
    expect(safeRedirectPath(value)).toBe(value);
  });

  const rejected: unknown[] = [
    "https://evil.test",
    "http://evil.test/tcf",
    "//evil.test",
    "//",
    "/\\evil.test",
    "/a\\b",
    "\\/evil.test",
    "/a\nb",
    "/a\rb",
    "/a\r\nLocation: https://evil.test",
    "tcf",
    " /tcf",
    "",
    "javascript:alert(1)",
    null,
    undefined,
    42,
    {},
    ["/tcf"],
  ];

  it.each(rejected)("rejects %j", (value) => {
    expect(safeRedirectPath(value as string)).toBe("/tcf");
  });
});
